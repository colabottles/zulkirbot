import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { createChallenge, getChallenge, isInDuel } from '../lib/duels'
import { d100 } from '../game/dice'
import { formatClass } from '../lib/format'

export const duelCommand: BotCommand = {
  name: 'duel',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !duel @user`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    if (target === username) {
      client.say(channel, `@${username} — you can't duel yourself!`)
      return
    }

    if (activeFights.has(username)) {
      client.say(channel, `@${username} — finish your current fight before challenging someone!`)
      return
    }

    if (isInDuel(username)) {
      client.say(channel, `@${username} — you're already in a duel!`)
      return
    }

    if (isInDuel(target)) {
      client.say(channel, `@${username} — ${target} is already in a duel!`)
      return
    }

    if (activeFights.has(target)) {
      client.say(channel, `@${username} — ${target} is currently in a fight!`)
      return
    }

    const { data: challenger } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!challenger) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const { data: targetChar } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!targetChar) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    // Level range check ±2
    if (Math.abs(challenger.level - targetChar.level) > 2) {
      client.say(
        channel,
        `@${username} — level mismatch! You are Level ${challenger.level} and ${target} is Level ${targetChar.level}. ` +
        `Duels require players to be within 2 levels of each other.`
      )
      return
    }

    createChallenge(username, target, channel)

    client.say(
      channel,
      `⚔️ @${username} (${formatClass(challenger.class)} Lv.${challenger.level}) challenges ` +
      `@${target} (${formatClass(targetChar.class)} Lv.${targetChar.level}) to a duel! ` +
      `@${target} — type !accept to fight or !decline to back down. You have 3 minutes!`
    )
  }
}