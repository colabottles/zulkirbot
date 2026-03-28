import { BotCommand, CharacterClass } from '../types'
import { supabase } from '../lib/supabase'
import { formatClass } from '../lib/format'

const CLASSES: CharacterClass[] = ['alchemist', 'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'favored_soul', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'sacred_fist', 'dark_apostate', 'stormsinger', 'blightcaster', 'acolyte_of_the_skin', 'dark_hunter', 'dragon_lord', 'wild_mage', 'dragon_disciple', 'arcane_trickster']

const CLASS_HP: Record<CharacterClass, number> = {
  alchemist: 5,
  artificer: 4,
  barbarian: 7,
  bard: 4,
  cleric: 5,
  druid: 5,
  favored_soul: 5,
  fighter: 6,
  monk: 5,
  paladin: 6,
  ranger: 6,
  rogue: 4,
  sorcerer: 3,
  warlock: 4,
  wizard: 3,
  sacred_fist: 6,
  dark_apostate: 5,
  stormsinger: 4,
  blightcaster: 5,
  acolyte_of_the_skin: 4,
  dark_hunter: 6,
  dragon_lord: 6,
  wild_mage: 3,
  dragon_disciple: 5,
  arcane_trickster: 4,
}

export const joinCommand: BotCommand = {
  name: 'join',
  aliases: ['register', 'create'],
  handler: async (channel, username, args, client) => {
    const requestedClass = args[0]?.toLowerCase() as CharacterClass
    const chosenClass = CLASSES.includes(requestedClass)
      ? requestedClass
      : CLASSES[Math.floor(Math.random() * CLASSES.length)]

    const { data: existing } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', username)
      .single()

    if (existing) {
      client.say(channel, `@${username} — you already have a character! Use !status to check them out.`)
      return
    }

    const { error } = await supabase.from('characters').insert({
      twitch_username: username,
      display_name: username,
      class: chosenClass,
      level: 1,
      xp: 0,
      hp: CLASS_HP[chosenClass],
      max_hp: CLASS_HP[chosenClass],
      gold: 10,
    })

    if (error) throw error

    client.say(
      channel,
      `@${username} has joined the adventure as a Level 1 ${formatClass(chosenClass)}! ` +
      `Use !fight to find monsters, !explore to search for loot, or !status to see your character.`
    )
  }
}