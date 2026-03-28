import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'

export const statusCommand: BotCommand = {
  name: 'status',
  aliases: ['char', 'character', 'stats'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const target = args[0]?.replace('@', '') ?? username

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} hasn't joined the adventure yet. Use !join to create a character!`)
      return
    }

    client.say(
      channel,
      `⚔️ ${char.display_name} | ${formatClass(char.class)} Lv.${char.level} | ` +
      `HP: ${char.hp}/${char.max_hp} | XP: ${char.xp} | 🪙 Gold: ${char.gold}g`
    )
  }
}