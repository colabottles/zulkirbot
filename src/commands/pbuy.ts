import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const pbuyCommand: BotCommand = {
  name: 'pbuy',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !pbuy [username] [item name]`)
      return
    }

    const seller = args[0].replace('@', '').toLowerCase()
    const itemName = args.slice(1).join(' ').toLowerCase()

    if (seller === username) {
      client.say(channel, `@${username} — you can't buy your own listing.`)
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

    // Find the listing
    const { data: listings } = await supabase
      .from('shop')
      .select('*')
      .eq('listed_by', seller)
      .eq('is_player_listing', true)
      .ilike('item_name', `%${itemName}%`)
      .gt('expires_at', new Date().toISOString())

    if (!listings || listings.length === 0) {
      client.say(channel, `@${username} — no active listing found from ${seller} for that item.`)
      return
    }

    const listing = listings[0]

    if (char.gold < listing.price) {
      client.say(channel,
        `@${username} — you can't afford that! You have ${char.gold}gp and it costs ${listing.price}gp.`
      )
      return
    }

    // Transfer gold to seller
    const { data: sellerChar } = await supabase
      .from('characters')
      .select('gold')
      .eq('twitch_username', seller)
      .single()

    if (sellerChar) {
      await supabase.from('characters')
        .update({ gold: sellerChar.gold + listing.price })
        .eq('twitch_username', seller)
    }

    // Deduct gold from buyer
    await supabase.from('characters').update({ gold: char.gold - listing.price }).eq('twitch_username', username)

    // Add item to buyer inventory with purchase_price recorded
    await supabase.from('inventory').insert({
      character_id: char.id,
      item_name: listing.item_name,
      item_type: listing.item_type,
      rarity: listing.rarity,
      stat_bonus: listing.stat_bonus,
      description: listing.description,
      is_cursed: listing.is_cursed ?? false,
      curse_revealed: false,
      purchase_price: listing.price,
    })

    // Remove listing
    await supabase.from('shop').delete().eq('id', listing.id)

    client.say(channel,
      `🏪 @${username} purchased ${listing.item_name} from ${seller} for ${listing.price}gp! ` +
      `(Gold remaining: ${char.gold - listing.price}gp)`
    )
  }
}