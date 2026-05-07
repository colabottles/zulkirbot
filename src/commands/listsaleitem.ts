import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'

const RARITY_BASE: Record<string, number> = {
  common: 10,
  uncommon: 30,
  rare: 60,
  epic: 100,
  legendary: 150,
  mythic: 200,
}

const LISTING_FEE = 10
const MAX_LISTINGS = 5

export const listsaleitemCommand: BotCommand = {
  name: 'listsaleitem',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !listsaleitem [item name] [price]`)
      return
    }

    const price = parseInt(args[args.length - 1])
    if (isNaN(price) || price <= 0) {
      client.say(channel, `@${username} — invalid price. Usage: !listsaleitem [item name] [price]`)
      return
    }

    const itemName = args.slice(0, -1).join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      return
    }

    if (char.gold < LISTING_FEE) {
      client.say(channel, `@${username} — you need ${LISTING_FEE}gp to list an item. You have ${char.gold}gp.`)
      return
    }

    // Check current listing count
    const { data: currentListings } = await supabase
      .from('shop')
      .select('id')
      .eq('listed_by', username)
      .eq('is_player_listing', true)

    if ((currentListings ?? []).length >= MAX_LISTINGS) {
      client.say(channel, `@${username} — you already have ${MAX_LISTINGS} items listed. Remove one with !removelisting [item name] first.`)
      return
    }

    // Find item in inventory
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
      client.say(channel, `@${username} — unequip the item first before listing it.`)
      return
    }

    if (item.is_cursed && item.curse_revealed) {
      client.say(channel, `@${username} — you can't list a cursed item.`)
      return
    }

    // Price cap
    const base = RARITY_BASE[item.rarity] ?? 10
    const maxPrice = item.purchase_price
      ? item.purchase_price
      : Math.floor(base * 0.8)

    if (price > maxPrice) {
      client.say(channel,
        `@${username} — price too high. Max for this item is ${maxPrice}gp ` +
        `(${item.purchase_price ? 'capped at purchase price' : '80% of base rarity value'}).`
      )
      return
    }

    // Deduct listing fee and remove from inventory
    await supabase.from('characters').update({ gold: char.gold - LISTING_FEE }).eq('twitch_username', username)
    await supabase.from('inventory').delete().eq('id', item.id)

    // Add to shop as player listing
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('shop').insert({
      item_name: item.item_name,
      item_type: item.item_type,
      rarity: item.rarity,
      stat_bonus: item.stat_bonus,
      description: item.description,
      is_cursed: item.is_cursed ?? false,
      purchase_price: item.purchase_price,
      price,
      owner: username,
      listed_by: username,
      listed_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_player_listing: true,
    })

    client.say(channel,
      `🏪 @${username} listed ${item.item_name} (${formatRarity(item.rarity)}) for ${price}gp! ` +
      `(-${LISTING_FEE}gp listing fee | expires in 24 hours)`
    )
  }
}