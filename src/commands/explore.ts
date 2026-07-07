import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { d100, d6 } from '../game/dice'
import { d6 as rollD6 } from '../game/dice'
import { rollLoot, rollLootByRarity } from '../game/loot'
import { getTrapForLevel, rollTrapDamage, DISARM_CLASSES, DISARM_CHANCE } from '../game/traps'
import { trimGraveyard } from '../lib/graveyard'
import { setPendingEvent, pendingRogueEvents } from './rogue_commands'
import { formatRarity } from '../lib/rarity'
import { applyExploreEffect } from '../lib/exploreEffects'
import { triggerHazard } from '../lib/applyHazard'
import { pickRiddle } from '../game/riddles'
import { setPendingRiddle } from './solveriddle'
import { triggerGodShrine } from '../lib/applyShrine'
import { triggerNpcEncounter } from '../lib/npcEncounter'
import { startFight } from '../game/engine'

export const exploreCommand: BotCommand = {
  name: 'explore',
  aliases: ['x'],
  cooldownSeconds: 3,
  handler: async (channel, username, args, client) => {
    if (args.length > 0) return

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

    // Zero-kill penalty — higher monster encounter rate and reduced rare+ loot
    const hasNoKills = (char.kill_count ?? 0) === 0
    const isNeutralAgent = username === 'neutralagent'

    // Wandering monster — 15% chance for zero-kill players (normal is ~0%)
    if (hasNoKills && d100() <= 15) {
      client.say(channel,
        `👣 @${username} — something has been following you. It stops following and starts attacking.`
      )
      await startFight(channel, username, client)
      return
    }

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
      const item = hasNoKills ? rollLootByRarity('uncommon') : rollLoot()
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

    // 3% chance: random buff event
    if (roll <= 69) {
      const buffEvents = [
        { stat: 'attack' as const, amount: 3, msg: `⚡ A surge of arcane energy courses through @${username}! +3 ATK until your next fight ends.`, source: 'arcane_surge' },
        { stat: 'defense' as const, amount: 3, msg: `🛡️ @${username} finds a blessed ward scratched into the dungeon wall. +3 DEF until your next fight ends.`, source: 'blessed_ward' },
        { stat: 'damage' as const, amount: 3, msg: `🔥 @${username} touches a smoldering rune. Your strikes burn hotter. +3 DMG until your next fight ends.`, source: 'smoldering_rune' },
        { stat: 'attack' as const, amount: 5, msg: `✨ @${username} steps through a beam of divine light. Clarity sharpens your aim. +5 ATK until your next fight ends.`, source: 'divine_light' },
        { stat: 'defense' as const, amount: 5, msg: `🪨 @${username} finds an old ward stone still active. The protection settles over you. +5 DEF until your next fight ends.`, source: 'ward_stone' },
        { stat: 'damage' as const, amount: 5, msg: `⚔️ @${username} discovers a weapon oil left by a previous adventurer. Applied. +5 DMG until your next fight ends.`, source: 'weapon_oil' },
      ]
      const event = buffEvents[Math.floor(Math.random() * buffEvents.length)]
      await applyExploreEffect(username, 'buff', event.stat, event.amount, event.source, 24 * 60 * 60 * 1000)
      client.say(channel, event.msg)
      return
    }

    // 3% chance: random debuff event
    if (roll <= 72) {
      const debuffEvents = [
        { stat: 'attack' as const, amount: 3, msg: `😵 @${username} walks through a confusion hex. Your aim wavers. -3 ATK until your next fight ends or 1 hour.`, source: 'confusion_hex' },
        { stat: 'defense' as const, amount: 3, msg: `🕷️ @${username} disturbs a nest of dungeon spiders. Bites slow your reactions. -3 DEF until your next fight ends or 1 hour.`, source: 'spider_bites' },
        { stat: 'damage' as const, amount: 3, msg: `🌑 @${username} touches a draining shadow rune. Your strikes feel weak. -3 DMG until your next fight ends or 1 hour.`, source: 'shadow_rune' },
        { stat: 'attack' as const, amount: 5, msg: `💀 @${username} triggers a curse glyph. Something has hold of your sword arm. -5 ATK until your next fight ends or 1 hour.`, source: 'curse_glyph' },
        { stat: 'defense' as const, amount: 5, msg: `🩸 @${username} steps in something corrosive. Your armor is compromised. -5 DEF until your next fight ends or 1 hour.`, source: 'corrosive_floor' },
        { stat: 'damage' as const, amount: 5, msg: `🧊 @${username} is struck by a residual frost trap. Your muscles seize. -5 DMG until your next fight ends or 1 hour.`, source: 'frost_trap' },
      ]
      const event = debuffEvents[Math.floor(Math.random() * debuffEvents.length)]
      const oneHourMs = 60 * 60 * 1000
      await applyExploreEffect(username, 'debuff', event.stat, event.amount, event.source, oneHourMs)
      client.say(channel, event.msg)
      return
    }

    // 4% chance: environmental hazard
    if (roll <= 76) {
      await triggerHazard(client, channel, username)
      return
    }

    // 4% chance: riddle encounter
    if (roll <= 80) {
      const riddle = pickRiddle()
      setPendingRiddle(username, riddle.answer, async () => {
        client.say(channel,
          `🧩 @${username} — time's up. The voice in the dark is displeased.`
        )
        await triggerHazard(client, channel, username)
      })
      client.say(channel,
        `🧩 A voice echoes from the dark: "${riddle.question}" ` +
        `Type !solveriddle [answer] within 60 seconds. Wrong 3 times or time runs out and the dungeon punishes you.`
      )
      return
    }

    // 4% chance: god shrine encounter
    if (roll <= 84) {
      await triggerGodShrine(client, channel, username)
      return
    }

    // 5% chance: NPC encounter
    if (roll <= 89) {
      await triggerNpcEncounter(client, channel, username)
      return
    }

    // 8% chance: refinement stones
    if (roll <= 97) {
      const stones = 5 + Math.floor(Math.random() * 11)
      await supabase
        .from('characters')
        .update({ refinement_stones: (char.refinement_stones ?? 0) + stones })
        .eq('twitch_username', username)
      client.say(channel,
        `💎 @${username} finds a cache of refinement stones. +${stones} stones. ` +
        `(Total: ${(char.refinement_stones ?? 0) + stones})`
      )
      return
    }

    // 5% chance: mote
    if (roll <= 100 && Math.random() < 0.05) {
      await supabase
        .from('characters')
        .update({ motes: (char.motes ?? 0) + 1 })
        .eq('twitch_username', username)
      client.say(channel,
        `✨ @${username} finds a mote of power flickering in the dark. +1 mote. ` +
        `(Total: ${(char.motes ?? 0) + 1})`
      )
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