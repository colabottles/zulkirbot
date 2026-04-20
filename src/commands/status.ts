import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'
import { formatPrestige } from './prestige'

export const statusCommand: BotCommand = {
  name: 'status',
  aliases: ['char', 'character', 'stats'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const target = (args[0]?.replace('@', '') ?? username).toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} hasn't joined the adventure yet. Use !join to create a character!`)
      return
    }

    const prestigeBadge = char.prestige_rank > 0 ? ` ${formatPrestige(char.prestige_rank)}` : ''

    client.say(
      channel,
      `⚔️ ${char.display_name}${prestigeBadge} | ${formatClass(char.class)} Lv.${char.level} | ` +
      `HP: ${char.hp}/${char.max_hp} | XP: ${char.xp} | 🪙 Gold: ${char.gold}g`
    )
  }
}