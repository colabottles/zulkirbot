import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { d100 } from '../game/dice'
import { activeFights } from '../game/engine'
import { resetTurnUndeadCooldown } from './turnundead'
import { hirelingRest } from './hireling'
import { rechargeSpellPoints } from '../lib/spellPoints'

export const shrineCommand: BotCommand = {
  name: 'shrine',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    if (activeFights.has(username)) {
      client.say(channel, `@${username} — you can't visit a shrine while in a fight!`)
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

    // Find all cursed equipped items
    const slotColumns = [
      'equipped_weapon', 'equipped_shield', 'equipped_armor', 'equipped_helmet',
      'equipped_cloak', 'equipped_neck', 'equipped_eyes', 'equipped_waist',
      'equipped_arms', 'equipped_hands', 'equipped_feet',
      'equipped_ring1', 'equipped_ring2', 'equipped_trinket',
    ]

    const equippedIds = slotColumns
      .map(col => char[col])
      .filter(Boolean)

    if (equippedIds.length === 0) {
      client.say(channel, `🛕 @${username} kneels at the shrine but has nothing cursed to cleanse.`)
      return
    }

    const { data: cursedItems } = await supabase
      .from('inventory')
      .select('*')
      .in('id', equippedIds)
      .eq('is_cursed', true)
      .eq('curse_revealed', true)

    if (!cursedItems || cursedItems.length === 0) {
      client.say(channel, `🛕 @${username} kneels at the shrine but has nothing cursed to cleanse.`)
      return
    }

    // Pick the first cursed item to attempt removal
    const cursedItem = cursedItems[0]
    const roll = d100()

    if (roll <= 15) {
      // Success — remove the curse
      await supabase
        .from('inventory')
        .update({ is_cursed: false, curse_revealed: false, equipped: false })
        .eq('id', cursedItem.id)

      // Clear the slot on the character
      const slotToClear = slotColumns.find(col => char[col] === cursedItem.id)
      if (slotToClear) {
        await supabase
          .from('characters')
          .update({ [slotToClear]: null })
          .eq('twitch_username', username)
      }

      client.say(
        channel,
        `🛕 @${username} prays at the shrine — the curse on their ${cursedItem.item_name} is lifted! ` +
        `The item has been unequipped and cleansed.`
      )
    } else {
      client.say(
        channel,
        `🛕 @${username} prays at the shrine but the gods do not answer. ` +
        `The ${cursedItem.item_name} remains cursed. (${100 - roll}% away from success)`
      )
      resetTurnUndeadCooldown(username)
      hirelingRest(username)
      await rechargeSpellPoints(username)
    }
  }
}