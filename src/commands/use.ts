import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { d100, d6, d8, d20 } from '../game/dice'

const OFFENSIVE_SCROLL_DAMAGE: Record<string, number> = {
  'scroll of magic missile': 8,
  'scroll of fireball': 12,
  'scroll of lightning bolt': 10,
  'scroll of ice storm': 9,
  'scroll of disintegrate': 15,
  'scroll of chain lightning': 11,
  'scroll of cone of cold': 10,
  'scroll of finger of death': 14,
  'scroll of acid arrow': 7,
  'scroll of flame strike': 11,
}

export const useCommand: BotCommand = {
  name: 'use',
  aliases: ['consume'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !use [item name]`)
      return
    }

    const itemName = args.join(' ').toLowerCase()

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
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

    if (item.item_type !== 'scroll' && item.item_type !== 'potion') {
      client.say(channel, `@${username} — you can't use that item. Try !equip instead.`)
      return
    }

    // Potions
    if (item.item_type === 'potion') {
      const fight = activeFights.get(username)
      const currentHp = fight ? fight.character_current_hp : char.hp

      if (currentHp >= char.max_hp) {
        client.say(channel, `@${username} — you're already at full health!`)
        return
      }

      const newHp = Math.min(currentHp + item.stat_bonus, char.max_hp)
      await supabase.from('inventory').delete().eq('id', item.id)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      if (fight) fight.character_current_hp = newHp

      client.say(
        channel,
        `🧪 @${username} drinks a ${item.item_name} and restores ${item.stat_bonus} HP! ` +
        `(HP: ${newHp}/${char.max_hp})`
      )
      return
    }

    // Scrolls
    const fight = activeFights.get(username)
    const scrollKey = item.item_name.toLowerCase()
    const isCureScroll = scrollKey.includes('cure')
    const isOffensive = !isCureScroll

    // Offensive scroll — must be in combat
    if (isOffensive) {
      if (!fight) {
        client.say(channel, `@${username} — you need to be in a fight to use an offensive scroll!`)
        return
      }

      // 10% fizzle chance
      if (d100() <= 10) {
        await supabase.from('inventory').delete().eq('id', item.id)
        client.say(channel, `💨 @${username} — the ${item.item_name} fizzles and does nothing!`)
        return
      }

      const baseDamage = OFFENSIVE_SCROLL_DAMAGE[scrollKey] ?? d8()
      const scaledDamage = baseDamage + Math.floor(char.level / 2)
      fight.monster_current_hp -= scaledDamage
      await supabase.from('inventory').delete().eq('id', item.id)

      if (fight.monster_current_hp <= 0) {
        const { handleVictory } = await import('../game/engine') as any
        client.say(
          channel,
          `📜 @${username} unleashes the ${item.item_name} for ${scaledDamage} damage! ` +
          `The ${fight.monster.name} is destroyed!`
        )
        return
      }

      client.say(
        channel,
        `📜 @${username} unleashes the ${item.item_name} for ${scaledDamage} damage! ` +
        `[${fight.monster.name} HP: ${fight.monster_current_hp}]`
      )
      return
    }

    // Healing scroll — must be out of combat
    if (fight) {
      client.say(channel, `@${username} — you can't use a healing scroll mid-fight!`)
      return
    }

    // 2% fizzle chance
    if (d100() <= 2) {
      await supabase.from('inventory').delete().eq('id', item.id)
      client.say(channel, `💨 @${username} — the ${item.item_name} fizzles and does nothing!`)
      return
    }

    // Heal amount scales with level and cure type
    const cureMultiplier: Record<string, number> = {
      'light': 1,
      'minor': 2,
      'moderate': 3,
      'serious': 4,
      'critical': 5,
    }

    let multiplier = 1
    for (const [key, val] of Object.entries(cureMultiplier)) {
      if (scrollKey.includes(key)) {
        multiplier = val
        break
      }
    }

    const healAmount = char.level * multiplier
    const newHp = Math.min(char.hp + healAmount, char.max_hp)
    await supabase.from('inventory').delete().eq('id', item.id)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

    client.say(
      channel,
      `📜 @${username} reads the ${item.item_name} and recovers ${healAmount} HP! ` +
      `(HP: ${newHp}/${char.max_hp})`
    )
  }
}