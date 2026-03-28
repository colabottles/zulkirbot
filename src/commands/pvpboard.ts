import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const pvpboardCommand: BotCommand = {
  name: 'pvpboard',
  aliases: ['duelboard', 'rivals'],
  cooldownSeconds: 10,
  handler: async (channel, _username, _args, client) => {
    const { data: top } = await supabase
      .from('duel_stats')
      .select('*')
      .order('wins', { ascending: false })
      .limit(5)

    if (!top || top.length === 0) {
      client.say(channel, `No duels have been fought yet! Use !duel @user to challenge someone.`)
      return
    }

    const list = top
      .map((p: any, i: number) =>
        `${i + 1}. ${p.display_name} — ${p.wins}W / ${p.losses}L`
      )
      .join(' | ')

    client.say(channel, `⚔️ PvP Leaderboard: ${list}`)
  }
}