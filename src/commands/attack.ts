import { BotCommand } from '../types'
import { activeFights, continueFight } from '../game/engine'
import { campaignAttackPending } from './campaign'

export const attackCommand: BotCommand = {
  name: 'attack',
  aliases: ['a'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    // Campaign turn takes priority
    if (campaignAttackPending.has(username)) {
      const resolve = campaignAttackPending.get(username)!
      resolve()
      return
    }

    if (!activeFights.has(username)) {
      client.say(channel, `@${username} — you're not in a fight! Use !fight to find a monster.`)
      return
    }

    await continueFight(channel, username, client)
  }
}