import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { getDisplayName } from '../lib/displayName'

export const killcountCommand: BotCommand = {
  name: 'killcount',
  aliases: ['kc', 'kills'],
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('id, character_name')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const displayName = getDisplayName(username, char)

    const { data: kills } = await supabase
      .from('kill_stats')
      .select('kill_count')
      .eq('character_id', char.id)

    const { data: bossKills } = await supabase
      .from('boss_kills')
      .select('kill_count')
      .eq('character_id', char.id)

    const total = (kills ?? []).reduce((sum, row) => sum + row.kill_count, 0)
    const bossTotal = (bossKills ?? []).reduce((sum, row) => sum + row.kill_count, 0)

    client.say(channel,
      `⚔️ ${displayName} has slain ${total} monster${total !== 1 ? 's' : ''} ` +
      `and ${bossTotal} boss${bossTotal !== 1 ? 'es' : ''}.`
    )
  }
}