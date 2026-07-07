import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import {
  getStronghold, getStrongholdRooms, getMaterials,
  getTierName
} from '../lib/stronghold'
import { d100 } from '../game/dice'

const SPY_SUCCESS_CLASSES = ['rogue', 'arcane_trickster']
const SPY_BASE_CHANCE = 60
const SPY_EXPERT_CHANCE = 85
const SPY_CAUGHT_CHANCE = 30

export const spyStrongholdCommand: BotCommand = {
  name: 'spy',
  cooldownSeconds: 30,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !spy [@username]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    if (target === username) {
      client.say(channel, `@${username} — you can't spy on yourself.`)
      return
    }

    // Spy must have a stronghold
    const spyStronghold = await getStronghold(username)
    if (!spyStronghold || spyStronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you need a stronghold before sending spies. ` +
        `Use !stronghold build to establish one.`
      )
      return
    }

    // Target must have a stronghold
    const targetStronghold = await getStronghold(target)
    if (!targetStronghold || targetStronghold.is_destroyed) {
      client.say(channel, `@${username} — ${target} doesn't have a stronghold to spy on.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('class')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const isExpert = SPY_SUCCESS_CLASSES.includes(char.class)
    const successChance = isExpert ? SPY_EXPERT_CHANCE : SPY_BASE_CHANCE
    const roll = d100()

    if (roll <= successChance) {
      // Success — reveal intel
      const rooms = await getStrongholdRooms(target)
      const mats = await getMaterials(target)
      const tierName = getTierName(targetStronghold.stronghold_type, targetStronghold.tier)

      const roomList = rooms.length > 0
        ? rooms.map((r: any) => `${r.room_type}${r.is_damaged ? ' (damaged)' : ''}`).join(', ')
        : 'none'

      const matList = Object.entries(mats)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ') || 'none'

      const expertMsg = isExpert
        ? 'Your spy slips in and out undetected.'
        : 'Your spy manages to gather some intel.'

      client.say(channel,
        `🕵️ @${username} — ${expertMsg} ` +
        `${target}'s ${tierName}: ` +
        `HP ${targetStronghold.hp}/${targetStronghold.max_hp} | ` +
        `ATK ${targetStronghold.attack} | ` +
        `DEF ${targetStronghold.defense} | ` +
        `Morale ${targetStronghold.morale} | ` +
        `Rooms: ${roomList} | ` +
        `Materials: ${matList}`
      )

    } else {
      // Failure — possible capture
      const caughtRoll = d100()

      if (caughtRoll <= SPY_CAUGHT_CHANCE) {
        // Spy caught — notify target, penalize spier
        const newMorale = Math.max(0, spyStronghold.morale - 10)
        await supabase
          .from('strongholds')
          .update({ morale: newMorale })
          .eq('twitch_username', username)

        client.say(channel,
          `🕵️ @${username} — your spy was caught infiltrating ${target}'s stronghold! ` +
          `-10 morale. (Morale: ${newMorale}) ` +
          `@${target} — a spy from @${username} was caught at your gates!`
        )

      } else {
        // Spy failed but not caught
        client.say(channel,
          `🕵️ @${username} — your spy couldn't find a way in. ` +
          `No intel gathered. ${target}'s defenses held.`
        )
      }
    }
  }
}