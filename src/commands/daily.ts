import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { d100 } from '../game/dice'

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000

export const dailyCommand: BotCommand = {
  name: 'daily',
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

    const now = Date.now()
    const lastClaimed = char.daily_claimed_at
      ? new Date(char.daily_claimed_at).getTime()
      : 0

    if (now - lastClaimed < DAILY_COOLDOWN_MS) {
      const remainingMs = DAILY_COOLDOWN_MS - (now - lastClaimed)
      const remainingHours = Math.floor(remainingMs / 3600000)
      const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000)
      client.say(
        channel,
        `@${username} — you already claimed your daily reward! ` +
        `Come back in ${remainingHours}h ${remainingMinutes}m.`
      )
      return
    }

    const gold = Math.floor(Math.random() * 100) + 1

    await supabase
      .from('characters')
      .update({
        gold: char.gold + gold,
        daily_claimed_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)

    client.say(
      channel,
      `🎁 @${username} (${characterName}) claims their daily reward — ${gold}gp! (Gold: ${char.gold + gold}gp)`
    )
  }
}