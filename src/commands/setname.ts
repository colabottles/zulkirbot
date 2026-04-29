import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const setnameCommand: BotCommand = {
  name: 'setname',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !setname [character name]. Example: !setname Aldric Thornwood`)
      return
    }

    const characterName = args.join(' ').trim()

    if (characterName.length < 3) {
      client.say(channel, `@${username} — character name must be at least 3 characters.`)
      return
    }

    if (characterName.length > 30) {
      client.say(channel, `@${username} — character name must be 30 characters or fewer.`)
      return
    }

    if (!/^[a-zA-Z\s'\-]+$/.test(characterName)) {
      client.say(channel, `@${username} — character name can only contain letters, spaces, hyphens, and apostrophes.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    await supabase
      .from('characters')
      .update({ character_name: characterName })
      .eq('twitch_username', username)

    client.say(channel, `✅ @${username} — your character is now known as "${characterName}".`)
  }
}