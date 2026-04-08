import { ActiveFight, Character, Monster } from '../types'
import { d20, d6, d8 } from './dice'
import { shouldDropLoot, rollLoot } from './loot'
import { supabase } from '../lib/supabase'
import { getMonsterForLevel } from './monsters'
import { trimGraveyard } from '../lib/graveyard'
import { getCharacterStats } from '../lib/stats'
import { trackKill } from '../lib/kills'
import { BOSSES } from './bosses'
import { getBuff, clearBuff } from '../lib/tavernBuffs'
import tmi from 'tmi.js'

export const activeFights = new Map<string, ActiveFight>()
const FIGHT_TIMEOUT_MS = 5 * 60 * 1000

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

  // Set timeout for dormant fight
  setTimeout(() => checkFightTimeout(channel, username, client), FIGHT_TIMEOUT_MS)

  if (!existingMonster) {
    client.say(
      channel,
      `⚔️ @${username} encounters a ${monster.name}! ` +
      `(HP: ${monster.hp} | ATK: ${monster.attack} | DEF: ${monster.defense}) ` +
      `Type !attack to attack!`
    )
  } else {
    client.say(
      channel,
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

  // Player attacks
  const playerRoll = d20()
  const playerHit = playerRoll + 2 + stats.attackBonus > fight.monster.defense
  let playerDamage = 0

  if (playerHit) {
    playerDamage = d8() + stats.damageBonus
    fight.monster_current_hp -= playerDamage
  }

  // Monster dies
  if (fight.monster_current_hp <= 0) {
    await handleVictory(channel, username, fight, client)
    return
  }

  // Monster attacks back
  const monsterRoll = d20()
  const monsterHit = monsterRoll + fight.monster.attack > 12 + stats.defenseBonus
  let monsterDamage = 0

  if (monsterHit) {
    monsterDamage = fight.monster.attack
    fight.character_current_hp -= monsterDamage
  }

  // Character dies
  if (fight.character_current_hp <= 0) {
    await handleDeath(channel, username, fight, client)
    return
  }

  // Fight continues
  const hitMsg = playerHit
    ? `You hit the ${fight.monster.name} for ${playerDamage} damage!`
    : `You missed the ${fight.monster.name}!`

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

const CLASS_HP: Record<string, number> = {
  alchemist: 5, artificer: 4, barbarian: 7, bard: 4, cleric: 5,
  druid: 5, favored_soul: 5, fighter: 6, monk: 5, paladin: 6,
  ranger: 6, rogue: 4, sorcerer: 3, warlock: 4, wizard: 3,
  sacred_fist: 6, dark_apostate: 5, stormsinger: 4, blightcaster: 5,
  acolyte_of_the_skin: 4, dark_hunter: 6, dragon_lord: 6,
  wild_mage: 3, dragon_disciple: 5, arcane_trickster: 4,
}

async function handleVictory(
  channel: string,
  username: string,
  fight: ActiveFight,
  client: tmi.Client
): Promise<void> {
  activeFights.delete(username)

  // Track kill and check for new titles
  const isBoss = BOSSES.some(b => b.name === fight.monster.name)

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const newXp = char.xp + fight.monster.xp_reward
  const newGold = char.gold + fight.monster.gold_reward
  const { newLevel, newXpTotal } = calculateLevel(newXp)
  const leveledUp = newLevel > char.level

  // Recalculate max HP on level up
  const hpPerLevel = CLASS_HP[char.class] ?? 5
  const newMaxHp = leveledUp
    ? char.max_hp + hpPerLevel
    : char.max_hp
  const newHp = leveledUp
    ? fight.character_current_hp + hpPerLevel
    : fight.character_current_hp

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
    ? ` 🎉 LEVEL UP! You are now Level ${newLevel}! (+${hpPerLevel} max HP)`
    : ''

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

  if (Date.now() - fight.last_action >= FIGHT_TIMEOUT_MS) {
    await handleDeath(channel, username, fight, client)
    client.say(channel, `⏰ @${username} fled from battle and was cut down by the ${fight.monster.name}!`)
  }
}

export function calculateLevel(xp: number): { newLevel: number; newXpTotal: number } {
  const XP_THRESHOLDS = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
    305000, 355000, 385000, 415000, 445000, 475000, 505000, 535000,
    565000, 595000, 625000, 655000, 685000, 715000, 745000, 775000,
    805000, 835000, 865000, 895000, 925000, 955000,
  ]

  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }

  return { newLevel: Math.min(level, 40), newXpTotal: xp }
}