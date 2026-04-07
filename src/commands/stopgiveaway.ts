import { BotCommand } from '../types'
import { resetGiveaway, getGiveawayState } from '../lib/giveaway'

export const stopGiveawayCommand: BotCommand = {
  name: 'stop',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (args[0]?.toLowerCase() !== 'giveaway') {
      return
    }

    resetGiveaway()

    client.say(channel, `🎉 Giveaway has been reset. Ready for the next one!`)
  }
}