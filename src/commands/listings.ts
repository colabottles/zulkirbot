import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const listingsCommand: BotCommand = {
  name: 'listings',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: listings } = await supabase
      .from('shop')
      .select('*')
      .eq('is_player_listing', true)
      .gt('expires_at', new Date().toISOString())
      .order('listed_at', { ascending: true })

    if (!listings || listings.length === 0) {
      client.say(channel, `@${username} — no player listings right now.`)
      return
    }

    const list = listings
      .map(l => `${l.item_name} (${l.rarity}) — ${l.price}gp [${l.listed_by}]`)
      .join(' | ')

    client.say(channel, `🏪 Player listings: ${list} — use !pbuy [username] [item name] to purchase`)
  }
}