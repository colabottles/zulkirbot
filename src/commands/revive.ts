import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { CLASS_HP_DIE, rollHp } from '../lib/classes'

export const reviveCommand: BotCommand = {
  name: 'revive',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !revive [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    // Check they don't already have a character
    const { data: existing } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', target)
      .single()

    if (existing) {
      client.say(channel, `@${username} — ${target} is already alive!`)
      return
    }

    // Check graveyard for their last character
    const { data: fallen } = await supabase
      .from('graveyard')
      .select('*')
      .eq('twitch_username', target)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!fallen) {
      client.say(channel, `@${username} — ${target} has no fallen character to revive.`)
      return
    }

    const hpDie = CLASS_HP_DIE[fallen.class] ?? 6
    const maxHp = Array.from({ length: fallen.level }, () => rollHp(hpDie)).reduce((a, b) => a + b, 0)

    await supabase.from('characters').insert({
      twitch_username: fallen.twitch_username,
      display_name: fallen.display_name,
      class: fallen.class,
      level: fallen.level,
      xp: fallen.xp,
      hp: maxHp,
      max_hp: maxHp,
      gold: 10,
    })

    client.say(
      channel,
      `✨ The dungeon master reaches into the graveyard and pulls @${target} back to life! ` +
      `They return as a Level ${fallen.level} ${fallen.class} with ${maxHp} HP.`
    )
  }
}