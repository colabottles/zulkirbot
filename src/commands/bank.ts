import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const BANK_SLOTS = 50

export const bankCommand: BotCommand = {
  name: 'bank',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !bank deposit [item] | !bank withdraw [item] | !bank depositall | !bank list`)
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

    const sub = args[0].toLowerCase()

    // !bank list
    if (sub === 'list') {
      const { data: banked } = await supabase
        .from('bank')
        .select('*')
        .eq('character_id', char.id)
        .order('created_at', { ascending: true })

      if (!banked || banked.length === 0) {
        client.say(channel, `@${username} — your bank vault is empty. (0/${BANK_SLOTS} slots used)`)
        return
      }

      const itemList = banked.map((i, idx) => `${idx + 1}. ${i.item_name} [${i.rarity}]`).join(', ')
      client.say(channel, `🏦 @${username}'s vault (${banked.length}/${BANK_SLOTS}): ${itemList}`)
      return
    }

    // !bank deposit [item]
    if (sub === 'deposit') {
      const itemName = args.slice(1).join(' ').toLowerCase()
      if (!itemName) {
        client.say(channel, `@${username} — usage: !bank deposit [item name]`)
        return
      }

      const { data: banked } = await supabase
        .from('bank')
        .select('id')
        .eq('character_id', char.id)

      if (banked && banked.length >= BANK_SLOTS) {
        client.say(channel, `@${username} — your vault is full! (${BANK_SLOTS}/${BANK_SLOTS} slots used)`)
        return
      }

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
        client.say(channel, `@${username} — unequip that item first before depositing it.`)
        return
      }

      await supabase.from('bank').insert({
        character_id: char.id,
        twitch_username: username,
        item_name: item.item_name,
        item_type: item.item_type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description ?? '',
        is_cursed: item.is_cursed ?? false,
      })

      await supabase.from('inventory').delete().eq('id', item.id)

      const remaining = BANK_SLOTS - ((banked?.length ?? 0) + 1)
      client.say(channel, `🏦 @${username} deposited ${item.item_name} into their vault. (${remaining} slots remaining)`)
      return
    }

    // !bank depositall
    if (sub === 'depositall') {
      const { data: banked } = await supabase
        .from('bank')
        .select('id')
        .eq('character_id', char.id)

      const usedSlots = banked?.length ?? 0
      const availableSlots = BANK_SLOTS - usedSlots

      if (availableSlots <= 0) {
        client.say(channel, `@${username} — your vault is full! (${BANK_SLOTS}/${BANK_SLOTS} slots used)`)
        return
      }

      const { data: items } = await supabase
        .from('inventory')
        .select('*')
        .eq('character_id', char.id)
        .eq('equipped', false)

      if (!items || items.length === 0) {
        client.say(channel, `@${username} — no unequipped items to deposit.`)
        return
      }

      const toDeposit = items.slice(0, availableSlots)

      for (const item of toDeposit) {
        await supabase.from('bank').insert({
          character_id: char.id,
          twitch_username: username,
          item_name: item.item_name,
          item_type: item.item_type,
          rarity: item.rarity,
          stat_bonus: item.stat_bonus,
          description: item.description ?? '',
          is_cursed: item.is_cursed ?? false,
        })
        await supabase.from('inventory').delete().eq('id', item.id)
      }

      const newUsed = usedSlots + toDeposit.length
      client.say(
        channel,
        `🏦 @${username} deposited ${toDeposit.length} items into their vault. ` +
        `(${BANK_SLOTS - newUsed} slots remaining)` +
        `${toDeposit.length < items.length ? ` — ${items.length - toDeposit.length} items left behind (vault full)` : ''}`
      )
      return
    }

    // !bank withdraw [item]
    if (sub === 'withdraw') {
      const itemName = args.slice(1).join(' ').toLowerCase()
      if (!itemName) {
        client.say(channel, `@${username} — usage: !bank withdraw [item name]`)
        return
      }

      const { data: bankedItems } = await supabase
        .from('bank')
        .select('*')
        .eq('character_id', char.id)
        .ilike('item_name', `%${itemName}%`)

      if (!bankedItems || bankedItems.length === 0) {
        client.say(channel, `@${username} — that item isn't in your vault.`)
        return
      }

      const item = bankedItems[0]

      await supabase.from('inventory').insert({
        character_id: char.id,
        twitch_username: username,
        item_name: item.item_name,
        item_type: item.item_type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description ?? '',
        is_cursed: item.is_cursed ?? false,
        equipped: false,
      })

      await supabase.from('bank').delete().eq('id', item.id)

      client.say(channel, `🏦 @${username} withdrew ${item.item_name} from their vault.`)
      return
    }

    client.say(channel, `@${username} — usage: !bank deposit [item] | !bank withdraw [item] | !bank depositall | !bank list`)
  }
}