import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { getChallenge, removeChallenge, startDuel, isInDuel } from '../lib/duels'
import { d100 } from '../game/dice'

export const acceptCommand: BotCommand = {
  name: 'accept',
  cooldownSeconds: 3,
  handler: async (channel, username, args, client) => {
    const challenge = getChallenge(username)

    if (!challenge) {
      client.say(channel, `@${username} — you don't have a pending duel challenge.`)
      return
    }

    if (activeFights.has(username) || isInDuel(username)) {
      client.say(channel, `@${username} — you can't accept a duel right now.`)
      return
    }

    const { data: challengerChar } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', challenge.challenger)
      .single()

    const { data: targetChar } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!challengerChar || !targetChar) {
      client.say(channel, `@${username} — something went wrong finding both characters.`)
      removeChallenge(username)
      return
    }

    removeChallenge(username)

    // Roll for initiative
    const challengerRoll = d100()
    const targetRoll = d100()
    const firstTurn = challengerRoll >= targetRoll
      ? challenge.challenger
      : username

    const secondTurn = firstTurn === challenge.challenger
      ? username
      : challenge.challenger

    startDuel(
      challenge.challenger,
      username,
      channel,
      challengerChar.hp,
      targetChar.hp,
      firstTurn
    )

    client.say(
      channel,
      `⚔️ The duel begins! ` +
      `@${challenge.challenger} rolled ${challengerRoll} | @${username} rolled ${targetRoll}. ` +
      `@${firstTurn} goes first! Type !strike to attack. @${secondTurn} — hold your ground!`
    )
  }
}