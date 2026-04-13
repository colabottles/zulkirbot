import { BotCommand } from '../types'
import { setManualPause } from '../lib/gamePause'

export const pauseCommand: BotCommand = {
  name: 'pause',
  handler: async (channel, username, _args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      return
    }
    setManualPause(true)
    client.say(channel, `⏸️ The ZulkirBot mini game has been paused by ZulkirJax!`)
  }
}