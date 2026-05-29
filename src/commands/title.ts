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

    const characterName = char.character_name ?? username

    if (!char) {
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

    // Check kill titles first
    const { data: killTitle } = await supabase
      .from('titles')
      .select('title')
      .eq('character_id', char.id)
      .ilike('title', `%${titleName}%`)
      .single()

    // Fall back to campaign/invasion titles
    const { data: playerTitle } = !killTitle ? await supabase
      .from('player_titles')
      .select('title')
      .eq('username', username)
      .ilike('title', `%${titleName}%`)
      .single() : { data: null }

    const earned = killTitle ?? playerTitle

    if (!earned) {
      client.say(channel, `@${username} — you haven't earned that title yet.`)
      return
    }

    await supabase
      .from('characters')
      .update({ active_title: earned.title })
      .eq('twitch_username', username)

    client.say(channel, `@${username} (${characterName}) is now known as "${earned.title}"!`)
  }
}