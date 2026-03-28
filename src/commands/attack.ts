import { BotCommand } from '../types'
import { activeFights, continueFight } from '../game/engine'

export const attackCommand: BotCommand = {
  name: 'attack',
  aliases: ['a'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    if (!activeFights.has(username)) {
      client.say(channel, `@${username} — you're not in a fight! Use !fight to find a monster.`)
      return
    }
    await continueFight(channel, username, client)
  }
}