import { BotCommand } from '../types'
import {
  getGiveawayState,
  addEntry,
  startTimer,
} from '../lib/giveaway'
import { isSubscriber } from '../lib/twitch'
import { supabase } from '../lib/supabase'
import tmi from 'tmi.js'

let clientRef: tmi.Client | null = null

const HEXMONGERS_GUILD = 'The Hexmongers'
const HEXMONGERS_SERVER = 'thrane'

async function isHexmongersMember(username: string): Promise<boolean> {
  const { data: char } = await supabase
    .from('characters')
    .select('ddo_character_name, ddo_server')
    .eq('twitch_username', username)
    .single()

  if (!char?.ddo_character_name || !char?.ddo_server) return false
  if (char.ddo_server !== HEXMONGERS_SERVER) return false

  try {
    const res = await fetch(
      `https://api.ddoaudit.com/v1/characters/${char.ddo_server}/${encodeURIComponent(char.ddo_character_name)}`
    )
    if (!res.ok) return false
    const json = await res.json() as { data?: { guild_name?: string } }
    return json.data?.guild_name === HEXMONGERS_GUILD
  } catch {
    return false
  }
}

export function setDdoClient(client: tmi.Client): void {
  clientRef = client
}

export const ddoCommand: BotCommand = {
  name: 'ddo',
  handler: async (channel, username, _args, client) => {
    const state = getGiveawayState()
    if (!state.active) {
      client.say(channel, `@${username} — there's no giveaway running right now!`)
      return
    }

    const channelName = process.env.TWITCH_CHANNEL!
    const sub = await isSubscriber(username, channelName)
    const hexmonger = await isHexmongersMember(username)
    const added = addEntry(username, sub || hexmonger)
    if (!added) {
      client.say(channel, `@${username} — you're already entered!`)
      return
    }
    const subMsg = sub
      ? ` 🌟 Subscriber bonus — you get 2 entries!`
      : hexmonger
        ? ` ⚔️ Hexmongers guild member — you get 2 entries!`
        : ''

    // First entry starts the timer
    if (!state.timerStarted) {
      clientRef = client
      startTimer(
        () => {
          clientRef?.say(
            channel,
            `⏰ 1 minute remaining to enter the ${state.prizeName}! Type !ddo to enter!`
          )
        },
        () => {
          clientRef?.say(
            channel,
            `🔒 Entries for the ${state.prizeName} are now closed! ` +
            `${state.entries.length === 1 ? '1 entry' : `${state.entries.length} entries`} received. Broadcaster will draw a winner shortly with !draw`
          )
        }
      )
      client.say(
        channel,
        `🎉 @${username} is the first entry! The 5 minute timer has started!${subMsg} ` +
        `Type !ddo to enter the ${state.prizeName}!`
      )
      return
    }

    client.say(channel, `✅ @${username} has entered the giveaway!${subMsg} (${state.entries.length} entries so far)`)
  }
}