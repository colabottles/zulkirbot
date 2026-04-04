import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const titleCommand: BotCommand = {
  name: 'title',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !title [title name] or !title clear`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    if (args[0].toLowerCase() === 'clear') {
      await supabase
        .from('characters')
        .update({ active_title: null })
        .eq('twitch_username', username)
      client.say(channel, `@${username} — title cleared.`)
      return
    }

    const titleName = args.join(' ')

    const { data: earned } = await supabase
      .from('titles')
      .select('title')
      .eq('character_id', char.id)
      .ilike('title', `%${titleName}%`)
      .single()

    if (!earned) {
      client.say(channel, `@${username} — you haven't earned that title yet.`)
      return
    }

    await supabase
      .from('characters')
      .update({ active_title: earned.title })
      .eq('twitch_username', username)

    client.say(channel, `@${username} is now known as "${earned.title}"!`)
  }
}