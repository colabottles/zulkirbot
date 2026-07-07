import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'
import {
  getNextRarity, getUpgradeCost, rollUpgradeFailure,
  STAT_BONUS_ON_UPGRADE
} from '../game/upgradeSystem'
import { trimGraveyard } from '../lib/graveyard'

export const upgradeCommand: BotCommand = {
  name: 'upgrade',
  aliases: ['ug'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel,
        `@${username} — usage: !upgrade [item name]. ` +
        `Item must be unequipped. Costs: gold + refinement stones + motes (at higher tiers).`
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

    // Find unequipped item
    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .eq('equipped', false)
      .ilike('item_name', `%${itemName}%`)

    if (!items || items.length === 0) {
      client.say(channel,
        `@${username} — item not found in your unequipped inventory. ` +
        `Items must be unequipped before upgrading.`
      )
      return
    }

    const item = items[0]

    // Cursed items cannot be upgraded
    if (item.is_cursed) {
      const penalty = Math.floor(char.gold * 0.10)
      const newGold = Math.max(0, char.gold - penalty)
      await supabase
        .from('characters')
        .update({ gold: newGold })
        .eq('twitch_username', username)
      client.say(channel,
        `⚠️ @${username} — the dark energy in ${item.item_name} recoils violently. ` +
        `Cursed items cannot be upgraded. The attempt costs you ${penalty}gp. ` +
        `(${newGold}gp remaining)`
      )
      return
    }

    // Already mythic
    const nextRarity = getNextRarity(item.rarity)
    if (!nextRarity) {
      client.say(channel,
        `@${username} — ${item.item_name} is already Mythic. It cannot be upgraded further.`
      )
      return
    }

    const cost = getUpgradeCost(item.rarity)
    if (!cost) return

    // Check resources
    if (char.gold < cost.gold) {
      client.say(channel,
        `@${username} — not enough gold. Need ${cost.gold}gp, you have ${char.gold}gp.`
      )
      return
    }

    if ((char.refinement_stones ?? 0) < cost.stones) {
      client.say(channel,
        `@${username} — not enough refinement stones. Need ${cost.stones}, you have ${char.refinement_stones ?? 0}.`
      )
      return
    }

    if ((char.motes ?? 0) < cost.motes) {
      client.say(channel,
        `@${username} — not enough motes. Need ${cost.motes}, you have ${char.motes ?? 0}.`
      )
      return
    }

    // Deduct resources
    await supabase
      .from('characters')
      .update({
        gold: char.gold - cost.gold,
        refinement_stones: (char.refinement_stones ?? 0) - cost.stones,
        motes: (char.motes ?? 0) - cost.motes,
      })
      .eq('twitch_username', username)

    // Roll for failure
    const outcome = rollUpgradeFailure(cost.failChance)

    if (outcome === 'success') {
      const bonusIncrease = STAT_BONUS_ON_UPGRADE[`${item.rarity}->${nextRarity}`] ?? 1
      await supabase
        .from('inventory')
        .update({
          rarity: nextRarity,
          stat_bonus: item.stat_bonus + bonusIncrease,
          upgrade_count: (item.upgrade_count ?? 0) + 1,
        })
        .eq('id', item.id)

      client.say(channel,
        `✨ @${username} — ${item.item_name} upgraded successfully! ` +
        `${formatRarity(item.rarity)} → ${formatRarity(nextRarity)} ` +
        `(+${bonusIncrease} stat bonus, now +${item.stat_bonus + bonusIncrease})`
      )

    } else if (outcome === 'material_loss') {
      client.say(channel,
        `💨 @${username} — the upgrade fails. The materials are consumed but ${item.item_name} is unharmed. ` +
        `(-${cost.gold}gp, -${cost.stones} stones${cost.motes > 0 ? `, -${cost.motes} motes` : ''})`
      )

    } else if (outcome === 'stat_damage') {
      const newBonus = Math.max(0, item.stat_bonus - 1)
      await supabase
        .from('inventory')
        .update({ stat_bonus: newBonus })
        .eq('id', item.id)

      client.say(channel,
        `💥 @${username} — the upgrade fails and damages ${item.item_name}! ` +
        `stat bonus reduced by 1 (now +${newBonus}). ` +
        `Materials consumed.`
      )

    } else {
      // Destroyed
      await supabase
        .from('inventory')
        .delete()
        .eq('id', item.id)

      client.say(channel,
        `💀 @${username} — the upgrade catastrophically fails. ` +
        `${item.item_name} is destroyed. Materials consumed. ` +
        `The dungeon offers no refunds.`
      )
    }
  }
}