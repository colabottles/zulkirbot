import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'

export const auctionsCommand: BotCommand = {
  name: 'auctions',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!auction) {
      client.say(channel, `@${username} — no active auction right now.`)
      return
    }

    const bidderMsg = auction.current_bidder
      ? `High bid: ${auction.current_bid}gp by @${auction.current_bidder}`
      : `No bids yet — starting at ${auction.starting_bid}gp`

    client.say(channel,
      `🔨 Current auction: ${auction.item_name} (${formatRarity(auction.rarity)}) listed by @${auction.listed_by} | ` +
      `${bidderMsg} | Use !bid [amount] to bid!`
    )
  }
}