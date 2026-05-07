import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'

export const bidCommand: BotCommand = {
  name: 'bid',
  cooldownSeconds: 3,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !bid [amount]`)
      return
    }

    const amount = parseInt(args[0])
    if (isNaN(amount) || amount <= 0) {
      client.say(channel, `@${username} — invalid bid amount.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!auction) {
      client.say(channel, `@${username} — there's no active auction right now.`)
      return
    }

    if (auction.listed_by === username) {
      client.say(channel, `@${username} — you can't bid on your own auction.`)
      return
    }

    if (amount <= auction.current_bid) {
      client.say(channel,
        `@${username} — your bid of ${amount}gp must be higher than the current bid of ${auction.current_bid}gp.`
      )
      return
    }

    if (char.gold < amount) {
      client.say(channel,
        `@${username} — you don't have enough gold! You have ${char.gold}gp and the bid is ${amount}gp.`
      )
      return
    }

    // Refund previous bidder
    if (auction.current_bidder && auction.current_bidder !== username) {
      const { data: prevBidder } = await supabase
        .from('characters')
        .select('gold')
        .eq('twitch_username', auction.current_bidder)
        .single()

      if (prevBidder) {
        await supabase
          .from('characters')
          .update({ gold: prevBidder.gold + auction.current_bid })
          .eq('twitch_username', auction.current_bidder)

        client.say(channel,
          `💰 @${auction.current_bidder} — you've been outbid! ${auction.current_bid}gp returned to you.`
        )
      }
    }

    // Deduct gold from new bidder
    await supabase
      .from('characters')
      .update({ gold: char.gold - amount })
      .eq('twitch_username', username)

    // Update auction
    await supabase
      .from('auctions')
      .update({ current_bid: amount, current_bidder: username })
      .eq('id', auction.id)

    client.say(channel,
      `🔨 @${username} bids ${amount}gp on ${auction.item_name} (${formatRarity(auction.rarity)})! `
    )
  }
}