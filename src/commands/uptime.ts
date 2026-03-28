import { BotCommand } from '../types'

const startTime = Date.now()

export const uptimeCommand: BotCommand = {
  name: 'uptime',
  aliases: ['stream'],
  handler: async (channel, _username, _args, client) => {
    const elapsed = Date.now() - startTime
    const h = Math.floor(elapsed / 3600000)
    const m = Math.floor((elapsed % 3600000) / 60000)
    client.say(channel, `Stream has been live for ${h}h ${m}m.`)
  }
}