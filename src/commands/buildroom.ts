import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import {
  getStronghold, getStrongholdRooms, getMaterials,
  deductMaterials, recalculateStrongholdStats, getTierName
} from '../lib/stronghold'
import { ROOMS, TIER_ROOM_SLOTS, Material } from '../game/strongholdData'

export const buildroomCommand: BotCommand = {
  name: 'build',
  aliases: ['br'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      const roomList = Object.entries(ROOMS)
        .map(([key, def]) => `${key} (${def.goldCost}gp)`)
        .join(', ')
      client.say(channel,
        `@${username} — usage: !build [room]. Available rooms: ${roomList}`
      )
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('gold')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const roomKey = args.join('_').toLowerCase()
    const roomDef = ROOMS[roomKey]

    if (!roomDef) {
      const roomList = Object.keys(ROOMS).join(', ')
      client.say(channel,
        `@${username} — unknown room "${roomKey}". Valid rooms: ${roomList}`
      )
      return
    }

    const stronghold = await getStronghold(username)
    if (!stronghold || stronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you need a stronghold first. Use !stronghold build.`
      )
      return
    }

    // Check room slots
    const rooms = await getStrongholdRooms(username)
    const maxSlots = TIER_ROOM_SLOTS[stronghold.tier - 1]

    if (rooms.length >= maxSlots) {
      client.say(channel,
        `@${username} — your ${getTierName(stronghold.stronghold_type, stronghold.tier)} ` +
        `is full (${maxSlots} rooms). Upgrade your stronghold to unlock more slots.`
      )
      return
    }

    // Check for duplicate room
    const alreadyBuilt = rooms.some((r: any) => r.room_type === roomKey)
    if (alreadyBuilt) {
      client.say(channel,
        `@${username} — you already have a ${roomDef.name}. Each room can only be built once.`
      )
      return
    }

    // Check gold
    if (char.gold < roomDef.goldCost) {
      client.say(channel,
        `@${username} — not enough gold. Need ${roomDef.goldCost}gp, you have ${char.gold}gp.`
      )
      return
    }

    // Check materials
    const mats = await getMaterials(username)
    for (const [mat, needed] of Object.entries(roomDef.materials)) {
      if ((mats[mat as Material] ?? 0) < (needed ?? 0)) {
        client.say(channel,
          `@${username} — not enough ${mat}. ` +
          `Need ${needed}, you have ${mats[mat as Material] ?? 0}. Use !gather ${mat} to collect more.`
        )
        return
      }
    }

    // Deduct costs
    await supabase
      .from('characters')
      .update({ gold: char.gold - roomDef.goldCost })
      .eq('twitch_username', username)

    await deductMaterials(username, roomDef.materials as Partial<Record<Material, number>>)

    // Build the room
    await supabase
      .from('stronghold_rooms')
      .insert({
        twitch_username: username,
        room_type: roomKey,
        is_damaged: false,
      })

    // Recalculate stats
    await recalculateStrongholdStats(username)

    const bonusMsg = Object.entries(roomDef.statBonus)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `+${v} ${k}`)
      .join(', ')

    client.say(channel,
      `🏗️ @${username} builds a ${roomDef.name} in their stronghold! ` +
      `${bonusMsg ? `(${bonusMsg}) ` : ''}` +
      `(${rooms.length + 1}/${maxSlots} rooms used)`
    )
  }
}