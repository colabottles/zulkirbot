import { BotCommand } from '../types'
import { setManualPause } from '../lib/gamePause'

export const resumeCommand: BotCommand = {
  name: 'resume',
  handler: async (channel, username, _args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      return
    }
    setManualPause(false)
    client.say(channel, `▶️ The ZulkirBot mini game has resumed! Get back in there adventurers!`)
  }
}