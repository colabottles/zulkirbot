import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights, startFight } from '../game/engine'
import { d100 } from '../game/dice'
import { getMonsterForLevel } from '../game/monsters'
import { resetTurnUndeadCooldown } from './turnundead'
import { hirelingRest } from './hireling'
import { rechargeSpellPoints } from '../lib/spellPoints'

const REST_INTERRUPT_CHANCE = 20

export const restCommand: BotCommand = {
  name: 'rest',
  aliases: ['sleep', 'camp'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    if (activeFights.has(username)) {
      client.say(channel, `@${username} — you can't rest while in a fight!`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    if (char.hp >= char.max_hp) {
      client.say(channel, `@${username} — you're already at full health! No need to rest.`)
      return
    }

    const roll = d100()

    if (roll <= REST_INTERRUPT_CHANCE) {
      const monster = getMonsterForLevel(char.level)
      client.say(
        channel,
        `😴 @${username} tries to rest but is interrupted by a ${monster.name}! ` +
        `(HP: ${monster.hp} | ATK: ${monster.attack} | DEF: ${monster.defense}) Type !fight to attack!`
      )
      await startFight(channel, username, client, monster)
      return
    }

    const newHp = char.max_hp

    await supabase.from('characters').update({
      hp: newHp,
    }).eq('twitch_username', username)

    client.say(
      channel,
      `😴 @${username} rests and wakes fully restored. (HP: ${newHp}/${char.max_hp})`
    )
    resetTurnUndeadCooldown(username)
    hirelingRest(username)
    await rechargeSpellPoints(username)
  }
}