import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'

const RAGE_CLASSES = ['barbarian']

// In-memory: username → rage active for next attack
export const ragingPlayers = new Map<string, boolean>()

export const rageCommand: BotCommand = {
  name: 'rage',
  cooldownSeconds: 30,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('class')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet!`)
      return
    }

    if (!RAGE_CLASSES.includes(char.class)) {
      client.say(channel, `@${username} — only Barbarians can rage.`)
      return
    }

    if (!activeFights.has(username)) {
      client.say(channel, `@${username} — you're not in a fight! Use !fight first.`)
      return
    }

    if (ragingPlayers.has(username)) {
      client.say(channel, `@${username} — you're already raging!`)
      return
    }

    ragingPlayers.set(username, true)

    client.say(channel,
      `😤 @${username} enters a RAGE! +d12 bonus damage on their next attack!`
    )
  }
}