import { BotCommand } from '../types'
import { getGiveawayState, addEntry } from '../lib/giveaway'

export const addentryCommand: BotCommand = {
  name: 'addentry',
  handler: async (channel, username, args, client) => {
    const broadcaster = process.env.TWITCH_CHANNEL?.toLowerCase()
    if (username.toLowerCase() !== broadcaster) return

    const target = args[0]?.replace('@', '').toLowerCase()
    if (!target) {
      client.say(channel, `@${username} — usage: !addentry [username]`)
      return
    }

    const state = getGiveawayState()
    if (!state.active) {
      client.say(channel, `@${username} — no giveaway is running right now.`)
      return
    }

    const added = addEntry(target)
    if (!added) {
      client.say(channel, `@${username} — ${target} is already entered.`)
      return
    }

    client.say(channel, `✅ ${target} has been manually added to the giveaway! (${state.entries.length} entries so far)`)
  }
}