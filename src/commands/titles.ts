import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const titlesCommand: BotCommand = {
  name: 'titles',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const target = args[0]?.replace('@', '') ?? username

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character yet.`)
      return
    }

    const { data: titles } = await supabase
      .from('titles')
      .select('title')
      .eq('character_id', char.id)
      .order('earned_at', { ascending: true })

    if (!titles || titles.length === 0) {
      client.say(channel, `@${target} hasn't earned any titles yet. Go slay some monsters!`)
      return
    }

    const activeMarker = (t: string) => t === char.active_title ? ' ★' : ''
    const list = titles.map((t: any) => `${t.title}${activeMarker(t.title)}`).join(' | ')

    client.say(channel, `🏅 ${target}'s titles: ${list}`)
  }
}