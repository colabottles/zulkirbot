import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const SELL_PRICES: Record<string, number> = {
  common: 10,
  uncommon: 30,
  rare: 60,
  legendary: 150,
}

const DOUBLE_RARITIES = ['rare', 'legendary']

function rollSellPrice(rarity: string): { price: number; rolled: number } {
  const base = SELL_PRICES[rarity] ?? 10
  if (!DOUBLE_RARITIES.includes(rarity)) return { price: base, rolled: 0 }
  const roll = Math.floor(Math.random() * 100) + 1
  return { price: roll >= 75 ? base * 2 : base, rolled: roll }
}

export const sellCommand: BotCommand = {
  name: 'sell',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !sell [item name] or !sell all`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    // !sell all
    if (args[0].toLowerCase() === 'all') {
      const { data: items } = await supabase
        .from('inventory')
        .select('*')
        .eq('character_id', char.id)
        .eq('equipped', false)

      if (!items || items.length === 0) {
        client.say(channel, `@${username} — no unequipped items to sell.`)
        return
      }

      const sellable = items.filter(i => !(i.is_cursed && i.curse_revealed))

      if (sellable.length === 0) {
        client.say(channel, `@${username} — all your unequipped items are cursed and can't be sold.`)
        return
      }

      let totalGold = 0
      const results: string[] = []

      for (const item of sellable) {
        const { price, rolled } = rollSellPrice(item.rarity)
        totalGold += price
        if (DOUBLE_RARITIES.includes(item.rarity)) {
          const doubled = price === (SELL_PRICES[item.rarity] ?? 0) * 2
          results.push(`${item.item_name} (${price}g${doubled ? ' 🎲 lucky!' : ''})`)
        } else {
          results.push(`${item.item_name} (${price}g)`)
        }
        await supabase.from('inventory').delete().eq('id', item.id)
      }

      const newGold = char.gold + totalGold
      await supabase.from('characters').update({ gold: newGold }).eq('twitch_username', username)

      client.say(
        channel,
        `💰 @${username} sold ${sellable.length} items for ${totalGold}g total! ` +
        `[${results.join(', ')}] | Gold: ${newGold}g`
      )
      return
    }

    // !sell [item name]
    const itemName = args.join(' ').toLowerCase()

    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .ilike('item_name', `%${itemName}%`)

    if (!items || items.length === 0) {
      client.say(channel, `@${username} — you don't have that item in your inventory.`)
      return
    }

    const item = items[0]

    if (item.equipped) {
      client.say(channel, `@${username} — you can't sell an equipped item. Use !unequip [slot] first.`)
      return
    }

    if (item.is_cursed && item.curse_revealed) {
      client.say(channel, `@${username} — you can't sell a cursed item. Find a !shrine to remove it first.`)
      return
    }

    const { price, rolled } = rollSellPrice(item.rarity)
    const doubled = DOUBLE_RARITIES.includes(item.rarity) && price === (SELL_PRICES[item.rarity] ?? 0) * 2
    const newGold = char.gold + price

    await supabase.from('inventory').delete().eq('id', item.id)
    await supabase.from('characters').update({ gold: newGold }).eq('twitch_username', username)

    const rollMsg = DOUBLE_RARITIES.includes(item.rarity)
      ? ` (🎲 rolled ${rolled}${doubled ? ' — lucky double!' : ''})` : ''

    client.say(
      channel,
      `💰 @${username} sold their ${item.item_name} for ${price}g!${rollMsg} | Gold: ${newGold}g`
    )
  }
}