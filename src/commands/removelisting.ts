import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const removelistingCommand: BotCommand = {
  name: 'removelisting',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !removelisting [item name]`)
      return
    }

    const itemName = args.join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      return
    }

    const { data: listings } = await supabase
      .from('shop')
      .select('*')
      .eq('listed_by', username)
      .eq('is_player_listing', true)
      .ilike('item_name', `%${itemName}%`)

    if (!listings || listings.length === 0) {
      client.say(channel, `@${username} — no active listing found for that item.`)
      return
    }

    const listing = listings[0]

    // Return item to inventory
    await supabase.from('inventory').insert({
      character_id: char.id,
      item_name: listing.item_name,
      item_type: listing.item_type,
      rarity: listing.rarity,
      stat_bonus: listing.stat_bonus,
      description: listing.description,
      is_cursed: listing.is_cursed ?? false,
      purchase_price: listing.purchase_price,
    })

    await supabase.from('shop').delete().eq('id', listing.id)

    client.say(channel, `@${username} — ${listing.item_name} removed from sale and returned to your inventory.`)
  }
}