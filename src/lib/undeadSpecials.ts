import { supabase } from './supabase'
import { UndeadSpecial } from '../types'

// In-memory state for temporary effects that last one fight
export const paralyzedPlayers = new Map<string, number>() // username → turns remaining
export const fearedPlayers = new Map<string, number>()    // username → turns remaining
export const diseasedPlayers = new Map<string, { ticksRemaining: number; damagePerTick: number }>()

export function isParalyzed(username: string): boolean {
  const turns = paralyzedPlayers.get(username) ?? 0
  if (turns <= 0) { paralyzedPlayers.delete(username); return false }
  return true
}

export function isFeared(username: string): boolean {
  const turns = fearedPlayers.get(username) ?? 0
  if (turns <= 0) { fearedPlayers.delete(username); return false }
  return true
}

export function tickParalysis(username: string): void {
  const turns = paralyzedPlayers.get(username) ?? 0
  if (turns <= 1) paralyzedPlayers.delete(username)
  else paralyzedPlayers.set(username, turns - 1)
}

export function tickFear(username: string): void {
  const turns = fearedPlayers.get(username) ?? 0
  if (turns <= 1) fearedPlayers.delete(username)
  else fearedPlayers.set(username, turns - 1)
}

export interface SpecialResult {
  message: string
  hpDrain: number
  goldDrain: number
  xpDrain: number
  skipTurn: boolean
}

export async function applyUndeadSpecial(
  username: string,
  specials: UndeadSpecial[],
  specialChance: number,
  char: { hp: number; max_hp: number; gold: number; xp: number; level: number }
): Promise<SpecialResult | null> {
  // Roll to see if a special fires
  const roll = Math.floor(Math.random() * 100) + 1
  if (roll > specialChance) return null

  // Pick one special at random if multiple
  const special = specials[Math.floor(Math.random() * specials.length)]

  switch (special) {
    case 'level_drain': {
      // Temporary XP drain — lose 10% of current XP, not a full de-level
      const drain = Math.floor(char.xp * 0.10)
      await supabase
        .from('characters')
        .update({ xp: Math.max(0, char.xp - drain) })
        .eq('twitch_username', username)
      return {
        message: `💀 LEVEL DRAIN — the undead's touch saps ${drain} XP from @${username}!`,
        hpDrain: 0,
        goldDrain: 0,
        xpDrain: drain,
        skipTurn: false,
      }
    }

    case 'disease': {
      // Disease ticks each fight — 3 ticks, d6 damage each
      const damagePerTick = Math.floor(Math.random() * 6) + 1
      diseasedPlayers.set(username, { ticksRemaining: 3, damagePerTick })
      return {
        message: `🤢 DISEASE — @${username} is infected! Takes ${damagePerTick} damage at the start of each fight for 3 fights!`,
        hpDrain: 0,
        goldDrain: 0,
        xpDrain: 0,
        skipTurn: false,
      }
    }

    case 'paralysis': {
      // Skip next 1 turn
      paralyzedPlayers.set(username, 1)
      return {
        message: `🧊 PARALYSIS — @${username} is frozen! They lose their next turn!`,
        hpDrain: 0,
        goldDrain: 0,
        xpDrain: 0,
        skipTurn: true,
      }
    }

    case 'fear': {
      // Skip next 1 turn
      fearedPlayers.set(username, 1)
      return {
        message: `😱 FEAR — @${username} is overcome with dread! They lose their next turn!`,
        hpDrain: 0,
        goldDrain: 0,
        xpDrain: 0,
        skipTurn: true,
      }
    }

    case 'gold_drain': {
      const drain = Math.floor(char.gold * 0.15)
      if (drain > 0) {
        await supabase
          .from('characters')
          .update({ gold: char.gold - drain })
          .eq('twitch_username', username)
      }
      return {
        message: `💸 GOLD DRAIN — the undead's curse siphons ${drain}g from @${username}!`,
        hpDrain: 0,
        goldDrain: drain,
        xpDrain: 0,
        skipTurn: false,
      }
    }

    case 'necrotic_fire': {
      // Death Knight only — half fire half necrotic, flat HP drain
      const fireDmg = Math.floor(Math.random() * 6) + 1
      const necroticDmg = Math.floor(Math.random() * 6) + 1
      const total = fireDmg + necroticDmg
      return {
        message: `🔥💀 NECROTIC FIRE — the Death Knight channels hellfire and necrotic energy! @${username} takes ${fireDmg} fire + ${necroticDmg} necrotic = ${total} damage!`,
        hpDrain: total,
        goldDrain: 0,
        xpDrain: 0,
        skipTurn: false,
      }
    }

    default:
      return null
  }
}

// Call at the start of each fight to tick disease
export async function tickDisease(
  username: string,
  currentHp: number,
  maxHp: number
): Promise<{ damage: number; message: string } | null> {
  const state = diseasedPlayers.get(username)
  if (!state) return null

  const damage = state.damagePerTick
  const newTicks = state.ticksRemaining - 1

  if (newTicks <= 0) {
    diseasedPlayers.delete(username)
  } else {
    diseasedPlayers.set(username, { ...state, ticksRemaining: newTicks })
  }

  await supabase
    .from('characters')
    .update({ hp: Math.max(1, currentHp - damage) })
    .eq('twitch_username', username)

  const ticksLeft = newTicks > 0 ? ` (${newTicks} tick${newTicks > 1 ? 's' : ''} remaining)` : ` (disease cured)`
  return {
    damage,
    message: `🤢 DISEASE ticks — @${username} takes ${damage} damage!${ticksLeft}`,
  }
}