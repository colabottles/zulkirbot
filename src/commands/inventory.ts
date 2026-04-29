import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const inventoryCommand: BotCommand = {
  name: 'inventory',
  aliases: ['inv', 'bag', 'items'],
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('id, character_name')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const characterName = char.character_name ?? username

    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .order('rarity', { ascending: false })

    if (!items || items.length === 0) {
      client.say(channel, `@${username} (${characterName}) — your inventory is empty. Go fight something!`)
      return
    }

    const list = items
      .map((i: any) => `${i.item_name} (${i.rarity})${i.equipped ? ' [E]' : ''}`)
      .join(', ')

    client.say(channel, `🎒 @${username} (${characterName})'s inventory: ${list}`)
  }
}