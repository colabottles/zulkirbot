import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const givegoldCommand: BotCommand = {
  name: 'givegold',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !givegold [user] [amount]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()
    const amount = parseInt(args[1])

    if (isNaN(amount) || amount <= 0) {
      client.say(channel, `@${username} — invalid amount.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    const characterName = char.character_name ?? target

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    await supabase
      .from('characters')
      .update({ gold: char.gold + amount })
      .eq('twitch_username', target)

    client.say(
      channel,
      `💰 @${target} (${characterName}) has been granted ${amount}gp by the dungeon master! (Gold: ${char.gold + amount}gp)`
    )
  }
}