import { BotCommand } from '../types'

export const soCommand: BotCommand = {
  name: 'so',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    const target = args[0]?.replace('@', '')
    if (!target) {
      client.say(channel, `@${username} — usage: !so @username`)
      return
    }
    client.say(channel, `Go show some love to https://twitch.tv/${target} — give them a follow!`)
  }
}