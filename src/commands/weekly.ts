import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { d100 } from '../game/dice'
import { rollLootByRarity } from '../game/loot'
import { calculateLevel } from '../game/engine'
import { CLASS_HP } from '../lib/classes'

const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export const weeklyCommand: BotCommand = {
  name: 'weekly',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const now = Date.now()
    const lastClaimed = char.weekly_claimed_at
      ? new Date(char.weekly_claimed_at).getTime()
      : 0

    if (now - lastClaimed < WEEKLY_COOLDOWN_MS) {
      const remainingMs = WEEKLY_COOLDOWN_MS - (now - lastClaimed)
      const remainingDays = Math.floor(remainingMs / 86400000)
      const remainingHours = Math.floor((remainingMs % 86400000) / 3600000)
      client.say(
        channel,
        `@${username} — you already claimed your weekly reward! ` +
        `Come back in ${remainingDays}d ${remainingHours}h.`
      )
      return
    }

    const xp = Math.floor(Math.random() * 2000) + 1
    const newXp = char.xp + xp

    await supabase
      .from('characters')
      .update({
        xp: newXp,
        weekly_claimed_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)

    // 7% chance at uncommon or rarer item
    const itemRoll = d100()
    let itemMsg = ''

    if (itemRoll <= 7) {
      const rarityRoll = d100()
      const rarity = rarityRoll <= 3
        ? 'legendary'
        : rarityRoll <= 15
          ? 'rare'
          : 'uncommon'

      const item = rollLootByRarity(rarity)

      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: item.name,
        item_type: item.type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description,
      })

      itemMsg = ` You also find a ${item.rarity.toUpperCase()} ${item.name} in your pack!`
    }

    // After calculating newXp
    const { newLevel, newXpTotal } = calculateLevel(newXp)
    const leveledUp = newLevel > char.level

    const hpPerLevel = CLASS_HP[char.class] ?? 5
    const levelsGained = newLevel - char.level
    const newMaxHp = char.max_hp + (hpPerLevel * levelsGained)

    await supabase
      .from('characters')
      .update({
        xp: newXpTotal,
        level: newLevel,
        max_hp: newMaxHp,
        hp: Math.min(char.hp + (hpPerLevel * levelsGained), newMaxHp),
        weekly_claimed_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)

    const levelMsg = leveledUp
      ? ` 🎉 LEVEL UP! You are now Level ${newLevel}!`
      : ''

    client.say(
      channel,
      `🎁 @${username} claims their weekly reward — +${xp} XP!${itemMsg}`
    )
  }
}