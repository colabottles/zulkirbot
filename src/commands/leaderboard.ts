import { BotCommand } from '../types'

export const leaderboardCommand: BotCommand = {
  name: 'leaderboard',
  aliases: ['lb'],
  cooldownSeconds: 10,
  handler: async (channel, _username, _args, client) => {
    client.say(channel, `🏆 Leaderboard → https://zulkirbot.netlify.app/leaderboard.html`)
  }
}