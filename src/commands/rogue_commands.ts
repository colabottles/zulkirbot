// ============================================================
// ZulkirBot: Rogue Skill Commands
// ============================================================
// !picklock   — Rogue, Arcane Trickster, Artificer
// !disabletrap — Rogue, Arcane Trickster, Ranger
// !findtraps  — Rogue, Arcane Trickster, Artificer
// !searchdoor — Rogue, Arcane Trickster, Ranger
//
// These commands are triggered by explore events and can also
// be used proactively. They do nothing outside of an active
// explore situation unless a pending event is stored.
// ============================================================

import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { d100, d6, d8, d20 } from '../game/dice'
import { rollLootByRarity } from '../game/loot'

// ------------------------------------------------------------
// Eligible classes
// ------------------------------------------------------------

export const PICKLOCK_CLASSES = ['rogue', 'arcane_trickster', 'artificer']
export const DISABLETRAP_CLASSES = ['rogue', 'arcane_trickster', 'ranger']
export const FINDTRAPS_CLASSES = ['rogue', 'arcane_trickster', 'artificer']
export const SEARCHDOOR_CLASSES = ['rogue', 'arcane_trickster', 'ranger']

// ------------------------------------------------------------
// Pending explore events
// A player can have one pending skill event at a time.
// Set by explore.ts, consumed by the skill command.
// ------------------------------------------------------------

export type RogueEvent =
  | 'locked_chest'
  | 'trapped_chest'
  | 'hidden_door'
  | 'suspicious_wall'
  | 'trapped_corridor'

export interface PendingRogueEvent {
  event: RogueEvent
  expiresAt: number // 3 minute window
}

export const pendingRogueEvents = new Map<string, PendingRogueEvent>()

export function setPendingEvent(username: string, event: RogueEvent): void {
  pendingRogueEvents.set(username, {
    event,
    expiresAt: Date.now() + 3 * 60 * 1000,
  })
}

export function getPendingEvent(username: string): PendingRogueEvent | null {
  const pending = pendingRogueEvents.get(username)
  if (!pending) return null
  if (Date.now() > pending.expiresAt) {
    pendingRogueEvents.delete(username)
    return null
  }
  return pending
}

export function clearPendingEvent(username: string): void {
  pendingRogueEvents.delete(username)
}

// ------------------------------------------------------------
// Success chance by class (base %)
// ------------------------------------------------------------

function getSuccessChance(charClass: string, command: string): number {
  switch (command) {
    case 'picklock':
      if (charClass === 'rogue') return 80
      if (charClass === 'arcane_trickster') return 70
      if (charClass === 'artificer') return 65
      return 20 // ineligible class attempting
    case 'disabletrap':
      if (charClass === 'rogue') return 80
      if (charClass === 'arcane_trickster') return 65
      if (charClass === 'ranger') return 60
      return 15
    case 'findtraps':
      if (charClass === 'rogue') return 90
      if (charClass === 'arcane_trickster') return 75
      if (charClass === 'artificer') return 70
      return 20
    case 'searchdoor':
      if (charClass === 'rogue') return 85
      if (charClass === 'arcane_trickster') return 70
      if (charClass === 'ranger') return 65
      return 20
    default:
      return 20
  }
}

// ------------------------------------------------------------
// !picklock
// ------------------------------------------------------------

export const picklockCommand: BotCommand = {
  name: 'picklock',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const pending = getPendingEvent(username)

    if (!pending || pending.event !== 'locked_chest') {
      if (!pending) {
        client.say(channel, `@${username} — there's nothing to pick right now. Use !explore to find something.`)
      } else {
        client.say(channel, `@${username} — that's not a lock. Try !findtraps, !disabletrap, or !searchdoor instead.`)
      }
      return
    }

    clearPendingEvent(username)

    const isEligible = PICKLOCK_CLASSES.includes(char.class)
    const chance = getSuccessChance(char.class, 'picklock')
    const roll = d100()

    if (roll <= chance) {
      // Success — rare or better loot + gold
      const rarityRoll = d100()
      const rarity = rarityRoll <= 15 ? 'legendary' : 'rare'
      const item = rollLootByRarity(rarity)
      const gold = d6() * 10

      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: item.name,
        item_type: item.type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description,
      })

      await supabase
        .from('characters')
        .update({ gold: char.gold + gold })
        .eq('twitch_username', username)

      const eligibleMsg = isEligible
        ? `The tumblers yield to @${username}'s practiced hands.`
        : `@${username} fumbles at the lock but somehow manages to open it anyway.`

      client.say(channel,
        `🔓 ${eligibleMsg} ` +
        `The chest opens! Found a ${rarity.toUpperCase()} ${item.name} and ${gold}gp!`
      )
    } else {
      // Failure — trap springs or lock holds
      const trapFires = d100() <= 40
      if (trapFires) {
        const damage = d6() * 2
        const newHp = Math.max(1, char.hp - damage)
        await supabase
          .from('characters')
          .update({ hp: newHp })
          .eq('twitch_username', username)

        client.say(channel,
          `💥 @${username} — the lock had a trap! A mechanism fires and deals ${damage} damage. ` +
          `(HP: ${newHp}/${char.max_hp}) The chest remains locked.`
        )
      } else {
        client.say(channel,
          `🔒 @${username} — the lock holds. The picks slip and the chest stays shut. ` +
          `The moment has passed.`
        )
      }
    }
  }
}

// ------------------------------------------------------------
// !disabletrap
// ------------------------------------------------------------

export const disabletrapCommand: BotCommand = {
  name: 'disabletrap',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const pending = getPendingEvent(username)

    if (!pending || (pending.event !== 'trapped_chest' && pending.event !== 'trapped_corridor')) {
      if (!pending) {
        client.say(channel, `@${username} — there's no trap here. Use !explore to find one.`)
      } else {
        client.say(channel, `@${username} — that's not a trap situation. Try !picklock, !findtraps, or !searchdoor.`)
      }
      return
    }

    clearPendingEvent(username)

    const isEligible = DISABLETRAP_CLASSES.includes(char.class)
    const chance = getSuccessChance(char.class, 'disabletrap')
    const roll = d100()

    if (roll <= chance) {
      // Success — trap disabled, small XP bonus
      const xpBonus = 50 + d6() * 10

      await supabase
        .from('characters')
        .update({ xp: char.xp + xpBonus })
        .eq('twitch_username', username)

      const eligibleMsg = isEligible
        ? `@${username} carefully dismantles the mechanism.`
        : `@${username} pokes at the trap until something important breaks.`

      // Trapped chest also yields loot on success
      if (pending.event === 'trapped_chest') {
        const item = rollLootByRarity('uncommon')
        const gold = d6() * 5

        await supabase.from('inventory').insert({
          character_id: char.id,
          item_name: item.name,
          item_type: item.type,
          rarity: item.rarity,
          stat_bonus: item.stat_bonus,
          description: item.description,
        })

        await supabase
          .from('characters')
          .update({ gold: char.gold + gold, xp: char.xp + xpBonus })
          .eq('twitch_username', username)

        client.say(channel,
          `🔧 ${eligibleMsg} Trap disabled! +${xpBonus} XP. ` +
          `The chest beneath it holds a ${item.rarity.toUpperCase()} ${item.name} and ${gold}gp!`
        )
      } else {
        client.say(channel,
          `🔧 ${eligibleMsg} The corridor is safe to pass. +${xpBonus} XP.`
        )
      }
    } else {
      // Failure — trap fires
      const damage = d8() * 2
      const newHp = Math.max(1, char.hp - damage)

      await supabase
        .from('characters')
        .update({ hp: newHp })
        .eq('twitch_username', username)

      client.say(channel,
        `💥 @${username} — the trap springs! ` +
        `${isEligible ? 'The mechanism was more complex than expected.' : 'Probably should have left that alone.'} ` +
        `${damage} damage taken. (HP: ${newHp}/${char.max_hp})`
      )
    }
  }
}

// ------------------------------------------------------------
// !findtraps
// ------------------------------------------------------------

export const findtrapsCommand: BotCommand = {
  name: 'findtraps',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const pending = getPendingEvent(username)

    if (!pending || (pending.event !== 'trapped_chest' && pending.event !== 'trapped_corridor')) {
      if (!pending) {
        client.say(channel, `@${username} — nothing suspicious here. Use !explore to search the dungeon.`)
      } else {
        client.say(channel, `@${username} — that's not a trap situation. Try !picklock or !searchdoor instead.`)
      }
      return
    }

    const isEligible = FINDTRAPS_CLASSES.includes(char.class)
    const chance = getSuccessChance(char.class, 'findtraps')
    const roll = d100()

    if (roll <= chance) {
      // Success — reveal the trap, player can now use !disabletrap with bonus
      // Keep the pending event but mark it as found (give disabletrap a bonus)
      client.say(channel,
        `🔍 @${username} — ${isEligible ? 'a careful sweep reveals' : 'blind luck reveals'} ` +
        `a hidden ${pending.event === 'trapped_chest' ? 'pressure plate beneath the chest' : 'tripwire across the corridor'}. ` +
        `Use !disabletrap to deal with it safely, or proceed at your own risk.`
      )
    } else {
      // Failure — finds nothing, event stays pending (trap still there)
      client.say(channel,
        `🔍 @${username} — ${isEligible ? 'nothing obvious jumps out, but something feels off.' : 'finds nothing. Seems fine.'}`
      )
    }
  }
}

// ------------------------------------------------------------
// !searchdoor
// ------------------------------------------------------------

export const searchdoorCommand: BotCommand = {
  name: 'searchdoor',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const pending = getPendingEvent(username)

    if (!pending || (pending.event !== 'hidden_door' && pending.event !== 'suspicious_wall')) {
      if (!pending) {
        client.say(channel, `@${username} — the walls look normal. Use !explore to find something unusual.`)
      } else {
        client.say(channel, `@${username} — that's not a door situation. Try !picklock, !findtraps, or !disabletrap.`)
      }
      return
    }

    clearPendingEvent(username)

    const isEligible = SEARCHDOOR_CLASSES.includes(char.class)
    const chance = getSuccessChance(char.class, 'searchdoor')
    const roll = d100()

    if (roll <= chance) {
      // Success — hidden passage leads to bonus loot cache
      const cacheRoll = d100()
      const gold = d6() * 15

      await supabase
        .from('characters')
        .update({ gold: char.gold + gold })
        .eq('twitch_username', username)

      let lootMsg = ''
      if (cacheRoll <= 30) {
        const item = rollLootByRarity('rare')
        await supabase.from('inventory').insert({
          character_id: char.id,
          item_name: item.name,
          item_type: item.type,
          rarity: item.rarity,
          stat_bonus: item.stat_bonus,
          description: item.description,
        })
        lootMsg = ` A ${item.rarity.toUpperCase()} ${item.name} sits on a stone shelf.`
      } else if (cacheRoll <= 70) {
        const item = rollLootByRarity('uncommon')
        await supabase.from('inventory').insert({
          character_id: char.id,
          item_name: item.name,
          item_type: item.type,
          rarity: item.rarity,
          stat_bonus: item.stat_bonus,
          description: item.description,
        })
        lootMsg = ` An ${item.rarity.toUpperCase()} ${item.name} was left behind by whoever used this passage last.`
      }

      const eligibleMsg = isEligible
        ? `@${username} runs a hand along the wall and finds the seam.`
        : `@${username} leans against the wall and it swings open.`

      client.say(channel,
        `🚪 ${eligibleMsg} A hidden passage! +${gold}gp found inside.${lootMsg}`
      )
    } else {
      client.say(channel,
        `🧱 @${username} — ${isEligible
          ? 'the wall is solid. Whatever pattern you thought you saw isn\'t there.'
          : 'it\'s just a wall. A very normal wall.'
        }`
      )
    }
  }
}