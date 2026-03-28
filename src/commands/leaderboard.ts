import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'

export const leaderboardCommand: BotCommand = {
  name: 'leaderboard',
  aliases: ['top', 'rankings', 'lb'],
  cooldownSeconds: 10,
  handler: async (channel, _username, _args, client) => {
    const { data: top } = await supabase
      .from('characters')
      .select('display_name, class, level, xp')
      .order('xp', { ascending: false })
      .limit(5)

    if (!top || top.length === 0) {
      client.say(channel, `No adventurers yet! Use !join to be the first.`)
      return
    }

    const list = top
      .map((c: any, i: number) => `${i + 1}. ${c.display_name} (${formatClass(c.class)} Lv.${c.level} — ${c.xp} XP)`)
      .join(' | ')

    client.say(channel, `🏆 Leaderboard: ${list}`)
  }
}