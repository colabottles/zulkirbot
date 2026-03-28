import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { trimGraveyard } from '../lib/graveyard'

export const killCommand: BotCommand = {
  name: 'kill',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !kill [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    activeFights.delete(target)

    await supabase.from('graveyard').insert({
      twitch_username: char.twitch_username,
      display_name: char.display_name,
      class: char.class,
      level: char.level,
      xp: char.xp,
      killed_by: 'The Dungeon Master',
    })

    await trimGraveyard()
    await supabase.from('characters').delete().eq('twitch_username', target)

    client.say(
      channel,
      `💀 The dungeon master strikes down @${target}! Their soul joins the graveyard.`
    )
  }
}