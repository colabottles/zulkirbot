import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'

export const shopCommand: BotCommand = {
  name: 'shop',
  aliases: ['store', 'buy'],
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

    // If no args, show shop inventory
    if (!args.length) {
      const { data: items } = await supabase
        .from('shop')
        .select('*')
        .order('price', { ascending: true })

      if (!items || items.length === 0) {
        client.say(channel, `@${username} — the shop is empty right now. Check back later!`)
        return
      }

      const list = items
        .map((i: any) => `${i.item_name} (${i.rarity}) — ${i.price}g`)
        .join(' | ')

      client.say(channel, `🏪 Shop (Gold: ${char.gold}g): ${list} — Use !shop buy [item name] to purchase`)
      return
    }

    // Buy an item
    if (args[0].toLowerCase() === 'buy') {
      const itemName = args.slice(1).join(' ').toLowerCase()

      if (!itemName) {
        client.say(channel, `@${username} — usage: !shop buy [item name]`)
        return
      }

      const { data: shopItems } = await supabase
        .from('shop')
        .select('*')
        .ilike('item_name', `%${itemName}%`)

      if (!shopItems || shopItems.length === 0) {
        client.say(channel, `@${username} — that item isn't in the shop right now.`)
        return
      }

      const shopItem = shopItems[0]

      if (char.gold < shopItem.price) {
        client.say(
          channel,
          `@${username} — you can't afford that! You have ${char.gold}g and it costs ${shopItem.price}g.`
        )
        return
      }

      const { error } = await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: shopItem.item_name,
        item_type: shopItem.item_type,
        rarity: shopItem.rarity,
        stat_bonus: shopItem.stat_bonus,
        description: shopItem.description,
        slot: shopItem.slot,
        is_cursed: shopItem.is_cursed,
        curse_revealed: false,
      })

      if (error) {
        console.error('Shop insert error:', error)
        client.say(channel, `@${username} — something went wrong with the purchase.`)
        return
      }

      await supabase
        .from('characters')
        .update({ gold: char.gold - shopItem.price })
        .eq('twitch_username', username)

      client.say(
        channel,
        `🏪 @${username} purchased ${shopItem.item_name} for ${shopItem.price}g! ` +
        `(Gold remaining: ${char.gold - shopItem.price}g)`
      )
    }
  }
}