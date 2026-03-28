import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'

export const potionCommand: BotCommand = {
  name: 'potion',
  aliases: ['drink', 'heal', 'quaff'],
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    const fight = activeFights.get(username)
    const currentHp = fight ? fight.character_current_hp : char.hp

    if (currentHp >= char.max_hp) {
      client.say(channel, `@${username} — you're already at full health!`)
      return
    }

    const { data: potions } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .eq('item_type', 'potion')
      .limit(1)

    if (!potions || potions.length === 0) {
      client.say(channel, `@${username} — you have no potions! Try !explore to find some.`)
      return
    }

    const potion = potions[0]
    const newHp = Math.min(currentHp + potion.stat_bonus, char.max_hp)

    await supabase.from('inventory').delete().eq('id', potion.id)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

    if (fight) fight.character_current_hp = newHp

    client.say(
      channel,
      `🧪 @${username} drinks a ${potion.item_name} and restores ${potion.stat_bonus} HP! ` +
      `(HP: ${newHp}/${char.max_hp})`
    )
  }
}