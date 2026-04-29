import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { TAVERN_DRINKS, TAVERN_MEALS } from '../game/tavern'
import { applyBuff } from '../lib/tavernBuffs'
import { activeFights } from '../game/engine'
import { markTavernVisit } from '../lib/tavernSession'
import { maybeStartBrawl } from '../lib/tavernSession'

export const tavernCommand: BotCommand = {
  name: 'tavern',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    // Show menu
    if (!args.length) {
      client.say(
        channel,
        `🍺 Welcome to the tavern, @${username}! Use !drinks to see the drink menu, ` +
        `!meals to see the food menu. Use !tavern drink [name] or !tavern meal [name] to order. ` +
        `!gamble [amount] to try your luck! !barkeep and !rumour available after your first purchase.`
      )
      return
    }

    const subCommand = args[0].toLowerCase()
    const itemName = args.slice(1).join(' ').toLowerCase()

    // Buy a drink
    if (subCommand === 'drink') {
      if (!itemName) {
        client.say(channel, `@${username} — usage: !tavern drink [name]`)
        return
      }

      const drink = TAVERN_DRINKS.find(
        d => d.name.toLowerCase().includes(itemName)
      )

      if (!drink) {
        client.say(channel, `@${username} — that drink isn't on the menu.`)
        return
      }

      if (char.gold < drink.price) {
        client.say(channel, `@${username} — you can't afford that! You have ${char.gold}gp and it costs ${drink.price}gp.`)
        return
      }

      await supabase
        .from('characters')
        .update({ gold: char.gold - drink.price })
        .eq('twitch_username', username)

      markTavernVisit(username)
      maybeStartBrawl(channel, username, client)

      if (drink.effect === 'weird') {
        client.say(
          channel,
          `🍺 @${username} orders a ${drink.name} — a ${drink.color} liquid that tastes of ${drink.flavor}. ` +
          `${drink.weirdMessage}`
        )
        return
      }

      applyBuff(username, drink)

      const effectLabels: Record<string, string> = {
        attack: 'attack',
        defense: 'defense',
        damage: 'damage',
        hp: 'max HP',
      }

      client.say(
        channel,
        `🍺 @${username} orders a ${drink.name} — a ${drink.color} liquid that tastes of ${drink.flavor}. ` +
        `+${drink.bonus} ${effectLabels[drink.effect]} for your next fight!`
      )
      return
    }

    // Buy a meal
    if (subCommand === 'meal') {
      if (!itemName) {
        client.say(channel, `@${username} — usage: !tavern meal [name]`)
        return
      }

      const meal = TAVERN_MEALS.find(
        m => m.name.toLowerCase().includes(itemName)
      )

      if (!meal) {
        client.say(channel, `@${username} — that meal isn't on the menu.`)
        return
      }

      if (char.gold < meal.price) {
        client.say(channel, `@${username} — you can't afford that! You have ${char.gold}gp and it costs ${meal.price}gp.`)
        return
      }

      if (char.hp >= char.max_hp) {
        client.say(channel, `@${username} — you're already at full health! No need to eat.`)
        return
      }

      if (activeFights.has(username)) {
        client.say(channel, `@${username} — you can't eat during a fight!`)
        return
      }

      const newHp = Math.min(char.hp + meal.healAmount, char.max_hp)

      await supabase
        .from('characters')
        .update({
          gold: char.gold - meal.price,
          hp: newHp,
        })
        .eq('twitch_username', username)

      markTavernVisit(username)
      maybeStartBrawl(channel, username, client)

      client.say(
        channel,
        `🍖 @${username} eats the ${meal.name}. ${meal.description} ` +
        `Restored ${meal.healAmount} HP! (HP: ${newHp}/${char.max_hp})`
      )
      return
    }

    client.say(channel, `@${username} — usage: !tavern drink [name] | !tavern meal [name]`)
  }
}