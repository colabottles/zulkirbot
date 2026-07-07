import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import {
  getStronghold, getStrongholdRooms, getTierName,
  formAlliance, hasAlliance
} from '../lib/stronghold'
import { d100 } from '../game/dice'

export const visitStrongholdCommand: BotCommand = {
  name: 'visit',
  aliases: ['vs'],
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !visit [@username]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    if (target === username) {
      client.say(channel, `@${username} — you can't visit your own stronghold.`)
      return
    }

    // Visitor must have a stronghold
    const visitorStronghold = await getStronghold(username)
    if (!visitorStronghold || visitorStronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you need a stronghold of your own before visiting others. ` +
        `Use !stronghold build to establish one.`
      )
      return
    }

    // Target must have a stronghold
    const targetStronghold = await getStronghold(target)
    if (!targetStronghold || targetStronghold.is_destroyed) {
      client.say(channel,
        `@${username} — ${target} doesn't have a stronghold to visit.`
      )
      return
    }

    const targetTierName = getTierName(targetStronghold.stronghold_type, targetStronghold.tier)
    const rooms = await getStrongholdRooms(target)
    const roomNames = rooms.map((r: any) => r.room_type)

    const benefits: string[] = []

    // Morale boost to host
    const newMorale = Math.min(100, targetStronghold.morale + 5)
    await supabase
      .from('strongholds')
      .update({ morale: newMorale })
      .eq('twitch_username', target)

    // Tavern — visitor heals 10 HP
    if (roomNames.includes('tavern')) {
      const { data: visitorChar } = await supabase
        .from('characters')
        .select('hp, max_hp')
        .eq('twitch_username', username)
        .single()

      if (visitorChar) {
        const healed = Math.min(10, visitorChar.max_hp - visitorChar.hp)
        if (healed > 0) {
          await supabase
            .from('characters')
            .update({ hp: visitorChar.hp + healed })
            .eq('twitch_username', username)
          benefits.push(`+${healed} HP from the tavern`)
        }
      }
    }

    // Library — visitor gains 50 XP
    if (roomNames.includes('library')) {
      const { data: visitorChar } = await supabase
        .from('characters')
        .select('xp')
        .eq('twitch_username', username)
        .single()

      if (visitorChar) {
        await supabase
          .from('characters')
          .update({ xp: visitorChar.xp + 50 })
          .eq('twitch_username', username)
        benefits.push('+50 XP from the library')
      }
    }

    // Magic Laboratory — spell casters get spell points
    if (roomNames.includes('magic_laboratory')) {
      const { data: visitorChar } = await supabase
        .from('characters')
        .select('class')
        .eq('twitch_username', username)
        .single()

      const CASTER_CLASSES = [
        'wizard', 'sorcerer', 'warlock', 'wild_mage', 'bard',
        'cleric', 'druid', 'favored_soul', 'dark_apostate',
        'blightcaster', 'arcane_trickster', 'dragon_disciple',
      ]

      if (visitorChar && CASTER_CLASSES.includes(visitorChar.class)) {
        const { data: spellPoints } = await supabase
          .from('player_spell_points')
          .select('current, max')
          .eq('username', username)
          .single()

        if (spellPoints && spellPoints.current < spellPoints.max) {
          const restored = Math.min(3, spellPoints.max - spellPoints.current)
          await supabase
            .from('player_spell_points')
            .update({ current: spellPoints.current + restored })
            .eq('username', username)
          benefits.push(`+${restored} spell points from the magic laboratory`)
        }
      }
    }

    // Alliance chance — 10%
    const alreadyAllied = await hasAlliance(username, target)
    let allianceMsg = ''

    if (!alreadyAllied && d100() <= 10) {
      await formAlliance(username, target)
      allianceMsg = ` An alliance has been formed between @${username} and @${target}! (+2 DEF to both)`

      // Apply DEF bonus to both
      await supabase
        .from('strongholds')
        .update({ defense: visitorStronghold.defense + 2 })
        .eq('twitch_username', username)

      await supabase
        .from('strongholds')
        .update({ defense: targetStronghold.defense + 2 })
        .eq('twitch_username', target)
    } else if (alreadyAllied) {
      allianceMsg = ` (Allied)`
    }

    const benefitMsg = benefits.length > 0
      ? ` Benefits: ${benefits.join(', ')}.`
      : ''

    client.say(channel,
      `🏰 @${username} visits ${target}'s ${targetTierName}!${benefitMsg} ` +
      `(+5 morale to ${target}'s stronghold)${allianceMsg}`
    )
  }
}