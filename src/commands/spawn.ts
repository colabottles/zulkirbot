import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights, startFight } from '../game/engine'
import { MONSTERS } from '../game/monsters'
import { Monster } from '../types'
import { BOSSES, getBossById } from '../game/bosses'

export const spawnCommand: BotCommand = {
  name: 'spawn',
  handler: async (channel, username, args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    if (args.length < 2) {
      client.say(channel, `@${username} — usage: !spawn [monster name] [target user]`)
      return
    }

    const target = args[args.length - 1].replace('@', '').toLowerCase()
    const monsterName = args.slice(0, -1).join(' ')

    if (activeFights.has(target)) {
      client.say(channel, `@${username} — ${target} is already in a fight!`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', target)
      .single()

    if (!char) {
      client.say(channel, `@${username} — ${target} doesn't have a character.`)
      return
    }

    // Search regular monsters first
    let monster: Monster | null = null
    for (const tier of Object.values(MONSTERS)) {
      const found = tier.find(
        m => m.name.toLowerCase() === monsterName.toLowerCase()
      )
      if (found) {
        monster = { ...found }
        break
      }
    }

    // Fall back to boss list
    if (!monster) {
      const boss = getBossById(monsterName)
      if (boss) monster = { ...boss }
    }

    if (!monster) {
      client.say(channel, `@${username} — monster "${monsterName}" not found.`)
      return
    }

    const isBoss = BOSSES.some(b => b.name.toLowerCase().includes(monsterName.toLowerCase()))
    if (isBoss && char.level < 25) {
      client.say(
        channel,
        `@${username} — ${target} is only Level ${char.level}! ` +
        `Bosses can only be spawned on characters Level 25 or higher.`
      )
      return
    }

    client.say(channel, `👹 The dungeon master spawns a ${monster.name} before @${target}!`)
    await startFight(channel, target, client, monster)
  }
}