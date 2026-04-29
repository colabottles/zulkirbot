import { BotCommand } from '../types'
import { activeFights, handleDeath } from '../game/engine'
import { d20, d6 } from '../game/dice'
import { supabase } from '../lib/supabase'

export const fleeCommand: BotCommand = {
  name: 'flee',
  aliases: ['run', 'escape'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    const fight = activeFights.get(username)
    if (!fight) {
      client.say(channel, `@${username} — you're not in a fight! Nothing to flee from. 🐔`)
      return
    }

    // Guard: check character still exists (may have just died)
    const { data: char } = await supabase
      .from('characters')
      .select('id, hp, character_name')
      .eq('twitch_username', username)
      .single()

    if (!char || char.hp <= 0) {
      activeFights.delete(username) // clean up stale fight if still present
      return
    }

    const characterName = char.character_name ?? username

    // Monster gets a parting shot
    const monsterRoll = d20()
    const monsterHit = monsterRoll + fight.monster.attack > 12
    let monsterDamage = 0

    if (monsterHit) {
      monsterDamage = d6()
      fight.character_current_hp -= monsterDamage
    }

    // Monster kills them on the way out
    if (fight.character_current_hp <= 0) {
      await handleDeath(channel, username, fight, client)
      client.say(channel, `🐔 @${username} (${characterName}) tried to flee but was cut down by the ${fight.monster.name}! Cowardice has its price.`)
      return
    }

    // They make it out
    activeFights.delete(username)
    await supabase
      .from('characters')
      .update({ hp: fight.character_current_hp })
      .eq('twitch_username', username)
    const damageMsg = monsterHit
      ? `The ${fight.monster.name} hit you for ${monsterDamage} damage on your way out!`
      : `The ${fight.monster.name} missed as you ran!`

    client.say(channel, `🐔 @${username} (${characterName}) flees from the ${fight.monster.name}! ${damageMsg} (HP: ${fight.character_current_hp}) Coward! 🐔`)
  }
}