import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'

const PRESTIGE_COST = 1000
const PRESTIGE_MAX = 5
const PRESTIGE_HP_BONUS = 10
const PRESTIGE_LABELS = ['Epic I', 'Epic II', 'Epic III', 'Epic IV', 'Epic V']

export function formatPrestige(rank: number): string {
  if (rank <= 0) return ''
  return `[${PRESTIGE_LABELS[rank - 1]}]`
}

export const prestigeCommand: BotCommand = {
  name: 'prestige',
  cooldownSeconds: 10,
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

    if (char.level < 40) {
      client.say(
        channel,
        `@${username} — you must reach Level 40 before you can prestige! ` +
        `You are Level ${char.level}.`
      )
      return
    }

    if (char.gold < PRESTIGE_COST) {
      client.say(
        channel,
        `@${username} — you need ${PRESTIGE_COST}gp to prestige. You only have ${char.gold}gp.`
      )
      return
    }

    if (char.prestige_rank >= PRESTIGE_MAX) {
      client.say(
        channel,
        `@${username} — you have already reached the maximum prestige rank: [Epic V]. ` +
        `You are a legend.`
      )
      return
    }

    const newRank = char.prestige_rank + 1
    const newHpBonus = char.prestige_hp_bonus + PRESTIGE_HP_BONUS
    const newMaxHp = char.max_hp - char.prestige_hp_bonus + newHpBonus
    const label = PRESTIGE_LABELS[newRank - 1]

    await supabase
      .from('characters')
      .update({
        level: 1,
        xp: 0,
        gold: char.gold - PRESTIGE_COST,
        hp: Math.min(char.hp, newMaxHp),
        max_hp: newMaxHp,
        prestige_rank: newRank,
        prestige_hp_bonus: newHpBonus,
      })
      .eq('twitch_username', username)

    client.say(
      channel,
      `✨ @${username} has transcended mortal limits and achieved [${label}] prestige! ` +
      `They return to Level 1, forever changed. ` +
      `+${PRESTIGE_HP_BONUS} permanent max HP bonus! ` +
      `All items and gold (minus ${PRESTIGE_COST}gp) have been retained.`
    )
  }
}