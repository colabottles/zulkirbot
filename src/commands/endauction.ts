import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'

export const endauctionCommand: BotCommand = {
  name: 'endauction',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const broadcaster = process.env.TWITCH_CHANNEL?.toLowerCase()
    if (username.toLowerCase() !== broadcaster) return

    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!auction) {
      client.say(channel, `@${username} — no active auction to end.`)
      return
    }

    // No bids — return item to seller
    if (!auction.current_bidder) {
      const { data: sellerChar } = await supabase
        .from('characters')
        .select('id')
        .eq('twitch_username', auction.listed_by)
        .single()

      if (sellerChar) {
        await supabase.from('inventory').insert({
          character_id: sellerChar.id,
          item_name: auction.item_name,
          item_type: auction.item_type,
          rarity: auction.rarity,
          stat_bonus: auction.stat_bonus,
          description: auction.description,
          is_cursed: auction.is_cursed ?? false,
          purchase_price: auction.purchase_price,
        })
      }

      await supabase.from('auctions').update({ is_active: false }).eq('id', auction.id)

      client.say(channel,
        `🔨 The auction for ${auction.item_name} ended with no bids. ` +
        `Item returned to @${auction.listed_by}.`
      )
      return
    }

    // Winner gets item
    const { data: winnerChar } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', auction.current_bidder)
      .single()

    if (winnerChar) {
      await supabase.from('inventory').insert({
        character_id: winnerChar.id,
        item_name: auction.item_name,
        item_type: auction.item_type,
        rarity: auction.rarity,
        stat_bonus: auction.stat_bonus,
        description: auction.description,
        is_cursed: auction.is_cursed ?? false,
        curse_revealed: false,
        purchase_price: auction.current_bid,
      })
    }

    // Seller gets gold
    const { data: sellerChar } = await supabase
      .from('characters')
      .select('gold')
      .eq('twitch_username', auction.listed_by)
      .single()

    if (sellerChar) {
      await supabase
        .from('characters')
        .update({ gold: sellerChar.gold + auction.current_bid })
        .eq('twitch_username', auction.listed_by)
    }

    await supabase.from('auctions').update({ is_active: false }).eq('id', auction.id)

    client.say(channel,
      `🔨 AUCTION CLOSED! @${auction.current_bidder} wins ${auction.item_name} (${formatRarity(auction.rarity)}) ` +
      `for ${auction.current_bid}gp! @${auction.listed_by} receives ${auction.current_bid}gp.`
    )
  }
}