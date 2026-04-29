import { BotCommand } from '../types'
import { TAVERN_DRINKS } from '../game/tavern'

export const drinksCommand: BotCommand = {
  name: 'drinks',
  cooldownSeconds: 10,
  handler: async (channel, username, _args, client) => {
    const drinks = TAVERN_DRINKS.map(d => `${d.name} (${d.price}gp)`).join(' | ')
    client.say(channel, `🍺 Drinks: ${drinks} — Use !tavern drink [name] to order!`)
  }
}