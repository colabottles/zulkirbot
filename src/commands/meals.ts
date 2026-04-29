import { BotCommand } from '../types'
import { TAVERN_MEALS } from '../game/tavern'

export const mealsCommand: BotCommand = {
  name: 'meals',
  cooldownSeconds: 10,
  handler: async (channel, username, _args, client) => {
    const meals = TAVERN_MEALS.map(m => `${m.name} (${m.price}gp)`).join(' | ')
    client.say(channel, `🍖 Meals: ${meals} — Use !tavern meal [name] to order!`)
  }
}