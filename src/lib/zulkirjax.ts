import tmi from 'tmi.js'
import { supabase } from './supabase'

let zulkirjaxPresent = false
let zulkirjaxVictim: string | null = null

export function isZulkirjaxPresent(): boolean {
  return zulkirjaxPresent
}

export function getZulkirjaxVictim(): string | null {
  return zulkirjaxVictim
}

const APPEARANCE_LINES = [
  `👁️ The air grows cold. Zulkir Jax materializes from the shadows and fixes @{username} with a look that suggests he knows exactly how many hit points they have.`,
  `👁️ Zulkir Jax steps out of a shadow that wasn't there a moment ago. He glances at @{username}. He does not look impressed.`,
  `👁️ A chill runs through the dungeon. Zulkir Jax is here. He's looking at @{username} with the expression of someone reading a very short book.`,
  `👁️ Zulkir Jax arrives. He wasn't invited. He is not concerned about this. @{username} has his full attention. This is not good.`,
  `👁️ The phylactery pulses. Zulkir Jax is here, staring at @{username} with the patience of someone who has been dead for three hundred years and has nowhere else to be.`,
  `👁️ Zulkir Jax appears. He looks at @{username} the way a chess player looks at a pawn. "Interesting," he says. He does not elaborate.`,
  `👁️ Something shifts in the dark. Zulkir Jax steps forward, regards @{username}, and says absolutely nothing. The silence is worse than words.`,
  `👁️ Zulkir Jax materializes mid-dungeon. He looks at @{username}. He tilts his head slightly. "Still alive," he observes. "For now."`,
  `👁️ The temperature drops. Zulkir Jax is here. He's watching @{username} with the expression of a man who already knows how this ends.`,
  `👁️ Zulkir Jax steps out of nowhere and locks eyes with @{username}. He produces a small ledger, makes a note, and puts it away without explanation.`,
]

const TAUNT_LINES = [
  `👁️ Zulkir Jax says to @{username}: "Your equipment is... adequate. For someone who expects to die soon."`,
  `👁️ Zulkir Jax observes @{username}: "I've seen better technique from animated skeletons. My animated skeletons, specifically."`,
  `👁️ Zulkir Jax addresses @{username}: "The graveyard has a slot reserved. I checked. It has your name on it already."`,
  `👁️ Zulkir Jax tells @{username}: "I'm not here to fight you. You're not ready for that. You may never be ready for that."`,
  `👁️ Zulkir Jax muses aloud: "I wonder if @{username} knows how close they came to dying last time. Probably not. Probably better that way."`,
  `👁️ Zulkir Jax says quietly to @{username}: "The phylactery remembers everyone who has stood where you're standing. Most of them are in the graveyard."`,
  `👁️ Zulkir Jax glances at @{username}'s inventory. "Interesting choices," he says. He does not say they are good choices.`,
  `👁️ Zulkir Jax tells @{username}: "I have watched three hundred years of adventurers. You are not the worst. You are not, however, the best."`,
  `👁️ Zulkir Jax says to @{username}: "Your class is a fine choice. For someone with modest ambitions."`,
  `👁️ Zulkir Jax observes @{username} for a long moment. "You have potential," he says. "Unrealized. Possibly unrealizable."`,
]

const DEBUFFS = [
  { key: 'jax_unease', message: `@{username} feels a creeping unease. Something is watching. -5 to all rolls until the feeling passes.` },
  { key: 'jax_doubt', message: `@{username} is filled with sudden self-doubt. Was that the right move? Is any move the right move? -10 max HP until next rest.` },
  { key: 'jax_paranoia', message: `@{username} becomes paranoid. Every shadow looks like a phylactery. Every sound is a lich. -5 to defense until next fight.` },
  { key: 'jax_marked', message: `@{username} has been marked. Not cursed. Just... noted. The ledger has been updated. Something will come of this.` },
  { key: 'jax_cold', message: `@{username} feels a deep cold settle into their bones. The kind that doesn't go away. -8 HP.` },
]

const DODGE_LINES = [
  `@{username} swings at Zulkir Jax. He sidesteps without looking. "Was that an attack?" he asks. "I genuinely couldn't tell."`,
  `@{username} attempts to strike Zulkir Jax. He doesn't move. The attack passes through him. "Phylactery," he explains. "Very useful."`,
  `@{username} attacks. Zulkir Jax tilts his head three degrees to the left. The blow misses entirely. "Interesting trajectory," he notes.`,
  `@{username} swings at Zulkir Jax. He takes one step back. Just one. It's enough. "I've had three hundred years to practice this," he says.`,
  `@{username} tries to hit Zulkir Jax. He doesn't dodge so much as simply not be where the attack lands. "You'll want to work on that," he says.`,
]

const DEPARTURE_STARES = [
  `Zulkir Jax stares at @{username}... then straightens his robes, turns, and walks back into the shadow he came from.`,
  `Zulkir Jax stares at @{username}... then nods once, as if confirming something, and disappears.`,
  `Zulkir Jax stares at @{username}... then makes another note in his ledger, closes it, and leaves.`,
  `Zulkir Jax stares at @{username}... then says "Adequate," turns around, and walks into a wall that isn't there anymore.`,
  `Zulkir Jax stares at @{username}... then exhales slowly, which is impressive given that he doesn't breathe, and vanishes.`,
  `Zulkir Jax stares at @{username}... then waves. Once. Awkwardly. And leaves.`,
  `Zulkir Jax stares at @{username}... then produces a small hourglass, watches it for a moment, puts it away, and goes.`,
  `Zulkir Jax stares at @{username}... then says nothing. Turns. Leaves. The cold stays a little longer than he does.`,
  `Zulkir Jax stares at @{username}... then straightens his phylactery, which did not need straightening, and departs.`,
  `Zulkir Jax stares at @{username}... then says "Soon," and disappears before anyone can ask what he means.`,
]

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

const fmt = (str: string, username: string) => str.replace(/\{username\}/g, username)

export async function summonZulkirjax(
  client: tmi.Client,
  channel: string,
  username: string
): Promise<void> {
  if (zulkirjaxPresent) return

  zulkirjaxPresent = true
  zulkirjaxVictim = username

  // Appearance
  const appearance = fmt(pickRandom(APPEARANCE_LINES), username)
  client.say(channel, appearance)

  // Short pause then taunt
  await new Promise(r => setTimeout(r, 3000))
  const taunt = fmt(pickRandom(TAUNT_LINES), username)
  client.say(channel, taunt)

  // Apply debuff
  await new Promise(r => setTimeout(r, 2000))
  const debuff = pickRandom(DEBUFFS)
  client.say(channel, fmt(debuff.message, username))

  // Apply debuff effect
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (char) {
    if (debuff.key === 'jax_cold') {
      const newHp = Math.max(1, char.hp - 8)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    } else if (debuff.key === 'jax_doubt') {
      const newMaxHp = Math.max(1, char.max_hp - 10)
      const newHp = Math.min(char.hp, newMaxHp)
      await supabase.from('characters').update({ hp: newHp, max_hp: newMaxHp }).eq('twitch_username', username)
    }
  }

  // Auto-leave after 2 minutes if no one attacks
  setTimeout(async () => {
    if (zulkirjaxPresent && zulkirjaxVictim === username) {
      zulkirjaxPresent = false
      zulkirjaxVictim = null
      client.say(channel,
        `👁️ Zulkir Jax grows bored waiting for @${username} to act. He leaves. The cold remains.`
      )
    }
  }, 2 * 60 * 1000)
}

export async function handleZulkirjaxAttack(
  client: tmi.Client,
  channel: string,
  username: string
): Promise<boolean> {
  if (!zulkirjaxPresent) return false

  const victim = zulkirjaxVictim ?? username

  // Dodge
  const dodge = fmt(pickRandom(DODGE_LINES), username)
  client.say(channel, dodge)

  await new Promise(r => setTimeout(r, 2000))

  // Stare and leave
  const departure = fmt(pickRandom(DEPARTURE_STARES), victim)
  client.say(channel, departure)

  zulkirjaxPresent = false
  zulkirjaxVictim = null

  return true
}