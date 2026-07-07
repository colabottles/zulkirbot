import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'
import { formatPrestige } from './prestige'
import { getDisplayName } from '../lib/displayName'
import { getCharacterStats } from '../lib/stats'

export const statusCommand: BotCommand = {
  name: 'status',
  aliases: ['st', 'stats'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    // !status stats — show combat bonuses
    if (args[0]?.toLowerCase() === 'stats') {
      const { data: char } = await supabase
        .from('characters')
        .select('*')
        .eq('twitch_username', username)
        .single()

      if (!char) {
        return
      }

      const stats = await getCharacterStats(char)
      client.say(channel,
        `📊 @${username} — ATK Bonus: +${stats.attackBonus} | DEF Bonus: +${stats.defenseBonus} | DMG Bonus: +${stats.damageBonus} | HP Bonus: +${stats.hpBonus}`
      )
      return
    }

    if (args[0]?.toLowerCase() === 'materials') {
      const { data: char } = await supabase
        .from('characters')
        .select('refinement_stones, motes')
        .eq('twitch_username', username)
        .single()
      if (!char) return
      client.say(channel,
        `💎 @${username} — Refinement Stones: ${char.refinement_stones ?? 0} | ` +
        `Motes: ${char.motes ?? 0}`
      )
      return
    }

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

    const displayName = getDisplayName(target, char)
    const prestigeBadge = char.prestige_rank > 0 ? ` ${formatPrestige(char.prestige_rank)}` : ''
    client.say(
      channel,
      `⚔️ ${displayName}${prestigeBadge} | ${formatClass(char.class)} Lv.${char.level} | ` +
      `HP: ${char.hp}/${char.max_hp} | XP: ${char.xp} | 🪙 Gold: ${char.gold}gp`
    )
  }
}