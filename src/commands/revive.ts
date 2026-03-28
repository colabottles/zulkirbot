import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const reviveCommand: BotCommand = {
  name: 'revive',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !revive [user]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    // Check they don't already have a character
    const { data: existing } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', target)
      .single()

    if (existing) {
      client.say(channel, `@${username} — ${target} is already alive!`)
      return
    }

    // Check graveyard for their last character
    const { data: fallen } = await supabase
      .from('graveyard')
      .select('*')
      .eq('twitch_username', target)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!fallen) {
      client.say(channel, `@${username} — ${target} has no fallen character to revive.`)
      return
    }

    const CLASS_HP: Record<string, number> = {
      alchemist: 5, artificer: 4, barbarian: 7, bard: 4, cleric: 5,
      druid: 5, favored_soul: 5, fighter: 6, monk: 5, paladin: 6,
      ranger: 6, rogue: 4, sorcerer: 3, warlock: 4, wizard: 3,
      sacred_fist: 6, dark_apostate: 5, stormsinger: 4, blightcaster: 5,
      acolyte_of_the_skin: 4, dark_hunter: 6, dragon_lord: 6,
      wild_mage: 3, dragon_disciple: 5, arcane_trickster: 4,
    }

    const maxHp = (CLASS_HP[fallen.class] ?? 5) * fallen.level

    await supabase.from('characters').insert({
      twitch_username: fallen.twitch_username,
      display_name: fallen.display_name,
      class: fallen.class,
      level: fallen.level,
      xp: fallen.xp,
      hp: maxHp,
      max_hp: maxHp,
      gold: 10,
    })

    client.say(
      channel,
      `✨ The dungeon master reaches into the graveyard and pulls @${target} back to life! ` +
      `They return as a Level ${fallen.level} ${fallen.class} with ${maxHp} HP.`
    )
  }
}