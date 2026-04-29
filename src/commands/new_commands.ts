// ============================================================
// ZulkirBot: New Broadcaster & Special Commands
// ============================================================
// Commands in this file:
//   Broadcaster only:
//     !layonhands, !inspiration, !feeblemind, !polymorph
//     !tasha, !scry, !deathward, !heroesfeast
//     !critical, !fumble, !advantage, !disadvantage
//     !beholder, !identify
//   Broadcaster only (deck):
//     !deckofmany, !tarokka (also findable via !explore)
// ============================================================

import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { calculateLevel } from '../game/engine'
import { d20, d8, d6, d4, d100 } from '../game/dice'

// ------------------------------------------------------------
// In-memory state
// ------------------------------------------------------------

// deathward: username → true (clears on bot restart)
export const deathwardedPlayers = new Map<string, boolean>()

// feeblemind: username → expiry timestamp
export const feeblemindedPlayers = new Map<string, number>()

// polymorph: username → expiry timestamp
export const polymorphedPlayers = new Map<string, number>()

// tasha: username → expiry timestamp
export const tashaPlayers = new Map<string, number>()

// heroesfeast: username → expiry timestamp
export const heroesfeastPlayers = new Map<string, number>()

// inspiration: username → true (consumed on next fight)
export const inspiredPlayers = new Map<string, boolean>()

// critical: username → true (consumed on next action)
export const criticalPlayers = new Map<string, boolean>()

// fumble: username → true (consumed on next action)
export const fumblePlayers = new Map<string, boolean>()

// advantage: username → true (consumed on next action)
export const advantagePlayers = new Map<string, boolean>()

// disadvantage: username → true (consumed on next action)
export const disadvantagePlayers = new Map<string, boolean>()

// euryale: username → penalty (permanent, stored in DB via consequence flag)
// checked via DB, not in-memory

// ------------------------------------------------------------
// Helper: check if player is locked
// ------------------------------------------------------------

export function isFeebleminded(username: string): boolean {
  const expiry = feeblemindedPlayers.get(username)
  if (!expiry) return false
  if (Date.now() > expiry) { feeblemindedPlayers.delete(username); return false }
  return true
}

export function isPolymorphed(username: string): boolean {
  const expiry = polymorphedPlayers.get(username)
  if (!expiry) return false
  if (Date.now() > expiry) { polymorphedPlayers.delete(username); return false }
  return true
}

export function isTashaed(username: string): boolean {
  const expiry = tashaPlayers.get(username)
  if (!expiry) return false
  if (Date.now() > expiry) { tashaPlayers.delete(username); return false }
  return true
}

export function hasHeroesFeast(username: string): boolean {
  const expiry = heroesfeastPlayers.get(username)
  if (!expiry) return false
  if (Date.now() > expiry) { heroesfeastPlayers.delete(username); return false }
  return true
}

// ------------------------------------------------------------
// !layonhands [user] [amount]
// Broadcaster heals a target for a specified amount
// ------------------------------------------------------------

export const layonhandsCommand: BotCommand = {
  name: 'layonhands',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !layonhands [user] [amount]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()
    const amount = parseInt(args[1], 10)

    if (isNaN(amount) || amount <= 0) {
      client.say(channel, `@${username} — amount must be a positive number.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('hp, max_hp, display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const healed = Math.min(amount, char.max_hp - char.hp)
    const newHp = char.hp + healed

    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', target)

    client.say(channel,
      `🙏 The dungeon master places a hand on @${target}. ` +
      `Divine warmth flows through them. +${healed} HP. ` +
      `(${newHp}/${char.max_hp} HP)`
    )
  }
}

// ------------------------------------------------------------
// !inspiration [user]
// Grants guaranteed crit on next fight: natural 20, x2 damage, +d8
// ------------------------------------------------------------

export const inspirationCommand: BotCommand = {
  name: 'inspiration',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !inspiration [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    inspiredPlayers.set(target, true)

    client.say(channel,
      `✨ @${target} feels the bardic spark ignite! ` +
      `Their next attack is blessed — natural 20, double damage, +d8 bonus. ` +
      `Don't waste it.`
    )
  }
}

// ------------------------------------------------------------
// !feeblemind [user]
// Locks all commands for 2 minutes
// ------------------------------------------------------------

export const feeblemindCommand: BotCommand = {
  name: 'feeblemind',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !feeblemind [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const expiry = Date.now() + 2 * 60 * 1000
    feeblemindedPlayers.set(target, expiry)

    client.say(channel,
      `🧠 @${target} is sitting on the ground, drooling. ` +
      `Their Intelligence has dropped to 1. All commands locked for 2 minutes.`
    )
  }
}

// ------------------------------------------------------------
// !polymorph [user]
// Locks all game commands for 5 minutes
// ------------------------------------------------------------

export const polymorphCommand: BotCommand = {
  name: 'polymorph',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !polymorph [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const expiry = Date.now() + 5 * 60 * 1000
    polymorphedPlayers.set(target, expiry)

    client.say(channel,
      `🐑 The dungeon master wiggles their fingers and chants nonsense! ` +
      `@${target} suddenly feels very woolly and has a sudden craving for grass. ` +
      `They are now a sheep for 5 minutes. All game commands locked.`
    )
  }
}

// ------------------------------------------------------------
// !tasha [user]
// Locks all game commands for 2 minutes with flavor on every attempt
// ------------------------------------------------------------

export const tashaCommand: BotCommand = {
  name: 'tasha',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !tasha [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const expiry = Date.now() + 2 * 60 * 1000
    tashaPlayers.set(target, expiry)

    client.say(channel,
      `😂 Tasha's Hideous Laughter washes over @${target}! ` +
      `They collapse into uncontrollable giggles. All commands locked for 2 minutes. ` +
      `Every attempt will only make it worse.`
    )
  }
}

// Message to send when a tashaed player tries a command
export const TASHA_MESSAGES = [
  `@{username} tries to act but dissolves into laughter. The floor is very interesting right now.`,
  `@{username} opens their mouth to speak. Only giggling comes out.`,
  `@{username} attempts something heroic. Their body refuses. The laughter is in control.`,
  `@{username} reaches for their weapon. Their hand is shaking too hard. Still laughing.`,
  `@{username} has thoughts. Important thoughts. They cannot stop laughing long enough to act on them.`,
]

export function getTashaMessage(username: string): string {
  const msg = TASHA_MESSAGES[Math.floor(Math.random() * TASHA_MESSAGES.length)]
  return msg.replace('{username}', username)
}

// ------------------------------------------------------------
// !scry [user]
// Reveals HP, gold, level, class, kill count in flavor text
// ------------------------------------------------------------

export const scryCommand: BotCommand = {
  name: 'scry',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !scry [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name, class, level, hp, max_hp, gold, kill_count')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — the crystal ball finds nothing. ${target} has no character.`)
      return
    }

    client.say(channel,
      `🔮 The crystal ball clouds, then clears. ` +
      `${char.display_name} — Level ${char.level} ${char.class}. ` +
      `HP: ${char.hp}/${char.max_hp}. Gold: ${char.gold}gp. ` +
      `Kills: ${char.kill_count ?? 0}. ` +
      `The ball goes dark. It has seen enough.`
    )
  }
}

// ------------------------------------------------------------
// !deathward [user]
// Next time player hits 0 HP they stay at 1 HP instead
// Clears on bot restart
// ------------------------------------------------------------

export const deathwardCommand: BotCommand = {
  name: 'deathward',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !deathward [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    deathwardedPlayers.set(target, true)

    client.say(channel,
      `🛡️ A shimmering barrier settles around @${target}. ` +
      `The next time death reaches for them, it will find nothing to take. ` +
      `Death Ward active until the stream ends.`
    )
  }
}

// ------------------------------------------------------------
// !heroesfeast
// All players in active fights get +50% XP and gold on next fight
// Expires after 10 minutes
// ------------------------------------------------------------

export const heroesfeastCommand: BotCommand = {
  name: 'heroesfeast',
  handler: async (channel, username, _args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    // Import activeFights to find who is currently in a fight
    const { activeFights } = await import('../game/engine')
    const expiry = Date.now() + 10 * 60 * 1000
    const affected: string[] = []

    for (const [player] of activeFights) {
      heroesfeastPlayers.set(player, expiry)
      affected.push(`@${player}`)
    }

    if (affected.length === 0) {
      client.say(channel,
        `🍖 A Heroes' Feast appears — but no one is currently in a fight to benefit. ` +
        `The food disappears. The dungeon master sighs.`
      )
      return
    }

    client.say(channel,
      `🍖 Heroes' Feast! A magnificent spread appears before the party! ` +
      `${affected.join(', ')} — +50% XP and gold on their next fight. ` +
      `The feast lasts 10 minutes.`
    )
  }
}

// ------------------------------------------------------------
// !critical [user]
// Next action by target is an automatic critical hit
// ------------------------------------------------------------

export const criticalCommand: BotCommand = {
  name: 'critical',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !critical [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()
    criticalPlayers.set(target, true)

    client.say(channel,
      `⚔️ The dice are loaded. @${target}'s next action is fated to succeed — ` +
      `automatic critical hit, no questions asked.`
    )
  }
}

// ------------------------------------------------------------
// !fumble [user]
// Next action by target is an automatic fumble
// ------------------------------------------------------------

export const fumbleCommand: BotCommand = {
  name: 'fumble',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !fumble [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()
    fumblePlayers.set(target, true)

    client.say(channel,
      `🎲 The dice have spoken — poorly. @${target}'s next action is doomed to fail. ` +
      `Spectacularly.`
    )
  }
}

// ------------------------------------------------------------
// !advantage [user]
// Next action by target rolls with advantage (two rolls, take higher)
// ------------------------------------------------------------

export const advantageCommand: BotCommand = {
  name: 'advantage',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !advantage [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    // Remove disadvantage if active
    disadvantagePlayers.delete(target)
    advantagePlayers.set(target, true)

    client.say(channel,
      `🎯 Fortune favors @${target}. Advantage on their next action — roll twice, take the higher.`
    )
  }
}

// ------------------------------------------------------------
// !disadvantage [user]
// Next action by target rolls with disadvantage (two rolls, take lower)
// ------------------------------------------------------------

export const disadvantageCommand: BotCommand = {
  name: 'disadvantage',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !disadvantage [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    // Remove advantage if active
    advantagePlayers.delete(target)
    disadvantagePlayers.set(target, true)

    client.say(channel,
      `💀 The odds turn against @${target}. Disadvantage on their next action — roll twice, take the lower.`
    )
  }
}

// ------------------------------------------------------------
// !identify [user]
// Reveals kill count in flavor text
// ------------------------------------------------------------

export const identifyCommand: BotCommand = {
  name: 'identify',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !identify [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name, kill_count, class')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const killCount = char.kill_count ?? 0
    const tone = killCount === 0
      ? `They have not killed anything. The dungeon finds this suspicious.`
      : killCount < 10
        ? `${killCount} kills. Just getting started. The dungeon is watching.`
        : killCount < 50
          ? `${killCount} kills. A capable adventurer. Leave them alone in a room and things die.`
          : killCount < 100
            ? `${killCount} kills. The monsters have started drawing straws to avoid this one.`
            : `${killCount} kills. The dungeon has filed a formal complaint.`

    client.say(channel,
      `🔍 Identify reveals a hidden truth about @${target} (${char.class}): ${tone}`
    )
  }
}

// ------------------------------------------------------------
// !beholder [user]
// Fires a random eye ray at target
// ------------------------------------------------------------

const BEHOLDER_RAYS = [
  'sleep',
  'enervation',
  'disintegration',
  'charm',
  'fear',
  'slow',
  'petrification',
  'death',
  'telekinesis',
  'antimagic',
]

export const beholderCommand: BotCommand = {
  name: 'beholder',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !beholder [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('hp, max_hp, gold, display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    const ray = BEHOLDER_RAYS[Math.floor(Math.random() * BEHOLDER_RAYS.length)]

    switch (ray) {
      case 'sleep': {
        // 10 second timeout — requires bot to be moderator
        try {
          await client.timeout(channel, target, 10, 'Beholder Sleep Ray')
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Its sleep ray locks onto @${target}! ` +
            `They crumple to the ground mid-sentence. 10 second timeout.`
          )
        } catch {
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Its sleep ray locks onto @${target}! ` +
            `They feel very drowsy. (Timeout failed — is ZulkirBot a moderator?)`
          )
        }
        break
      }
      case 'enervation': {
        const drain = Math.floor(char.hp / 2)
        const newHp = Math.max(1, char.hp - drain)
        await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', target)
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Enervation ray strikes @${target}! ` +
          `Life force drains away. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
        )
        break
      }
      case 'disintegration': {
        // Delete common unequipped items only
        const { data: items } = await supabase
          .from('inventory')
          .select('id, item_name')
          .eq('twitch_username', target)
          .eq('rarity', 'common')
          .eq('is_equipped', false)

        if (items && items.length > 0) {
          const ids = items.map(i => i.id)
          await supabase.from('inventory').delete().in('id', ids)
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Disintegration ray hits @${target}'s pack! ` +
            `${items.length} common item${items.length > 1 ? 's' : ''} reduced to dust. ` +
            `Better items survived. Barely.`
          )
        } else {
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Disintegration ray hits @${target}'s pack! ` +
            `Nothing common enough to destroy. The beholder is mildly impressed.`
          )
        }
        break
      }
      case 'charm': {
        // Flavor only — no mechanical effect
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Charm ray washes over @${target}! ` +
          `They suddenly find the beholder extremely reasonable and good-looking. ` +
          `This feeling will pass. Probably.`
        )
        break
      }
      case 'fear': {
        // Lock commands for 1 minute
        const expiry = Date.now() + 60 * 1000
        feeblemindedPlayers.set(target, expiry)
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Fear ray hits @${target}! ` +
          `They drop everything and back into a corner. All commands locked for 1 minute.`
        )
        break
      }
      case 'slow': {
        // Double cooldowns for next 2 minutes — flavor message, no mechanical hook yet
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Slow ray catches @${target}! ` +
          `Everything they do takes twice as long. Time is a flat circle right now.`
        )
        break
      }
      case 'petrification': {
        // Lock commands for 3 minutes
        const expiry = Date.now() + 3 * 60 * 1000
        polymorphedPlayers.set(target, expiry)
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Petrification ray strikes @${target}! ` +
          `They are now a very lifelike statue. All commands locked for 3 minutes.`
        )
        break
      }
      case 'death': {
        // Set HP to 1 — dramatic but not permadeath
        await supabase.from('characters').update({ hp: 1 }).eq('twitch_username', target)
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Death ray zeroes in on @${target}! ` +
          `The universe briefly considered removing them from it. ` +
          `They survive — barely. 1 HP remaining. Use !rest immediately.`
        )
        break
      }
      case 'telekinesis': {
        // Drain a random amount of gold
        const goldDrain = Math.floor(char.gold * 0.20)
        if (goldDrain > 0) {
          await supabase.from('characters').update({ gold: char.gold - goldDrain }).eq('twitch_username', target)
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Telekinesis ray hits @${target}'s coin purse! ` +
            `${goldDrain}gp flies across the room and into the beholder's... it doesn't have hands. ` +
            `The gold is just gone.`
          )
        } else {
          client.say(channel,
            `👁️ A BEHOLDER APPEARS! Telekinesis ray targets @${target}'s coin purse. ` +
            `Nothing to take. The beholder is offended.`
          )
        }
        break
      }
      case 'antimagic': {
        // Remove all active buffs for target
        inspiredPlayers.delete(target)
        criticalPlayers.delete(target)
        advantagePlayers.delete(target)
        heroesfeastPlayers.delete(target)
        deathwardedPlayers.delete(target)
        client.say(channel,
          `👁️ A BEHOLDER APPEARS! Antimagic ray sweeps over @${target}! ` +
          `Every buff, ward, and magical advantage they had dissolves instantly. ` +
          `The beholder blinks. All ten eyes. Simultaneously.`
        )
        break
      }
    }
  }
}

// ------------------------------------------------------------
// Deck of Many Things / Tarokka
// Canonical 22-card deck
// ------------------------------------------------------------

interface DeckCard {
  name: string
  flavor: string
  effect: (channel: string, target: string, client: any, supabase: any) => Promise<void>
}

const DECK_OF_MANY_THINGS: DeckCard[] = [
  {
    name: 'The Vizier',
    flavor: 'Knowledge is power. The card reveals one truth.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('kill_count, level, class').eq('twitch_username', target).single()
      if (!char) return
      client.say(channel, `🃏 THE VIZIER — @${target} receives a vision of clarity. Level ${char.level} ${char.class}, ${char.kill_count ?? 0} kills. The card has spoken.`)
    }
  },
  {
    name: 'The Sun',
    flavor: 'Radiance and power. A boon beyond measure.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('xp, level').eq('twitch_username', target).single()
      if (!char) return
      const { calculateLevel } = await import('../game/engine')
      const bonusXp = 5000
      const { newLevel, newXpTotal } = calculateLevel(char.xp + bonusXp)
      await supabase.from('characters').update({ xp: newXpTotal, level: newLevel }).eq('twitch_username', target)
      client.say(channel, `🃏 THE SUN — @${target} is bathed in radiant power! +5000 XP! ${newLevel > char.level ? `LEVEL UP to ${newLevel}!` : ''}`)
    }
  },
  {
    name: 'The Moon',
    flavor: 'Wishes granted. Three times.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', target).single()
      if (!char) return
      const bonus = 1000
      await supabase.from('characters').update({ gold: char.gold + bonus }).eq('twitch_username', target)
      client.say(channel, `🃏 THE MOON — @${target} is granted a wish! +1000g materializes from moonlight.`)
    }
  },
  {
    name: 'The Star',
    flavor: 'An ability score increases permanently.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('max_hp, hp').eq('twitch_username', target).single()
      if (!char) return
      await supabase.from('characters').update({ max_hp: char.max_hp + 20, hp: char.hp + 20 }).eq('twitch_username', target)
      client.say(channel, `🃏 THE STAR — @${target}'s potential expands. Permanent +20 max HP.`)
    }
  },
  {
    name: 'The Comet',
    flavor: 'Defeat the next enemy alone and gain power beyond imagining.',
    effect: async (channel, target, client, _supabase) => {
      criticalPlayers.set(target, true)
      inspiredPlayers.set(target, true)
      client.say(channel, `🃏 THE COMET — @${target} is marked by the heavens. Next fight: guaranteed critical hit AND bardic inspiration. Do not waste this.`)
    }
  },
  {
    name: 'The Throne',
    flavor: 'Leadership and authority. A title is yours.',
    effect: async (channel, target, client, supabase) => {
      await supabase.from('player_titles').upsert(
        { username: target, title: 'Chosen of the Deck', source: 'deck-of-many-things' },
        { onConflict: 'username,title', ignoreDuplicates: true }
      )
      client.say(channel, `🃏 THE THRONE — @${target} is granted authority. Title earned: [Chosen of the Deck].`)
    }
  },
  {
    name: 'The Key',
    flavor: 'A rare weapon appears, perfectly suited to your hand.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('id').eq('twitch_username', target).single()
      if (!char) return
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: 'Key of Fate',
        item_type: 'weapon',
        rarity: 'legendary',
        stat_bonus: 6,
        description: 'Pulled from the Deck of Many Things. It opened something. No one is sure what.',
      })
      client.say(channel, `🃏 THE KEY — @${target} finds a legendary weapon in their hand. The Key of Fate (+6). Use it well.`)
    }
  },
  {
    name: 'The Knight',
    flavor: 'A fighter of great skill enters your service.',
    effect: async (channel, target, client, _supabase) => {
      inspiredPlayers.set(target, true)
      client.say(channel, `🃏 THE KNIGHT — @${target} is joined by a spectral warrior. Bardic Inspiration granted. The knight fights with them on their next action.`)
    }
  },
  {
    name: 'The Gem',
    flavor: 'Wealth beyond dreams flows into your hands.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', target).single()
      if (!char) return
      const bonus = 2500
      await supabase.from('characters').update({ gold: char.gold + bonus }).eq('twitch_username', target)
      client.say(channel, `🃏 THE GEM — @${target}'s pockets fill with gold. +2500g. Spend it before the deck changes its mind.`)
    }
  },
  {
    name: 'The Talons',
    flavor: 'Magic items lose their power.',
    effect: async (channel, target, client, supabase) => {
      // Remove stat bonuses from all equipped items
      await supabase.from('inventory').update({ stat_bonus: 0 }).eq('twitch_username', target).eq('is_equipped', true)
      client.say(channel, `🃏 THE TALONS — @${target}'s equipped items lose their enchantments. Stat bonuses stripped to zero. The magic is gone.`)
    }
  },
  {
    name: 'The Jester',
    flavor: 'Gain XP or draw two more cards.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('xp, level').eq('twitch_username', target).single()
      if (!char) return
      const { calculateLevel } = await import('../game/engine')
      const bonus = 1000
      const { newLevel, newXpTotal } = calculateLevel(char.xp + bonus)
      await supabase.from('characters').update({ xp: newXpTotal, level: newLevel }).eq('twitch_username', target)
      client.say(channel, `🃏 THE JESTER — @${target} laughs at fate. +1000 XP. ${newLevel > char.level ? `Level up to ${newLevel}!` : ''} The jester could have been worse. Could have been better.`)
    }
  },
  {
    name: 'The Fool',
    flavor: 'Lose XP and draw again.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('xp, level').eq('twitch_username', target).single()
      if (!char) return
      const { calculateLevel } = await import('../game/engine')
      const newXp = Math.max(0, char.xp - 500)
      const { newLevel, newXpTotal } = calculateLevel(newXp)
      await supabase.from('characters').update({ xp: newXpTotal, level: newLevel }).eq('twitch_username', target)
      client.say(channel, `🃏 THE FOOL — @${target} has been made a fool. -500 XP. ${newLevel < char.level ? `De-leveled to ${newLevel}.` : ''} The deck laughs.`)
    }
  },
  {
    name: 'The Idiot',
    flavor: 'Intelligence reduced permanently.',
    effect: async (channel, target, client, supabase) => {
      const expiry = Date.now() + 5 * 60 * 1000
      feeblemindedPlayers.set(target, expiry)
      client.say(channel, `🃏 THE IDIOT — @${target}'s mind empties. All commands locked for 5 minutes. The card is not sorry.`)
    }
  },
  {
    name: 'The Ruin',
    flavor: 'All nonmagical wealth is lost.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', target).single()
      if (!char) return
      const lost = char.gold
      await supabase.from('characters').update({ gold: 0 }).eq('twitch_username', target)
      client.say(channel, `🃏 THE RUIN — @${target}'s wealth crumbles to nothing. ${lost}gp gone. All of it. The Ruin is thorough.`)
    }
  },
  {
    name: 'Euryale',
    flavor: 'A snake-haired medusa curses you. -2 to all saving throws permanently.',
    effect: async (channel, target, client, supabase) => {
      // Store as consequence flag for permanent -2 attack penalty
      await supabase.from('player_consequence_flags').upsert({
        username: target,
        flag_type: 'euryale_cursed',
        is_active: true,
        source_campaign_slug: 'deck-of-many-things',
        euryale_attack_penalty: 2,
      }, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
      client.say(channel, `🃏 EURYALE — @${target} meets the gaze of Euryale. Permanent -2 to all attack rolls. The curse does not expire.`)
    }
  },
  {
    name: 'The Rogue',
    flavor: 'One ally becomes your enemy.',
    effect: async (channel, target, client, supabase) => {
      // Trigger automatic duel challenge — find a random online player
      const { data: players } = await supabase
        .from('characters')
        .select('twitch_username')
        .neq('twitch_username', target)
        .eq('is_dead', false)
        .gt('hp', 0)
        .limit(20)

      if (!players || players.length === 0) {
        // No valid target — drain gold instead
        const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', target).single()
        if (char && char.gold > 0) {
          const drain = Math.floor(char.gold * 0.30)
          await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', target)
          client.say(channel, `🃏 THE ROGUE — @${target}'s ally turns on them. No one to duel. ${drain}gp stolen in the betrayal instead.`)
        }
        return
      }

      const victim = players[Math.floor(Math.random() * players.length)]
      client.say(channel,
        `🃏 THE ROGUE — @${target}'s closest ally has turned against them! ` +
        `@${victim.twitch_username} is now their enemy! A duel is forced — ` +
        `@${victim.twitch_username}, type !accept to fight or the card chooses for you.`
      )
    }
  },
  {
    name: 'The Balance',
    flavor: 'Your alignment changes. Lose XP equal to the next level threshold.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('xp, level').eq('twitch_username', target).single()
      if (!char) return
      const { calculateLevel } = await import('../game/engine')
      // Find XP needed for next level
      const { data: xpRow } = await supabase
        .from('xp_table')
        .select('xp_required')
        .eq('level', char.level + 1)
        .single()
      const threshold = xpRow?.xp_required ?? 1000
      const newXp = Math.max(0, char.xp - threshold)
      const { newLevel, newXpTotal } = calculateLevel(newXp)
      await supabase.from('characters').update({ xp: newXpTotal, level: newLevel }).eq('twitch_username', target)
      client.say(channel,
        `🃏 THE BALANCE — @${target}'s alignment shifts. ` +
        `The scales demand payment: -${threshold} XP. ` +
        `${newLevel < char.level ? `De-leveled to ${newLevel}.` : ''} The Balance is satisfied.`
      )
    }
  },
  {
    name: 'The Skull',
    flavor: 'A Death avatar appears. Defeat it or die.',
    effect: async (channel, target, client, supabase) => {
      client.say(channel,
        `🃏 THE SKULL — @${target} has drawn death itself. ` +
        `A Death avatar materializes before them. ` +
        `They must fight alone. Use !attack — if they fall, it is permanent.`
      )
      // Spawn a boss-tier death avatar fight
      const { startFight } = await import('../game/engine')
      const deathAvatar = {
        name: 'Death Avatar',
        title: 'Herald of the Skull',
        hp: 200,
        attack: 18,
        defense: 15,
        xp_reward: 3000,
        gold_reward: 500,
        loot_chance: 50,
        deathMessage: 'was claimed by the Death Avatar, Herald of the Skull',
        tier: 5,
      }
      await startFight(channel, target, client, deathAvatar)
    }
  },
  {
    name: 'The Flames',
    flavor: 'A powerful devil becomes your enemy.',
    effect: async (channel, target, client, supabase) => {
      const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', target).single()
      if (!char) return
      const goldDrain = Math.floor(char.gold * 0.40)
      const hpDrain = Math.floor(char.max_hp * 0.20)
      const newHp = Math.max(1, char.hp - hpDrain)
      const newGold = Math.max(0, char.gold - goldDrain)
      await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', target)
      client.say(channel,
        `🃏 THE FLAMES — @${target} has made an enemy in the Nine Hells. ` +
        `A devil's mark burns into them. -${hpDrain} HP, -${goldDrain}gp. ` +
        `It will collect again.`
      )
    }
  },
  {
    name: 'The Fates',
    flavor: 'Avoid or erase one event. Roll d100.',
    effect: async (channel, target, client, supabase) => {
      const roll = Math.floor(Math.random() * 100) + 1
      if (roll <= 50) {
        // Clear most recent active consequence flag
        const { data: flags } = await supabase
          .from('player_consequence_flags')
          .select('id, flag_type')
          .eq('username', target)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)

        if (flags && flags.length > 0) {
          await supabase.from('player_consequence_flags').update({ is_active: false, resolved_at: new Date().toISOString() }).eq('id', flags[0].id)
          client.say(channel, `🃏 THE FATES (${roll}/100) — @${target}'s most recent consequence is erased. [${flags[0].flag_type}] removed from the record. The Fates are merciful today.`)
        } else {
          client.say(channel, `🃏 THE FATES (${roll}/100) — @${target} has no active consequences to erase. The Fates shrug.`)
        }
      } else {
        // Reverse last campaign outcome — clear all consequences from last campaign
        const { data: flags } = await supabase
          .from('player_consequence_flags')
          .select('id, source_campaign_slug')
          .eq('username', target)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)

        if (flags && flags.length > 0) {
          const slug = flags[0].source_campaign_slug
          await supabase.from('player_consequence_flags').update({ is_active: false, resolved_at: new Date().toISOString() }).eq('username', target).eq('source_campaign_slug', slug).eq('is_active', true)
          client.say(channel, `🃏 THE FATES (${roll}/100) — @${target}'s last campaign outcome is reversed. All consequences from [${slug}] cleared. The Fates have rewritten history.`)
        } else {
          client.say(channel, `🃏 THE FATES (${roll}/100) — @${target} has no campaign consequences to reverse. The Fates find nothing to rewrite.`)
        }
      }
    }
  },
  {
    name: 'The Void',
    flavor: 'Your soul is imprisoned. Your body remains, an empty shell.',
    effect: async (channel, target, client, supabase) => {
      // Permadeath — move to graveyard
      const { data: char } = await supabase.from('characters').select('*').eq('twitch_username', target).single()
      if (!char) return
      await supabase.from('graveyard').insert({
        twitch_username: char.twitch_username,
        display_name: char.display_name,
        class: char.class,
        level: char.level,
        xp: char.xp,
        cause_of_death: 'Soul claimed by The Void — Deck of Many Things',
      })
      await supabase.from('characters').delete().eq('twitch_username', target)
      client.say(channel,
        `🃏 THE VOID — @${target}'s soul has been torn from their body and imprisoned in the Void. ` +
        `Their character is gone. Their body wanders the dungeon, empty. ` +
        `Use !join to create a new character. The Void does not negotiate.`
      )
    }
  },
  {
    name: 'Donjon',
    flavor: 'You are imprisoned. In an SSG hair dye factory.',
    effect: async (channel, target, client, supabase) => {
      // Same as Void but with hair dye flavor
      const { data: char } = await supabase.from('characters').select('*').eq('twitch_username', target).single()
      if (!char) return
      await supabase.from('graveyard').insert({
        twitch_username: char.twitch_username,
        display_name: char.display_name,
        class: char.class,
        level: char.level,
        xp: char.xp,
        cause_of_death: 'Imprisoned in the Donjon — an SSG hair dye factory',
      })
      await supabase.from('characters').delete().eq('twitch_username', target)
      client.say(channel,
        `🃏 DONJON — @${target} is imprisoned. Not in a dungeon. Not in a plane of torment. ` +
        `In an SSG hair dye factory, where they will spend eternity sorting Cerulean Regret from Ashen Mediocrity. ` +
        `Their character is gone. Use !join to start over. ` +
        `The factory thanks them for their service.`
      )
    }
  },
]

async function drawCard(
  channel: string,
  target: string,
  client: any,
  supabaseClient: any
): Promise<void> {
  const card = DECK_OF_MANY_THINGS[Math.floor(Math.random() * DECK_OF_MANY_THINGS.length)]

  client.say(channel,
    `🃏 @${target} draws from the Deck of Many Things... ` +
    `The card is revealed: ${card.name.toUpperCase()}. "${card.flavor}"`
  )

  await new Promise(r => setTimeout(r, 2000))
  await card.effect(channel, target, client, supabaseClient)
}

export const deckofmanyCommand: BotCommand = {
  name: 'deckofmany',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !deckofmany [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    await drawCard(channel, target, client, supabase)
  }
}

export const tarokkaCommand: BotCommand = {
  name: 'tarokka',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !tarokka [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('display_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    client.say(channel,
      `🎴 @${target} sits across from a Vistani fortune teller. ` +
      `The Tarokka deck is shuffled. A card is drawn...`
    )

    await new Promise(r => setTimeout(r, 2000))
    await drawCard(channel, target, client, supabase)
  }
}

// Export draw function for use in explore.ts
export { drawCard }