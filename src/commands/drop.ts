import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const dropCommand: BotCommand = {
  name: 'drop',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !drop [item name]`)
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

    if (item.equipped) {
      client.say(channel, `@${username} — you can't drop an equipped item. Use !unequip [slot] first.`)
      return
    }

    if (item.is_cursed && item.curse_revealed) {
      client.say(channel, `@${username} — you can't drop a cursed item. Find a !shrine to remove it first.`)
      return
    }

    await supabase.from('inventory').delete().eq('id', item.id)

    client.say(channel, `🗑️ @${username} dropped their ${item.item_name}.`)
  }
}