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

    // Stack duplicate items by name
    const stacked = new Map<string, { rarity: string; count: number; equipped: boolean }>()
    for (const item of items) {
      const key = item.item_name
      if (stacked.has(key)) {
        stacked.get(key)!.count++
      } else {
        stacked.set(key, { rarity: item.rarity, count: 1, equipped: !!item.equipped })
      }
    }

    const list = [...stacked.entries()]
      .map(([name, { rarity, count, equipped }]) =>
        `${name} (${rarity})${count > 1 ? ` x${count}` : ''}${equipped ? ' [E]' : ''}`
      )
      .join(', ')

    client.say(channel, `🎒 @${username} (${characterName})'s inventory: ${list}`)
  }
}