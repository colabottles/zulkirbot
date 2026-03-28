import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { d100, d6 } from '../game/dice'
import { rollLoot } from '../game/loot'
import { getTrapForLevel, rollTrapDamage, DISARM_CLASSES, DISARM_CHANCE } from '../game/traps'
import { trimGraveyard } from '../lib/graveyard'

export const exploreCommand: BotCommand = {
  name: 'explore',
  aliases: ['search', 'scout'],
  cooldownSeconds: 30,
  handler: async (channel, username, _args, client) => {
    if (activeFights.has(username)) {
      client.say(channel, `@${username} — you're in a fight! Finish it first before exploring.`)
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

    const roll = d100()

    // 10% chance: trap
    if (roll <= 10) {
      const trap = getTrapForLevel(char.level)
      const canDisarm = DISARM_CLASSES.includes(char.class)
      const disarmRoll = d100()

      // Disarm attempt for eligible classes
      if (canDisarm && disarmRoll <= DISARM_CHANCE) {
        client.say(
          channel,
          `🔧 @${username} spots and disarms a ${trap.name} before it can trigger. Handy skills!`
        )
        return
      }

      // Instant kill traps
      if (trap.type === 'instant_kill') {
        await supabase.from('graveyard').insert({
          twitch_username: char.twitch_username,
          display_name: char.display_name,
          class: char.class,
          level: char.level,
          xp: char.xp,
          killed_by: trap.name,
        })

        await trimGraveyard()
        await supabase.from('characters').delete().eq('twitch_username', username)

        client.say(
          channel,
          `💀 @${username} ${trap.deathMessage}! They are dead. Use !join to start over.`
        )
        return
      }

      // Regular trap damage
      const damage = rollTrapDamage(trap)
      const newHp = char.hp - damage

      if (newHp <= 0) {
        await supabase.from('graveyard').insert({
          twitch_username: char.twitch_username,
          display_name: char.display_name,
          class: char.class,
          level: char.level,
          xp: char.xp,
          killed_by: trap.name,
        })

        await trimGraveyard()
        await supabase.from('characters').delete().eq('twitch_username', username)

        client.say(
          channel,
          `💀 @${username} — ${trap.description} for ${damage} damage! ` +
          `They have been slain by a ${trap.name}. Use !join to start over.`
        )
        return
      }

      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

      client.say(
        channel,
        `🪤 @${username} — ${trap.description} for ${damage} damage! (HP: ${newHp}/${char.max_hp})`
      )
      return
    }

    // 2% chance: treasure chest (rolls 11-12)
    if (roll <= 12) {
      const item = rollLoot()
      const gold = d6() * 5
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: item.name,
        item_type: item.type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description,
      })
      await supabase.from('characters').update({
        gold: char.gold + gold,
      }).eq('twitch_username', username)

      client.say(
        channel,
        `🎁 @${username} discovers a hidden chest! Found a ${item.rarity.toUpperCase()} ${item.name} and ${gold}g!`
      )
      return
    }

    // 18% chance: find some gold (rolls 13-30)
    if (roll <= 30) {
      const gold = d6() * 2
      await supabase.from('characters').update({
        gold: char.gold + gold,
      }).eq('twitch_username', username)

      client.say(channel, `💰 @${username} finds ${gold}g tucked away in a crevice.`)
      return
    }

    // 3% chance: shrine (rolls 31-33)
    if (roll <= 33) {
      client.say(
        channel,
        `🛕 @${username} discovers an ancient shrine in the darkness! ` +
        `Type !shrine to pray for the removal of a cursed item.`
      )
      return
    }

    // 14% chance: find a common item (rolls 34-47)
    if (roll <= 47) {
      const { rollLootByRarity } = await import('../game/loot')
      const item = rollLootByRarity('common')
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: item.name,
        item_type: item.type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description,
      })
      client.say(
        channel,
        `🎒 @${username} finds a ${item.name} left behind by a previous adventurer!`
      )
      return
    }

    // 10% chance: find a potion (rolls 48-57)
    if (roll <= 57) {
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: 'Health Potion',
        item_type: 'potion',
        rarity: 'common',
        stat_bonus: 10,
        description: 'Restores 10 HP.',
      })
      client.say(channel, `🧪 @${username} finds a dusty Health Potion tucked in a crevice!`)
      return
    }

    // 43% chance: nothing
    const emptyMessages = [
      `@${username} searches the area but finds nothing but dust and cobwebs.`,
      `@${username} explores the shadows — nothing stirs.`,
      `@${username} finds only old bones and broken weapons.`,
      `@${username} turns up nothing. The dungeon keeps its secrets.`,
      `@${username} searches carefully but comes up empty.`,
    ]

    client.say(channel, emptyMessages[Math.floor(Math.random() * emptyMessages.length)])
  }
}