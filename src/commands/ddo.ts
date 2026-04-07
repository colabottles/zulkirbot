import { BotCommand } from '../types'
import {
  getGiveawayState,
  addEntry,
  startTimer,
} from '../lib/giveaway'
import tmi from 'tmi.js'

let clientRef: tmi.Client | null = null

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

    const added = addEntry(username)

    if (!added) {
      client.say(channel, `@${username} — you're already entered!`)
      return
    }

    // First entry starts the timer
    if (!state.timerStarted) {
      clientRef = client
      startTimer(
        () => {
          // 1 minute warning
          clientRef?.say(
            channel,
            `⏰ 1 minute remaining to enter the ${state.prizeName} giveaway! Type !ddo to enter!`
          )
        },
        () => {
          // Timer ends
          clientRef?.say(
            channel,
            `🔒 Entries for the ${state.prizeName} giveaway are now closed! ` +
            `${state.entries.length} entries received. Broadcaster will draw a winner shortly with !draw`
          )
        }
      )

      client.say(
        channel,
        `🎉 @${username} is the first entry! The 5 minute timer has started! ` +
        `Type !ddo to enter the ${state.prizeName} giveaway!`
      )
      return
    }

    client.say(channel, `✅ @${username} has entered the giveaway! (${state.entries.length} entries so far)`)
  }
}