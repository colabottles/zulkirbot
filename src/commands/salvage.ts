import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'
import { SALVAGE_STONES, SALVAGE_MOTES } from '../game/upgradeSystem'
import { ItemRarity } from '../types'

export const salvageCommand: BotCommand = {
  name: 'salvage',
  aliases: ['sv'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel,
        `@${username} — usage: !salvage [item name]. ` +
        `Destroys an unequipped item and returns refinement stones and motes.`
      )
      return
    }

    const itemName = args.join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .eq('equipped', false)
      .ilike('item_name', `%${itemName}%`)

    if (!items || items.length === 0) {
      client.say(channel,
        `@${username} — item not found in your unequipped inventory.`
      )
      return
    }

    const item = items[0]

    if (item.is_cursed) {
      client.say(channel,
        `@${username} — cursed items cannot be salvaged. Visit a !shrine to remove the curse first.`
      )
      return
    }

    const stones = SALVAGE_STONES[item.rarity as ItemRarity] ?? 10
    const motes = SALVAGE_MOTES[item.rarity as ItemRarity] ?? 0

    await supabase
      .from('inventory')
      .delete()
      .eq('id', item.id)

    await supabase
      .from('characters')
      .update({
        refinement_stones: (char.refinement_stones ?? 0) + stones,
        motes: (char.motes ?? 0) + motes,
      })
      .eq('twitch_username', username)

    const motesMsg = motes > 0 ? ` and ${motes} mote${motes !== 1 ? 's' : ''}` : ''

    client.say(channel,
      `⚗️ @${username} salvaged their ${formatRarity(item.rarity)} ${item.item_name}. ` +
      `+${stones} refinement stones${motesMsg}. ` +
      `(Stones: ${(char.refinement_stones ?? 0) + stones} | Motes: ${(char.motes ?? 0) + motes})`
    )
  }
}