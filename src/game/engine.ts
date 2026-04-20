import { ActiveFight, Monster } from '../types'
import { d20, d8 } from './dice'
import { shouldDropLoot, rollLoot } from './loot'
import { supabase } from '../lib/supabase'
import { getMonsterForLevel } from './monsters'
import { CLASS_HP_DIE, rollHp } from '../lib/classes'
import { trimGraveyard } from '../lib/graveyard'
import { getCharacterStats } from '../lib/stats'
import { trackKill } from '../lib/kills'
import { BOSSES } from './bosses'
import { getBuff, clearBuff } from '../lib/tavernBuffs'
import { ragingPlayers } from '../commands/rage'
import tmi from 'tmi.js'
import {
  deathwardedPlayers,
  criticalPlayers,
  fumblePlayers,
  advantagePlayers,
  disadvantagePlayers,
  inspiredPlayers,
  hasHeroesFeast,
} from '../commands/new_commands'
import {
  isParalyzed, isFeared, tickParalysis, tickFear,
  tickDisease, applyUndeadSpecial,
} from '../lib/undeadSpecials'
import {
  activeHirelings, hirelingAbsorbsHit, hirelingTakeHit,
  rollHirelingDamage, getHirelingQuip, getHirelingDeathMessage,
  applyHirelingSpecial,
} from '../commands/hireling'
import { checkConcentrationOnHit, breakConcentration } from '../commands/spells'

export const activeFights = new Map<string, ActiveFight>()
const FIGHT_TIMEOUT_MS = 20 * 60 * 1000

export function getActiveFight(username: string): ActiveFight | undefined {
  return activeFights.get(username)
}

export async function startFight(
  channel: string,
  username: string,
  client: tmi.Client,
  existingMonster?: Monster
): Promise<void> {
  if (activeFights.has(username) && !existingMonster) {
    client.say(channel, `@${username} — you're already in a fight! Use !attack to continue.`)
    return
  }

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) {
    client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
    return
  }

  if (char.hp <= 0) {
    client.say(channel, `@${username} — you're dead! Check !graveyard to see your fallen hero.`)
    return
  }

  const diseaseTick = await tickDisease(username, char.hp, char.max_hp)
  if (diseaseTick) {
    client.say(channel, diseaseTick.message)
    char.hp = Math.max(1, char.hp - diseaseTick.damage)
  }

  const monster = existingMonster ?? getMonsterForLevel(char.level)

  const fight: ActiveFight = {
    character_id: char.id,
    twitch_username: username,
    monster,
    monster_current_hp: monster.hp,
    character_current_hp: char.hp,
    last_action: Date.now(),
  }

  activeFights.set(username, fight)
  setTimeout(() => checkFightTimeout(channel, username, client), FIGHT_TIMEOUT_MS)

  if (!existingMonster) {
    client.say(channel,
      `⚔️ @${username} encounters a ${monster.name}! ` +
      `(HP: ${monster.hp} | ATK: ${monster.attack} | DEF: ${monster.defense}) ` +
      `Type !attack to attack!`
    )
  } else {
    client.say(channel,
      `⚔️ @${username} — a ${monster.name} stands before you! ` +
      `(HP: ${monster.hp} | ATK: ${monster.attack} | DEF: ${monster.defense}) ` +
      `Type !attack to fight!`
    )
  }
}

export async function continueFight(
  channel: string,
  username: string,
  client: tmi.Client
): Promise<void> {
  const fight = activeFights.get(username)!
  fight.last_action = Date.now()

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  const stats = char ? await getCharacterStats(char) : { attackBonus: 0, defenseBonus: 0, hpBonus: 0, damageBonus: 0 }
  const buff = getBuff(username)

  if (buff) {
    if (buff.effect === 'attack') stats.attackBonus += buff.bonus
    if (buff.effect === 'defense') stats.defenseBonus += buff.bonus
    if (buff.effect === 'damage') stats.damageBonus += buff.bonus
    clearBuff(username)
  }

  // ── Paralysis check ──────────────────────────────────────────
  if (isParalyzed(username)) {
    tickParalysis(username)
    client.say(channel, `🧊 @${username} is paralyzed and cannot move! Their turn is lost.`)
    const monsterRollP = d20()
    const monsterHitP = monsterRollP + fight.monster.attack > 12 + stats.defenseBonus
    if (monsterHitP) {
      fight.character_current_hp -= fight.monster.attack
      client.say(channel,
        `The ${fight.monster.name} strikes the helpless @${username} for ${fight.monster.attack} damage! ` +
        `(HP: ${fight.character_current_hp}/${char?.max_hp})`
      )
      if (fight.character_current_hp <= 0) {
        if (deathwardedPlayers.has(username)) {
          deathwardedPlayers.delete(username)
          fight.character_current_hp = 1
          await supabase.from('characters').update({ hp: 1 }).eq('twitch_username', username)
          client.say(channel, `🛡️ @${username}'s Death Ward triggers! They survive at 1 HP.`)
          activeFights.delete(username)
        } else {
          await handleDeath(channel, username, fight, client)
        }
      }
    } else {
      client.say(channel, `The ${fight.monster.name} swings at the paralyzed @${username} but misses!`)
    }
    return
  }

  // ── Fear check ───────────────────────────────────────────────
  if (isFeared(username)) {
    tickFear(username)
    client.say(channel, `😱 @${username} is overcome with fear and cannot act! Their turn is lost.`)
    const monsterRollF = d20()
    const monsterHitF = monsterRollF + fight.monster.attack > 12 + stats.defenseBonus
    if (monsterHitF) {
      fight.character_current_hp -= fight.monster.attack
      client.say(channel,
        `The ${fight.monster.name} presses the advantage on the fleeing @${username} for ${fight.monster.attack} damage! ` +
        `(HP: ${fight.character_current_hp}/${char?.max_hp})`
      )
      if (fight.character_current_hp <= 0) {
        if (deathwardedPlayers.has(username)) {
          deathwardedPlayers.delete(username)
          fight.character_current_hp = 1
          await supabase.from('characters').update({ hp: 1 }).eq('twitch_username', username)
          client.say(channel, `🛡️ @${username}'s Death Ward triggers! They survive at 1 HP.`)
          activeFights.delete(username)
        } else {
          await handleDeath(channel, username, fight, client)
        }
      }
    } else {
      client.say(channel, `The ${fight.monster.name} can't catch the fleeing @${username}!`)
    }
    return
  }

  // ── Critical / Fumble / Advantage / Disadvantage hooks ──────
  const hasCrit = criticalPlayers.has(username)
  const hasFumble = fumblePlayers.has(username)
  const hasAdvantage = advantagePlayers.has(username)
  const hasDisadvantage = disadvantagePlayers.has(username)

  if (hasCrit) criticalPlayers.delete(username)
  if (hasFumble) fumblePlayers.delete(username)
  if (hasAdvantage) advantagePlayers.delete(username)
  if (hasDisadvantage) disadvantagePlayers.delete(username)

  // ── Inspiration hook ─────────────────────────────────────────
  const hasInspiration = inspiredPlayers.has(username)
  if (hasInspiration) inspiredPlayers.delete(username)

  // ── Player attack roll ───────────────────────────────────────
  let playerRoll: number
  if (hasCrit) {
    playerRoll = 20
  } else if (hasFumble) {
    playerRoll = 1
  } else if (hasAdvantage) {
    playerRoll = Math.max(d20(), d20())
  } else if (hasDisadvantage) {
    playerRoll = Math.min(d20(), d20())
  } else {
    playerRoll = d20()
  }

  const playerHit = hasCrit || (!hasFumble && playerRoll + 2 + stats.attackBonus > fight.monster.defense)
  let playerDamage = 0
  let rageBonusDamage = 0

  if (playerHit) {
    const { data: euryaleFlag } = await supabase
      .from('player_consequence_flags')
      .select('euryale_attack_penalty')
      .eq('username', username)
      .eq('flag_type', 'euryale_cursed')
      .eq('is_active', true)
      .single()

    const euryalePenalty = euryaleFlag?.euryale_attack_penalty ?? 0
    const baseDamage = d8() + stats.damageBonus - euryalePenalty

    if (ragingPlayers.has(username)) {
      ragingPlayers.delete(username)
      rageBonusDamage = Math.floor(Math.random() * 12) + 1
    }

    if (hasCrit || hasInspiration) {
      const bonusDamage = d8()
      playerDamage = Math.max(1, baseDamage * 2 + bonusDamage + rageBonusDamage)
    } else {
      playerDamage = Math.max(1, baseDamage + rageBonusDamage)
    }

    fight.monster_current_hp -= playerDamage
  }

  // ── Hireling attacks ─────────────────────────────────────────
  const hireling = activeHirelings.get(username)
  if (hireling) {
    const hirelingDmg = rollHirelingDamage(hireling)
    fight.monster_current_hp -= hirelingDmg
    const quip = getHirelingQuip(hireling, fight.monster.name)
    if (quip) {
      client.say(channel, `🗡️ ${quip} (${hirelingDmg} damage)`)
    } else {
      client.say(channel, `🗡️ ${hireling.name} attacks the ${fight.monster.name} for ${hirelingDmg} damage!`)
    }
  }

  // ── Monster dies ─────────────────────────────────────────────
  if (fight.monster_current_hp <= 0) {
    await handleVictory(channel, username, fight, client)
    return
  }

  // ── Monster attacks back ─────────────────────────────────────
  const monsterRoll = d20()
  const monsterHit = monsterRoll + fight.monster.attack > 12 + stats.defenseBonus
  let monsterDamage = 0

  if (monsterHit) {
    monsterDamage = fight.monster.attack
    const hirelingForAbsorb = activeHirelings.get(username)
    if (hirelingForAbsorb && hirelingAbsorbsHit(hirelingForAbsorb)) {
      const died = hirelingTakeHit(username)
      if (died) {
        client.say(channel, `💀 ${getHirelingDeathMessage(hirelingForAbsorb)}`)
      } else {
        client.say(channel, `🛡️ ${hirelingForAbsorb.name} takes the hit for @${username}!`)
      }
    } else {
      fight.character_current_hp -= monsterDamage
    }
  }

  // ── Concentration check ──────────────────────────────────────
  if (monsterHit && monsterDamage > 0) {
    checkConcentrationOnHit(username, monsterDamage, channel, client)
  }

  // ── Undead special ───────────────────────────────────────────
  if (monsterHit && fight.monster.is_undead && fight.monster.undead_specials && fight.monster.special_chance) {
    const special = await applyUndeadSpecial(
      username,
      fight.monster.undead_specials,
      fight.monster.special_chance,
      {
        hp: fight.character_current_hp,
        max_hp: char?.max_hp ?? 100,
        gold: char?.gold ?? 0,
        xp: char?.xp ?? 0,
        level: char?.level ?? 1,
      }
    )
    if (special) {
      client.say(channel, special.message)
      if (special.hpDrain > 0) {
        fight.character_current_hp -= special.hpDrain
      }
    }
  }

  // ── Character dies ───────────────────────────────────────────
  if (fight.character_current_hp <= 0) {
    if (deathwardedPlayers.has(username)) {
      deathwardedPlayers.delete(username)
      fight.character_current_hp = 1
      await supabase.from('characters').update({ hp: 1 }).eq('twitch_username', username)
      client.say(channel, `🛡️ @${username}'s Death Ward triggers! They survive at 1 HP. The ward is spent.`)
      activeFights.delete(username)
      breakConcentration(username)
      return
    }
    await handleDeath(channel, username, fight, client)
    return
  }

  // ── Fight continues ──────────────────────────────────────────
  const critMsg = hasCrit ? ' CRITICAL HIT!' : ''
  const fumbleMsg = hasFumble ? ' FUMBLE!' : ''
  const advMsg = hasAdvantage ? ' (advantage)' : hasDisadvantage ? ' (disadvantage)' : ''
  const inspMsg = hasInspiration ? ' INSPIRED!' : ''
  const rageMsg = rageBonusDamage > 0 ? ` RAGING! (+${rageBonusDamage} rage damage)` : ''

  const hitMsg = playerHit
    ? `You hit the ${fight.monster.name} for ${playerDamage} damage!${critMsg}${inspMsg}${advMsg}${rageMsg}`
    : `You missed the ${fight.monster.name}!${fumbleMsg}${advMsg}`

  const monsterMsg = monsterHit
    ? `The ${fight.monster.name} strikes back for ${monsterDamage} damage!`
    : `The ${fight.monster.name} misses you!`

  client.say(
    channel,
    `⚔️ @${username} — ${hitMsg} ${monsterMsg} ` +
    `[Your HP: ${fight.character_current_hp} | ${fight.monster.name} HP: ${fight.monster_current_hp}] ` +
    `Type !attack to continue or !flee to run away! 🐔`
  )
}

async function handleVictory(
  channel: string,
  username: string,
  fight: ActiveFight,
  client: tmi.Client
): Promise<void> {
  activeFights.delete(username)

  const isBoss = BOSSES.some(b => b.name === fight.monster.name)

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const heroesFeastActive = hasHeroesFeast(username)
  const xpMultiplier = heroesFeastActive ? 1.5 : 1
  const goldMultiplier = heroesFeastActive ? 1.5 : 1
  const newXp = char.xp + Math.floor(fight.monster.xp_reward * xpMultiplier)
  const newGold = char.gold + Math.floor(fight.monster.gold_reward * goldMultiplier)
  const { newLevel, newXpTotal } = calculateLevel(newXp)
  const leveledUp = newLevel > char.level
  const hpDie = CLASS_HP_DIE[char.class] ?? 6
  const hpRoll = leveledUp ? rollHp(hpDie) : 0
  const newMaxHp = leveledUp ? char.max_hp + hpRoll : char.max_hp
  const newHp = leveledUp ? fight.character_current_hp + hpRoll : fight.character_current_hp

  let lootMsg = ''
  if (shouldDropLoot(fight.monster.loot_chance)) {
    const item = rollLoot()
    await supabase.from('inventory').insert({
      character_id: char.id,
      item_name: item.name,
      item_type: item.type,
      rarity: item.rarity,
      stat_bonus: item.stat_bonus,
      description: item.description,
    })
    lootMsg = ` You find a ${item.rarity.toUpperCase()} ${item.name}!`
  }

  const newTitles = await trackKill(char.id, username, fight.monster.name, isBoss)
  const titleMsg = newTitles.length > 0
    ? ` 🏅 New title${newTitles.length > 1 ? 's' : ''} unlocked: ${newTitles.join(', ')}!`
    : ''

  await supabase.from('characters').update({
    xp: newXpTotal,
    level: newLevel,
    gold: newGold,
    hp: newHp,
    max_hp: newMaxHp,
  }).eq('twitch_username', username)

  const levelMsg = leveledUp
    ? ` 🎉 LEVEL UP! You are now Level ${newLevel}! (+${hpRoll} max HP)`
    : ''

  const hireling = activeHirelings.get(username)
  if (hireling) {
    const specialMsg = await applyHirelingSpecial(username, hireling, fight.monster.gold_reward)
    if (specialMsg) client.say(channel, `✨ ${specialMsg}`)
  }

  client.say(
    channel,
    `🏆 @${username} defeated the ${fight.monster.name}! ` +
    `+${fight.monster.xp_reward} XP | +${fight.monster.gold_reward}g${lootMsg}${levelMsg}${titleMsg}`
  )
}

export async function handleDeath(
  channel: string,
  username: string,
  fight: ActiveFight,
  client: tmi.Client
): Promise<void> {
  activeFights.delete(username)

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  await supabase.from('graveyard').insert({
    twitch_username: char.twitch_username,
    display_name: char.display_name,
    class: char.class,
    level: char.level,
    xp: char.xp,
    killed_by: fight.monster.name,
  })

  await trimGraveyard()
  await supabase.from('characters').delete().eq('twitch_username', username)

  const boss = BOSSES.find(b => b.name === fight.monster.name)
  const deathMsg = boss
    ? `💀 @${username} ${boss.deathMessage}! Use !join to start over.`
    : `💀 @${username} has been slain by the ${fight.monster.name} at Level ${char.level}! ` +
    `Their soul joins the heroes graveyard. Use !join to start over.`

  client.say(channel, deathMsg)
}

async function checkFightTimeout(
  channel: string,
  username: string,
  client: tmi.Client
): Promise<void> {
  const fight = activeFights.get(username)
  if (!fight) return

  if (Date.now() - fight.last_action < FIGHT_TIMEOUT_MS) return

  // Auto-combat — fight until one side is dead
  client.say(channel,
    `⏰ @${username} is AFK! The ${fight.monster.name} grows impatient — ` +
    `auto-combat begins!`
  )

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) { activeFights.delete(username); return }

  let playerHp = fight.character_current_hp
  let monsterHp = fight.monster_current_hp
  let rounds = 0

  while (playerHp > 0 && monsterHp > 0 && rounds < 20) {
    // Player auto-attacks
    const playerDmg = Math.floor(Math.random() * 8) + 1
    monsterHp = Math.max(0, monsterHp - playerDmg)

    // Monster attacks back
    const monsterDmg = fight.monster.attack
    playerHp = Math.max(0, playerHp - monsterDmg)

    rounds++
  }

  activeFights.delete(username)

  if (monsterHp <= 0 && playerHp > 0) {
    // Player wins
    const { handleVictory } = await import('./engine') as any
    fight.character_current_hp = playerHp
    fight.monster_current_hp = 0
    await supabase.from('characters').update({ hp: playerHp }).eq('twitch_username', username)
    client.say(channel,
      `⚔️ Auto-combat: @${username} defeated the ${fight.monster.name} while AFK! ` +
      `+${fight.monster.xp_reward} XP | +${fight.monster.gold_reward}g (HP: ${playerHp}/${char.max_hp})`
    )
    await supabase.from('characters').update({
      xp: char.xp + fight.monster.xp_reward,
      gold: char.gold + fight.monster.gold_reward,
      hp: playerHp,
    }).eq('twitch_username', username)
  } else {
    // Player dies
    fight.character_current_hp = 0
    await handleDeath(channel, username, fight, client)
    client.say(channel,
      `💀 Auto-combat: @${username} was slain by the ${fight.monster.name} while AFK!`
    )
  }
}

export function calculateLevel(xp: number): { newLevel: number; newXpTotal: number } {
  const XP_THRESHOLDS = [
    0, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 175000, 275000,
    400000, 550000, 700000, 875000, 1050000, 1250000, 1450000, 1675000,
    1900000, 2150000, 2400000, 2650000, 2925000, 3200000, 3500000,
    3800000, 4125000, 4450000, 4800000, 5150000, 5525000, 5900000,
    6300000, 6700000, 7125000, 7550000, 8000000, 8450000, 8925000,
    9400000,
  ]

  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }

  return { newLevel: Math.min(level, 40), newXpTotal: xp }
}