import { BotCommand } from '../types'
import { setPrizeCode } from '../lib/giveaway'
import { getCode } from '../lib/codes'

export const setcodeCommand: BotCommand = {
  name: 'setcode',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !setcode [codename]`)
      return
    }

    const codeName = args[0].toLowerCase()
    const code = getCode(codeName)

    if (!code) {
      client.say(channel, `@${username} — code "${codeName}" not found. Check your codes.ts file.`)
      return
    }

    setPrizeCode(code)
    client.say(channel, `@${username} — prize code "${codeName}" loaded. Ready to start the giveaway!`)
  }
}