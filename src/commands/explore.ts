import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { d100, d6 } from '../game/dice'
import { rollLoot } from '../game/loot'
import { getTrapForLevel, rollTrapDamage, DISARM_CLASSES, DISARM_CHANCE } from '../game/traps'
import { trimGraveyard } from '../lib/graveyard'
import { setPendingEvent, pendingRogueEvents } from './rogue_commands'
import { formatRarity } from '../lib/rarity'

export const exploreCommand: BotCommand = {
  name: 'explore',
  aliases: ['x'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    if (activeFights.has(username)) {
      client.say(channel, `@${username} — finish your fight first.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const roll = d100()

    // 10% chance: trap
    if (roll <= 10) {
      const trap = getTrapForLevel(char.level)
      const canDisarm = DISARM_CLASSES.includes(char.class)

      if (canDisarm && d100() <= DISARM_CHANCE) {
        client.say(channel, `🔧 @${username} disarms a ${trap.name} before it triggers.`)
        return
      }

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
        client.say(channel, `💀 @${username} ${trap.deathMessage}! Use !join to start over.`)
        return
      }

      const damage = rollTrapDamage(trap)
      const { data: freshChar } = await supabase
        .from('characters')
        .select('hp')
        .eq('twitch_username', username)
        .single()
      const newHp = (freshChar?.hp ?? char.hp) - damage

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
        client.say(channel, `💀 @${username} — ${trap.description} for ${damage} damage! Slain by a ${trap.name}. Use !join to start over.`)
        return
      }

      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      client.say(channel, `🪤 @${username} — ${trap.description} for ${damage} damage! (HP: ${newHp}/${char.max_hp})`)
      return
    }

    // 2% chance: treasure chest
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
      await supabase.from('characters').update({ gold: char.gold + gold }).eq('twitch_username', username)
      client.say(channel, `🎁 @${username} finds a hidden chest! ${formatRarity(item.rarity)} ${item.name} and ${gold}gp!`)
      return
    }

    // 18% chance: gold
    if (roll <= 30) {
      const gold = d6() * 2
      await supabase.from('characters').update({ gold: char.gold + gold }).eq('twitch_username', username)
      client.say(channel, `💰 @${username} finds ${gold}gp.`)
      return
    }

    // 3% chance: shrine
    if (roll <= 33) {
      client.say(channel, `🛕 @${username} finds an ancient shrine! Use !shrine to pray.`)
      return
    }

    // 3% chance: locked chest
    if (roll <= 36) {
      setPendingEvent(username, 'locked_chest')
      client.say(channel, `🔒 @${username} finds a locked chest. Use !picklock to open it. (3 min)`)
      return
    }

    // 2% chance: trapped chest
    if (roll <= 38) {
      setPendingEvent(username, 'trapped_chest')
      pendingRogueEvents.get(username)!.sensed = true
      client.say(channel, `⚠️ @${username} spots a chest that feels off. Use !findtraps to investigate. (3 min)`)
      return
    }

    // 2% chance: hidden door
    if (roll <= 40) {
      setPendingEvent(username, 'hidden_door')
      pendingRogueEvents.get(username)!.sensed = true
      client.say(channel, `🧱 @${username} — this section of wall looks wrong. Use !searchdoor to investigate. (3 min)`)
      return
    }

    // 2% chance: trapped corridor
    if (roll <= 42) {
      setPendingEvent(username, 'trapped_corridor')
      pendingRogueEvents.get(username)!.sensed = true
      client.say(channel, `🕸️ @${username} — the corridor ahead feels wrong. Use !findtraps to check it. (3 min)`)
      return
    }

    // 14% chance: common item
    if (roll <= 56) {
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
      client.say(channel, `🎒 @${username} finds a ${item.name}!`)
      return
    }

    // 10% chance: potion
    if (roll <= 66) {
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: 'Health Potion',
        item_type: 'potion',
        rarity: 'common',
        stat_bonus: 10,
        description: 'Restores 10 HP.',
      })
      client.say(channel, `🧪 @${username} finds a Health Potion!`)
      return
    }

    // ~0.25% chance: Deck of Many Things
    if (d100() <= 1 && d100() <= 25) {
      const { drawCard } = await import('./new_commands')
      client.say(channel, `@${username} finds a worn deck of cards...`)
      await drawCard(channel, username, client, supabase)
      return
    }

    // Nothing found
    const emptyMessages = [
      `@${username} — nothing here but dust.`,
      `@${username} — the dungeon keeps its secrets.`,
      `@${username} — nothing stirs.`,
    ]
    client.say(channel, emptyMessages[Math.floor(Math.random() * emptyMessages.length)])
  }
}