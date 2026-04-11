import { BotCommand } from '../types'
import { getGiveawayState, setGiveawayActive, startTimer } from '../lib/giveaway'

export const startGiveawayCommand: BotCommand = {
  name: 'start',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (args[0]?.toLowerCase() !== 'giveaway') {
      return
    }

    const state = getGiveawayState()

    if (state.active) {
      client.say(channel, `@${username} — a giveaway is already running!`)
      return
    }

    if (!state.prizeCode) {
      client.say(channel, `@${username} — set the prize code first with !setcode [code]`)
      return
    }

    const prizeName = args.slice(1).join(' ')

    if (!prizeName) {
      client.say(channel, `@${username} — usage: !start giveaway [prize name]`)
      return
    }

    setGiveawayActive(true, prizeName, channel)

    client.say(
      channel,
      `🎉 GIVEAWAY STARTED! Prize: ${prizeName.replace(/\s*giveaway\s*/gi, '').trim()} | ` +
      `Type !ddo to enter! The timer starts with the first entry. ` +
      `Make sure your Twitch whispers are open to receive your prize!`
    )
  }
}