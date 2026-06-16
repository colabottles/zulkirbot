import { BotCommand, EquipmentSlot } from '../types'
import { supabase } from '../lib/supabase'
import { getSlotColumn } from '../lib/stats'
import { getCharacterStats } from '../lib/stats'

const VALID_SLOTS: EquipmentSlot[] = [
  'weapon', 'shield', 'armor', 'helmet', 'cloak', 'neck',
  'eyes', 'waist', 'arms', 'wrist', 'hands', 'feet', 'ring1', 'ring2', 'trinket'
]

export const unequipCommand: BotCommand = {
  name: 'unequip',
  aliases: ['une'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !unequip [slot] or !unequip all`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      return
    }

    // !unequip all
    if (args[0].toLowerCase() === 'all') {
      const updates: Record<string, null> = {}
      const itemIds: string[] = []

      for (const slot of VALID_SLOTS) {
        const slotColumn = getSlotColumn(slot)
        const itemId = char[slotColumn]
        if (!itemId) continue

        const { data: item } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', itemId)
          .single()

        if (item?.is_cursed && item?.curse_revealed) continue // skip cursed

        updates[slotColumn] = null
        itemIds.push(itemId)
      }

      if (itemIds.length === 0) {
        client.say(channel, `@${username} — nothing to unequip (cursed items cannot be removed).`)
        return
      }

      for (const id of itemIds) {
        await supabase.from('inventory').update({ equipped: false }).eq('id', id)
      }

      const updatedChar = { ...char, ...updates }
      const stats = await getCharacterStats(updatedChar)
      const newMaxHp = char.base_max_hp + stats.hpBonus
      const newHp = Math.min(char.hp, newMaxHp)

      await supabase
        .from('characters')
        .update({ ...updates, max_hp: newMaxHp, hp: newHp })
        .eq('twitch_username', username)

      client.say(channel, `@${username} — all non-cursed items unequipped.`)
      return
    }

    // Single slot
    const slot = args[0].toLowerCase() as EquipmentSlot
    if (!VALID_SLOTS.includes(slot)) {
      client.say(channel, `@${username} — invalid slot. Valid slots: ${VALID_SLOTS.join(', ')}`)
      return
    }

    const slotColumn = getSlotColumn(slot)
    const itemId = char[slotColumn]

    if (!itemId) {
      client.say(channel, `@${username} — nothing equipped in that slot.`)
      return
    }

    const { data: item } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', itemId)
      .single()

    if (!item || item.character_id !== char.id) {
      client.say(channel, `@${username} — that item doesn't belong to you.`)
      return
    }

    if (item?.is_cursed && item?.curse_revealed) {
      client.say(channel,
        `@${username} — the ${item.item_name} is CURSED and cannot be removed! ` +
        `Find a !shrine via !explore to have a chance at removing it.`
      )
      return
    }

    await supabase.from('inventory').update({ equipped: false }).eq('id', itemId)

    const updatedChar = { ...char, [slotColumn]: null }
    const stats = await getCharacterStats(updatedChar)
    const newMaxHp = char.base_max_hp + stats.hpBonus
    const newHp = Math.min(char.hp, newMaxHp)

    await supabase
      .from('characters')
      .update({ [slotColumn]: null, max_hp: newMaxHp, hp: newHp })
      .eq('twitch_username', username)

    client.say(channel, `@${username} unequipped their ${slot}.`)
  }
}