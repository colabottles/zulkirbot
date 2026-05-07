import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'

export const listauctionCommand: BotCommand = {
  name: 'listauction',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !listauction [item name] [starting bid]`)
      return
    }

    const startingBid = parseInt(args[args.length - 1])
    if (isNaN(startingBid) || startingBid <= 0) {
      client.say(channel, `@${username} — invalid starting bid.`)
      return
    }

    const itemName = args.slice(0, -1).join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    // Check if an auction is already active
    const { data: activeAuction } = await supabase
      .from('auctions')
      .select('id')
      .eq('is_active', true)
      .single()

    if (activeAuction) {
      client.say(channel, `@${username} — there's already an active auction! Wait for it to end before listing another item.`)
      return
    }

    // Find item in inventory
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
      client.say(channel, `@${username} — unequip the item first before listing it for auction.`)
      return
    }

    if (item.is_cursed && item.curse_revealed) {
      client.say(channel, `@${username} — you can't auction a cursed item.`)
      return
    }

    // Remove from inventory
    await supabase.from('inventory').delete().eq('id', item.id)

    // Create auction
    await supabase.from('auctions').insert({
      listed_by: username,
      item_name: item.item_name,
      item_type: item.item_type,
      rarity: item.rarity,
      stat_bonus: item.stat_bonus,
      description: item.description,
      is_cursed: item.is_cursed ?? false,
      purchase_price: item.purchase_price,
      starting_bid: startingBid,
      current_bid: startingBid,
      current_bidder: null,
      is_active: true,
    })

    client.say(channel,
      `🔨 @${username} has put ${item.item_name} (${formatRarity(item.rarity)}) up for auction! ` +
      `Starting bid: ${startingBid}gp. Use !bid [amount] to place a bid. Use !auctions to see current bids.`
    )
  }
}