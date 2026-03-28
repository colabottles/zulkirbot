import { BotCommand, EquipmentSlot } from '../types'
import { supabase } from '../lib/supabase'
import { getSlotColumn, getSlotForItemType } from '../lib/stats'

export const equipCommand: BotCommand = {
  name: 'equip',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !equip [item name]`)
      return
    }

    const itemName = args.join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .ilike('item_name', `%${itemName}%`)

    if (!items || items.length === 0) {
      client.say(channel, `@${username} — you don't have that item in your inventory.`)
      return
    }

    const item = items[0]

    // Potions and scrolls can't be equipped
    if (item.item_type === 'potion' || item.item_type === 'scroll') {
      client.say(channel, `@${username} — you can't equip a ${item.item_type}. Use !use instead.`)
      return
    }

    // Get slot for item type
    let slot = getSlotForItemType(item.item_type) as EquipmentSlot

    if (!slot) {
      client.say(channel, `@${username} — that item can't be equipped.`)
      return
    }

    // Handle rings — find open ring slot
    if (item.item_type === 'ring') {
      if (!char.equipped_ring1) {
        slot = 'ring1'
      } else if (!char.equipped_ring2) {
        slot = 'ring2'
      } else {
        slot = 'ring1' // replace ring1 if both slots full
      }
    }

    const slotColumn = getSlotColumn(slot)

    // Unequip current item in slot if any
    const currentItemId = char[slotColumn]
    if (currentItemId) {
      await supabase
        .from('inventory')
        .update({ equipped: false })
        .eq('id', currentItemId)
    }

    // Equip new item
    await supabase
      .from('inventory')
      .update({ equipped: true, curse_revealed: item.is_cursed ? true : false })
      .eq('id', item.id)

    await supabase
      .from('characters')
      .update({ [slotColumn]: item.id })
      .eq('twitch_username', username)

    const statLabels: Record<string, string> = {
      weapon: 'damage',
      shield: 'defense',
      armor: 'defense',
      helmet: 'defense',
      cloak: 'defense',
      neck: 'HP',
      eyes: 'attack',
      waist: 'HP',
      arms: 'attack',
      hands: 'damage',
      feet: 'defense',
      ring1: 'attack',
      ring2: 'damage',
      trinket: 'HP',
    }

    const statLabel = statLabels[slot] ?? 'stat'
    const bonusSign = item.is_cursed ? '-' : '+'
    const curseMsg = item.is_cursed
      ? ` ⚠️ A dark energy courses through you... this item is CURSED!`
      : ''

    client.say(
      channel,
      `✅ @${username} equipped ${item.item_name} in their ${slot} slot. ` +
      `(${bonusSign}${item.stat_bonus} ${statLabel})${curseMsg}`
    )
  }
}