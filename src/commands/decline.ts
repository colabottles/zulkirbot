import { BotCommand } from '../types'
import { getChallenge, removeChallenge } from '../lib/duels'

export const declineCommand: BotCommand = {
  name: 'decline',
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    const challenge = getChallenge(username)

    if (!challenge) {
      client.say(channel, `@${username} — you don't have a pending duel challenge.`)
      return
    }

    removeChallenge(username)

    client.say(
      channel,
      `🐔 @${username} backs down from @${challenge.challenger}'s challenge. Coward!`
    )
  }
}