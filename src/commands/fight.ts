import { BotCommand } from '../types'
import { startFight } from '../game/engine'

export const fightCommand: BotCommand = {
  name: 'fight',
  aliases: ['battle'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    await startFight(channel, username, client)
  }
}
