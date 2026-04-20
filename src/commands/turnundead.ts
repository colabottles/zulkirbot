import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'

// ------------------------------------------------------------
// Eligible classes
// ------------------------------------------------------------

const TURN_UNDEAD_CLASSES = ['cleric', 'paladin', 'sacred_fist', 'dark_apostate']

// Classes that destroy undead (instant kill)
const DESTROY_CLASSES = ['cleric', 'sacred_fist', 'dark_apostate']

// Classes that cause undead to flee (fight ends, same XP reward)
const FLEE_CLASSES = ['paladin']

// ------------------------------------------------------------
// Undead CR table
// ------------------------------------------------------------

const UNDEAD_CR: Record<string, number> = {
  'Skeleton': 0.5,
  'Zombie': 0.5,
  'Shadow': 1,
  'Ghoul': 1,
  'Specter': 2,
  'Vampire Spawn': 3,
  'Banshee': 4,
  'Revenant': 4,
  'Vampire': 5,
  'Lich': 5,
  'Death Knight': 5,
}

// ------------------------------------------------------------
// CR threshold by player level
// ------------------------------------------------------------

function getCrThreshold(level: number): number {
  if (level >= 17) return 5
  if (level >= 14) return 4
  if (level >= 11) return 3
  if (level >= 8) return 2
  if (level >= 5) return 1
  return 0.5
}

// ------------------------------------------------------------
// Cooldown tracking — 2 minutes
// ------------------------------------------------------------

const turnUndeadCooldowns = new Map<string, number>()

export function resetTurnUndeadCooldown(username: string): void {
  turnUndeadCooldowns.delete(username)
}

// ------------------------------------------------------------
// !turnundead
// ------------------------------------------------------------

export const turnundeadCommand: BotCommand = {
  name: 'turnundead',
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('class, level, xp, gold, hp, max_hp')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet!`)
      return
    }

    if (!TURN_UNDEAD_CLASSES.includes(char.class)) {
      client.say(channel, `@${username} — only Clerics, Paladins, Sacred Fists, and Dark Apostates can turn undead.`)
      return
    }

    const fight = activeFights.get(username)
    if (!fight) {
      client.say(channel, `@${username} — you're not in a fight! Use !fight first.`)
      return
    }

    if (!fight.monster.is_undead) {
      client.say(channel, `@${username} — ${fight.monster.name} is not undead. Your divine power finds nothing to turn.`)
      return
    }

    // Cooldown check
    const lastUsed = turnUndeadCooldowns.get(username) ?? 0
    const cooldownMs = 2 * 60 * 1000
    const remaining = cooldownMs - (Date.now() - lastUsed)
    if (remaining > 0) {
      const secs = Math.ceil(remaining / 1000)
      client.say(channel, `@${username} — your divine power needs ${secs}s to recover.`)
      return
    }

    turnUndeadCooldowns.set(username, Date.now())

    // CR check
    const monsterCr = UNDEAD_CR[fight.monster.name] ?? 99
    const threshold = getCrThreshold(char.level)

    if (monsterCr > threshold) {
      // Failure — undead too powerful
      const flavorMessages: Record<string, string> = {
        'cleric': `@${username} raises their holy symbol — the ${fight.monster.name} recoils but does not break. It is too powerful to turn at this level.`,
        'paladin': `@${username} channels divine smite — the ${fight.monster.name} snarls but holds its ground. It will not flee.`,
        'sacred_fist': `@${username} focuses their ki — the ${fight.monster.name} shudders but the connection is not strong enough. It stands.`,
        'dark_apostate': `@${username} speaks the dark rites of command — the ${fight.monster.name} regards them with cold amusement. It will not obey.`,
      }
      client.say(channel, flavorMessages[char.class] ?? `@${username}'s turning attempt fails. The ${fight.monster.name} is too powerful.`)
      return
    }

    // Success — destroy or flee
    const xpReward = Math.floor(fight.monster.xp_reward * 0.5)
    activeFights.delete(username)

    await supabase
      .from('characters')
      .update({ xp: char.xp + xpReward })
      .eq('twitch_username', username)

    if (FLEE_CLASSES.includes(char.class)) {
      client.say(channel,
        `✝️ @${username} channels divine authority! The ${fight.monster.name} recoils from the holy light — ` +
        `it turns and FLEES into the darkness! +${xpReward} XP.`
      )
    } else {
      const destroyFlavor: Record<string, string> = {
        'cleric': `☀️ @${username} raises their holy symbol and speaks the name of their god! The ${fight.monster.name} writhes — then CRUMBLES TO ASH! +${xpReward} XP.`,
        'sacred_fist': `☯️ @${username} channels their ki through divine discipline! The ${fight.monster.name} screams as sacred energy tears it apart! +${xpReward} XP.`,
        'dark_apostate': `💀 @${username} speaks the rites of unmaking — turning the ${fight.monster.name}'s own dark power against it! It dissolves into nothing. +${xpReward} XP.`,
      }
      client.say(channel, destroyFlavor[char.class] ?? `✝️ @${username} destroys the ${fight.monster.name}! +${xpReward} XP.`)
    }
  }
}