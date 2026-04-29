import { BotCommand } from '../types'

export const helpCommand: BotCommand = {
  name: 'help',
  aliases: ['h'],
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    client.say(channel, `@${username} — ZulkirBot docs: https://zulkirbot-docs.netlify.app/`)
  }
}