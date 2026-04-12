import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { getBrawlState, addParticipant } from '../lib/tavernBrawl'
import { hasTavernVisit } from '../lib/tavernSession'

export const brawlCommand: BotCommand = {
  name: 'brawl',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const brawl = getBrawlState()

    if (!brawl.joining) {
      client.say(channel, `@${username} — there's no brawl to join right now!`)
      return
    }

    if (!hasTavernVisit(username)) {
      client.say(channel, `@${username} — you need to buy a drink or meal first before joining a brawl!`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('id, hp')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    if (char.hp <= 0) {
      client.say(channel, `@${username} — you're already on the floor! Use !rest first.`)
      return
    }

    const added = addParticipant(username)
    if (!added) {
      client.say(channel, `@${username} — you're already in the brawl!`)
      return
    }

    client.say(
      channel,
      `👊 @${username} joins the brawl! (${brawl.participants.length} fighters so far)`
    )
  }
}