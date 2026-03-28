import { BotCommand } from '../types'
import { startFight } from '../game/engine'

export const fightCommand: BotCommand = {
  name: 'fight',
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    await startFight(channel, username, client)
  }
}
