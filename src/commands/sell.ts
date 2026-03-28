import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { ItemRarity } from '../types'

const SELL_PRICES: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  legendary: 150,
}

export const sellCommand: BotCommand = {
  name: 'sell',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !sell [item name]`)
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
      client.say(channel, `@${username} — you can't sell an equipped item. Use !unequip [slot] first.`)
      return
    }

    if (item.is_cursed && item.curse_revealed) {
      client.say(channel, `@${username} — you can't sell a cursed item. Find a !shrine to remove it first.`)
      return
    }

    const sellPrice = SELL_PRICES[item.rarity] ?? 10
    const newGold = char.gold + sellPrice

    await supabase.from('inventory').delete().eq('id', item.id)
    await supabase.from('characters').update({ gold: newGold }).eq('twitch_username', username)

    client.say(
      channel,
      `💰 @${username} sold their ${item.item_name} for ${sellPrice}g! (Gold: ${newGold}g)`
    )
  }
}