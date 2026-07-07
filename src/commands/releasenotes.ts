import { BotCommand } from '../types'

export const releasenotesCommand: BotCommand = {
  name: 'releasenotes',
  aliases: ['rn'],
  cooldownSeconds: 10,
  handler: async (channel, username, _args, client) => {
    client.say(channel,
      `@${username} — ZulkirBot release notes: https://github.com/colabottles/zulkirbot/blob/main/RELEASE_NOTES.md`
    )
  }
}