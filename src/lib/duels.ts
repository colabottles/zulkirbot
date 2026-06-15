import tmi from 'tmi.js'
import { supabase } from './supabase'
import { getCharacterStats } from './stats'
import { d20, d8 } from '../game/dice'
import { CLASS_HP_DIE, rollHp } from './classes'
import { calculateLevel } from '../game/engine'

export interface DuelChallenge {
  challenger: string
  target: string
  channel: string
  expiresAt: number
}

export interface ActiveDuel {
  challenger: string
  target: string
  channel: string
  challengerHp: number
  targetHp: number
}

const pendingChallenges = new Map<string, DuelChallenge>()
const activeDuels = new Map<string, ActiveDuel>()

const DUEL_TIMEOUT_MS = 3 * 60 * 1000
const ROUND_DELAY_MS = 2500
const XP_REWARD = 50

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function createChallenge(challenger: string, target: string, channel: string): void {
  pendingChallenges.set(target, {
    challenger,
    target,
    channel,
    expiresAt: Date.now() + DUEL_TIMEOUT_MS,
  })
}

export function getChallenge(target: string): DuelChallenge | undefined {
  const challenge = pendingChallenges.get(target)
  if (!challenge) return undefined
  if (Date.now() > challenge.expiresAt) {
    pendingChallenges.delete(target)
    return undefined
  }
  return challenge
}

export function removeChallenge(target: string): void {
  pendingChallenges.delete(target)
}

export function getActiveDuel(username: string): ActiveDuel | undefined {
  return activeDuels.get(username)
}

export function removeDuel(challenger: string, target: string): void {
  activeDuels.delete(challenger)
  activeDuels.delete(target)
}

export function isAnyDuelActive(): boolean {
  return activeDuels.size > 0
}

export function isInDuel(username: string): boolean {
  return activeDuels.has(username)
}

export async function runDuel(
  challenger: string,
  target: string,
  channel: string,
  challengerHp: number,
  targetHp: number,
  firstTurn: string,
  client: tmi.Client
): Promise<void> {
  const duel: ActiveDuel = {
    challenger,
    target,
    channel,
    challengerHp,
    targetHp,
  }

  activeDuels.set(challenger, duel)
  activeDuels.set(target, duel)

  const { data: challengerChar } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', challenger)
    .single()

  const { data: targetChar } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', target)
    .single()

  if (!challengerChar || !targetChar) {
    removeDuel(challenger, target)
    client.say(channel, `⚔️ Duel cancelled — couldn't load both characters.`)
    return
  }

  const challengerStats = await getCharacterStats(challengerChar)
  const targetStats = await getCharacterStats(targetChar)

  let attackerName = firstTurn
  let defenderName = firstTurn === challenger ? target : challenger
  let round = 1

  while (duel.challengerHp > 0 && duel.targetHp > 0) {
    await delay(ROUND_DELAY_MS)

    const attackerStats = attackerName === challenger ? challengerStats : targetStats
    const defenderStats = attackerName === challenger ? targetStats : challengerStats

    const roll = d20()
    const hit = roll + 2 + attackerStats.attackBonus > 10 + defenderStats.defenseBonus
    let damage = 0

    if (hit) {
      damage = d8() + attackerStats.damageBonus
      if (attackerName === challenger) {
        duel.targetHp -= damage
      } else {
        duel.challengerHp -= damage
      }
    }

    const attackerHp = attackerName === challenger ? duel.challengerHp : duel.targetHp
    const defenderHp = attackerName === challenger ? duel.targetHp : duel.challengerHp

    const hitMsg = hit
      ? `@${attackerName} hits @${defenderName} for ${damage} damage!`
      : `@${attackerName} misses @${defenderName}!`

    // Someone dropped — resolve and break
    if (defenderHp <= 0) {
      removeDuel(challenger, target)

      await supabase
        .from('characters')
        .update({ hp: 0 })
        .eq('twitch_username', defenderName)

      const { data: winnerChar } = await supabase
        .from('characters')
        .select('*')
        .eq('twitch_username', attackerName)
        .single()

      const loserChar = attackerName === challenger ? targetChar : challengerChar

      if (winnerChar) {
        const newXp = winnerChar.xp + XP_REWARD
        const { newLevel, newXpTotal } = calculateLevel(newXp)
        const leveledUp = newLevel > winnerChar.level
        const hpDie = CLASS_HP_DIE[winnerChar.class] ?? 6
        const levelsGained = newLevel - winnerChar.level
        const hpRoll = Array.from({ length: levelsGained }, () => rollHp(hpDie)).reduce((a, b) => a + b, 0)
        const newMaxHp = winnerChar.max_hp + hpRoll

        await supabase
          .from('characters')
          .update({
            xp: newXpTotal,
            level: newLevel,
            max_hp: leveledUp ? newMaxHp : winnerChar.max_hp,
            hp: leveledUp ? Math.min(winnerChar.hp + hpRoll, newMaxHp) : winnerChar.hp,
          })
          .eq('twitch_username', attackerName)

        await upsertDuelStat(attackerName, winnerChar.display_name, true)
        await upsertDuelStat(defenderName, loserChar.display_name, false)

        const levelMsg = leveledUp ? ` 🎉 LEVEL UP! Now Level ${newLevel}!` : ''

        client.say(
          channel,
          `⚔️ ${hitMsg} ` +
          `🏆 @${attackerName} wins the duel! +${XP_REWARD} XP!${levelMsg} ` +
          `@${defenderName} is defeated and left at 0 HP — use !rest to recover.`
        )
      }

      return
    }

    // Round continues — post result and swap turns
    client.say(
      channel,
      `⚔️ Round ${round} — ${hitMsg} ` +
      `[@${challenger} HP: ${duel.challengerHp} | @${target} HP: ${duel.targetHp}]`
    )

    const temp = attackerName
    attackerName = defenderName
    defenderName = temp
    round++
  }
}

async function upsertDuelStat(username: string, displayName: string, won: boolean): Promise<void> {
  const { data: existing } = await supabase
    .from('duel_stats')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (existing) {
    await supabase
      .from('duel_stats')
      .update({
        wins: won ? existing.wins + 1 : existing.wins,
        losses: won ? existing.losses : existing.losses + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)
  } else {
    await supabase.from('duel_stats').insert({
      twitch_username: username,
      display_name: displayName,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
    })
  }
}