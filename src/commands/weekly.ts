import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { d100 } from '../game/dice'
import { rollLootByRarity } from '../game/loot'
import { calculateLevel } from '../game/engine'
import { CLASS_HP_DIE, rollHp } from '../lib/classes'

function getLastMonday(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? 6 : day - 1 // days since last Monday
  const lastMonday = new Date(now)
  lastMonday.setUTCDate(now.getUTCDate() - diff)
  lastMonday.setUTCHours(0, 0, 0, 0)
  return lastMonday
}

export const weeklyCommand: BotCommand = {
  name: 'weekly',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    const characterName = char.character_name ?? username

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const lastMonday = getLastMonday()
    const lastClaimed = char.weekly_claimed_at
      ? new Date(char.weekly_claimed_at).getTime()
      : 0

    if (lastClaimed >= lastMonday.getTime()) {
      const nextMonday = new Date(lastMonday)
      nextMonday.setUTCDate(lastMonday.getUTCDate() + 7)
      const remainingMs = nextMonday.getTime() - Date.now()
      const remainingDays = Math.floor(remainingMs / 86400000)
      const remainingHours = Math.floor((remainingMs % 86400000) / 3600000)
      client.say(
        channel,
        `@${username} — you already claimed your weekly reward! ` +
        `Resets next Monday in ${remainingDays}d ${remainingHours}h.`
      )
      return
    }

    const xp = Math.floor(Math.random() * 1000) + 1
    const newXp = char.xp + xp
    const { newLevel, newXpTotal } = calculateLevel(newXp)
    const leveledUp = newLevel > char.level
    const hpDie = CLASS_HP_DIE[char.class] ?? 6
    const levelsGained = newLevel - char.level
    const tauntMsg = xp === 1 ? ` The gods mock you. 1 XP. Truly, a legend in the making.` : ''
    const hpRoll = Array.from({ length: levelsGained }, () => rollHp(hpDie)).reduce((a, b) => a + b, 0)
    const newMaxHp = char.max_hp + hpRoll
    const newHp = Math.min(char.hp + hpRoll, newMaxHp)

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

    await supabase
      .from('characters')
      .update({
        xp: newXpTotal,
        level: newLevel,
        max_hp: newMaxHp,
        hp: newHp,
        weekly_claimed_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)

    const levelMsg = leveledUp
      ? ` 🎉 LEVEL UP! You are now Level ${newLevel}!`
      : ''

    client.say(
      channel,
      `🎁 @${username} (${characterName}) claims their weekly reward — +${xp} XP!${tauntMsg}${itemMsg}${levelMsg}`
    )
  }
}