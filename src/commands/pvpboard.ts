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

    // Fetch character names
    const enriched = await Promise.all(
      top.map(async (p: any) => {
        const { data: char } = await supabase
          .from('characters')
          .select('character_name')
          .eq('twitch_username', p.twitch_username)
          .single()
        return { ...p, character_name: char?.character_name ?? null }
      })
    )

    const list = enriched
      .map((p: any, i: number) => {
        const name = p.character_name ?? p.display_name
        return `${i + 1}. ${name} — ${p.wins}W / ${p.losses}L`
      })
      .join(' | ')

    client.say(channel, `⚔️ PvP Leaderboard: ${list}`)
  }
}