import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const VALID_SERVERS = [
  'argonnessen', 'cannith', 'ghallanda', 'khyber',
  'orien', 'sarlona', 'shadowdale', 'thrane', 'wayfinder'
]

export const linkDdoCommand: BotCommand = {
  name: 'linkddo',
  cooldownSeconds: 30,
  handler: async (channel, username, args, client) => {
    if (args.length < 2) {
      client.say(channel,
        `@${username} — usage: !linkddo [server] [character name]. ` +
        `Example: !linkddo thrane Icewinddale`
      )
      return
    }

    const server = args[0].toLowerCase()
    const characterName = args.slice(1).join(' ')

    if (!VALID_SERVERS.includes(server)) {
      client.say(channel,
        `@${username} — unknown server "${server}". Valid servers: ${VALID_SERVERS.join(', ')}.`
      )
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you need a ZulkirBot character first. Use !join to create one.`)
      return
    }

    // Verify the character exists on DDO Audit before saving
    try {
      const res = await fetch(
        `https://api.ddoaudit.com/v1/characters/${server}/${encodeURIComponent(characterName)}`
      )

      if (!res.ok) {
        client.say(channel,
          `@${username} — couldn't find "${characterName}" on ${server}. Check the name and server and try again.`
        )
        return
      }

      const json = await res.json() as { data?: { name: string } }

      if (!json.data?.name) {
        client.say(channel,
          `@${username} — couldn't find "${characterName}" on ${server}. Check the name and server and try again.`
        )
        return
      }

      await supabase
        .from('characters')
        .update({
          ddo_character_name: json.data.name,
          ddo_server: server,
        })
        .eq('twitch_username', username)

      client.say(channel,
        `@${username} — DDO character linked! ${json.data.name} on ${server} is now associated with your account.`
      )

    } catch {
      client.say(channel, `@${username} — something went wrong verifying your character. Try again in a moment.`)
    }
  }
}