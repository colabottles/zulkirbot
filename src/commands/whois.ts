import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { getDisplayName } from '../lib/displayName'

export const whoisCommand: BotCommand = {
  name: 'whois',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const target = args[0]?.replace('@', '').toLowerCase()
    if (!target) {
      client.say(channel, `@${username} — usage: !whois [username]`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('class, level, display_name, character_name')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — no character found for ${target}.`)
      return
    }

    const displayName = getDisplayName(target, char)
    client.say(channel, `@${username} — ${target} (${displayName}) is a Level ${char.level} ${char.class}.`)
  }
}