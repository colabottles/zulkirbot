// ============================================================
// ZulkirBot: Hireling System
// ============================================================
// !hireling [class]  — hire a companion from the tavern (2g)
// !hireling status   — check your current hireling
//
// Hirelings persist across fights until they die (3 HP).
// They deal damage, absorb hits, and say weird things.
// ============================================================

import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'

// ------------------------------------------------------------
// Hireling archetypes
// ------------------------------------------------------------

export type HirelingArchetype = 'melee' | 'finesse' | 'divine' | 'arcane' | 'support'

export const CLASS_ARCHETYPE: Record<string, HirelingArchetype> = {
  fighter: 'melee',
  barbarian: 'melee',
  monk: 'melee',
  sacred_fist: 'melee',
  rogue: 'finesse',
  ranger: 'finesse',
  arcane_trickster: 'finesse',
  dark_hunter: 'finesse',
  cleric: 'divine',
  paladin: 'divine',
  favored_soul: 'divine',
  dark_apostate: 'divine',
  acolyte_of_the_skin: 'divine',
  wizard: 'arcane',
  sorcerer: 'arcane',
  warlock: 'arcane',
  wild_mage: 'arcane',
  blightcaster: 'arcane',
  dragon_lord: 'arcane',
  dragon_disciple: 'arcane',
  bard: 'support',
  druid: 'support',
  stormsinger: 'support',
  artificer: 'support',
  alchemist: 'support',
}

export const ARCHETYPE_DAMAGE_DIE: Record<HirelingArchetype, number> = {
  melee: 10,
  finesse: 8,
  divine: 6,
  arcane: 6,
  support: 4,
}

// ------------------------------------------------------------
// Hireling state
// ------------------------------------------------------------

export interface Hireling {
  ownerUsername: string
  hirelingClass: string
  archetype: HirelingArchetype
  hp: number
  maxHp: number
  name: string
}

export const activeHirelings = new Map<string, Hireling>()

// ------------------------------------------------------------
// Hireling names by archetype
// ------------------------------------------------------------

const HIRELING_NAMES: Record<HirelingArchetype, string[]> = {
  melee: ['Brug', 'Torvin', 'Krag', 'Oswin', 'Durga', 'Mak'],
  finesse: ['Lirel', 'Sable', 'Finn', 'Wren', 'Dex', 'Pip'],
  divine: ['Brother Aldric', 'Sister Mave', 'Theron', 'Luma', 'Devotus', 'Prayse'],
  arcane: ['Zyx', 'Morven', 'Quill', 'Tangle', 'Fizzwick', 'Arcanis'],
  support: ['Bumble', 'Trill', 'Cosmo', 'Whimsy', 'Gadget', 'Sprocket'],
}

function pickName(archetype: HirelingArchetype): string {
  const names = HIRELING_NAMES[archetype]
  return names[Math.floor(Math.random() * names.length)]
}

// ------------------------------------------------------------
// Purchase flavor messages
// ------------------------------------------------------------

const HIRE_MESSAGES: Record<HirelingArchetype, string[]> = {
  melee: [
    `{name} the {class} slams their tankard down and cracks their knuckles. "Right then. Who do I hit?"`,
    `{name} the {class} was already mid-brawl with a barstool. They finish. They're ready.`,
    `{name} the {class} squints at you. "Two gold. I don't do healing. I don't do stairs. We good?"`,
  ],
  finesse: [
    `{name} the {class} appears from a shadow you didn't know was there. "Already checked your pockets. You're clean. Let's go."`,
    `{name} the {class} slides the coin into their sleeve without looking at it. "Don't ask where I've been."`,
    `{name} the {class} was already behind you. "I've been following you for ten minutes. Just wanted to see if you'd notice."`,
  ],
  divine: [
    `{name} the {class} sighs heavily. "The gods have spoken. Apparently I'm supposed to help you specifically. I had questions."`,
    `{name} the {class} blesses the coin before pocketing it. "Your soul is in moderate shape. We'll work on it."`,
    `{name} the {class} regards you with professional concern. "I've seen worse. Not much worse. But worse."`,
  ],
  arcane: [
    `{name} the {class} looks up from a book that is definitely on fire. "Oh good. An adventure. I was running out of things to set on fire."`,
    `{name} the {class} pockets the coin and it immediately disappears into a pocket dimension. "Don't worry about it."`,
    `{name} the {class} was already standing next to you. You don't know when that happened.`,
  ],
  support: [
    `{name} the {class} claps their hands together. "Wonderful! I've prepared seventeen contingency plans. Only four of them end in fire."`,
    `{name} the {class} offers you a very small sandwich. "For the road. I made extras. I always make extras."`,
    `{name} the {class} pulls out a lute, realizes this is not the moment, puts it away, pulls out a different lute. "Ready."`,
  ],
}

function getHireMessage(archetype: HirelingArchetype, name: string, hirelingClass: string): string {
  const messages = HIRE_MESSAGES[archetype]
  const msg = messages[Math.floor(Math.random() * messages.length)]
  return msg.replace('{name}', name).replace('{class}', hirelingClass)
}

// ------------------------------------------------------------
// Mid-battle quips (30% chance per round)
// ------------------------------------------------------------

const BATTLE_QUIPS: Record<HirelingArchetype, string[]> = {
  melee: [
    `{name} headbutts the {monster}. Unclear if intentional.`,
    `{name} yells something about their father. Combat continues.`,
    `{name} bites the {monster}. This is not a technique they were taught.`,
    `{name} stops briefly to flex. Returns to fighting.`,
    `{name}: "I'VE FOUGHT WORSE." They have not fought worse.`,
  ],
  finesse: [
    `{name} rolls behind the {monster} for no clear tactical reason.`,
    `{name} winks at you mid-stab. You find this unsettling.`,
    `{name}: "Don't worry, I've got a plan." They do not share the plan.`,
    `{name} does a small unnecessary flip. Deals damage anyway.`,
    `{name} picks the {monster}'s pocket while fighting it. Finds nothing. Worth a try.`,
  ],
  divine: [
    `{name} pauses to pray mid-combat. The gods apparently approve.`,
    `{name}: "This is fine. This is all part of a plan." Unclear whose plan.`,
    `{name} blesses their own fist before punching the {monster}.`,
    `{name}: "I want you to know I am doing this under protest."`,
    `{name} quotes scripture at the {monster}. The {monster} is unmoved but {name} feels better.`,
  ],
  arcane: [
    `{name} mispronounces an incantation. Something explodes. It helps somehow.`,
    `{name}: "Interesting. I've never tried this on a living subject."`,
    `{name} consults a small notebook. Nods. Fires a spell sideways.`,
    `{name} turns briefly into a fish. Turns back. Does not acknowledge this.`,
    `{name}: "The math said this would work. The math was optimistic."`,
  ],
  support: [
    `{name} offers the {monster} a snack. The {monster} declines. {name} shrugs and attacks.`,
    `{name} plays three seconds of a battle hymn before forgetting the words.`,
    `{name}: "Has anyone tried talking to it?" Nobody has tried talking to it.`,
    `{name} consults their seventeen contingency plans. Uses plan F.`,
    `{name} trips, accidentally does something helpful, seems very pleased.`,
  ],
}

export function getHirelingQuip(hireling: Hireling, monsterName: string): string | null {
  if (Math.random() > 0.30) return null
  const quips = BATTLE_QUIPS[hireling.archetype]
  const quip = quips[Math.floor(Math.random() * quips.length)]
  return quip.replace(/{name}/g, hireling.name).replace(/{monster}/g, monsterName)
}

// ------------------------------------------------------------
// Death messages (melodramatic last words)
// ------------------------------------------------------------

const DEATH_MESSAGES: Record<HirelingArchetype, string[]> = {
  melee: [
    `{name} stumbles, looks at their hands, looks at you. "Tell them... I was taller than they said." They were not taller than they said.`,
    `{name} falls to one knee. "I always thought I'd go out in a bigger fight. Tell my axe... I loved her." They collapse. The axe is fine.`,
    `{name}: "I can still fight—" They cannot still fight. "{name} has fallen.`,
  ],
  finesse: [
    `{name} slumps against the wall with practiced elegance. "I was never here. Remember that." They were very much here.`,
    `{name}: "Tell no one how I died." You will tell everyone how they died. "Actually... make it sound cooler." Done.`,
    `{name} produces a small note from their pocket. It reads: 'If you're reading this, the plan didn't work.' They had a plan.`,
  ],
  divine: [
    `{name} looks skyward. "I have questions about this outcome." A pause. "Fine. FINE." They fall peacefully.`,
    `{name}: "The gods work in mysterious ways." Another pause. "This is one of the mysterious ones." Gone.`,
    `{name} raises a hand in final blessing. "You're going to need it." They're not wrong.`,
  ],
  arcane: [
    `{name}: "Fascinating. So THAT'S what that spell does to organic matter." They make several notes. Fall over.`,
    `{name} looks at you with genuine scientific interest. "Record this. For posterity." They do not specify what to record.`,
    `{name}: "I have no regrets." A pause. "Well. One regret. The fish thing. I should have seen that coming."`,
  ],
  support: [
    `{name} smiles warmly. "It's alright. I prepared for this too. Plan Q." They do not explain Plan Q. They never will.`,
    `{name}: "I just want you to know — I believed in you. I still do. From here. Wherever here is." They fade.`,
    `{name} hums three bars of a song you don't recognize. "That's the one I wanted playing. Good." Gone.`,
  ],
}

export function getHirelingDeathMessage(hireling: Hireling): string {
  const messages = DEATH_MESSAGES[hireling.archetype]
  const msg = messages[Math.floor(Math.random() * messages.length)]
  return msg.replace(/{name}/g, hireling.name)
}

// ------------------------------------------------------------
// Hireling combat — called from engine.ts each round
// ------------------------------------------------------------

export function rollHirelingDamage(hireling: Hireling): number {
  const die = ARCHETYPE_DAMAGE_DIE[hireling.archetype]
  return Math.floor(Math.random() * die) + 1
}

// 20% chance hireling absorbs a hit — returns true if absorbed
export function hirelingAbsorbsHit(hireling: Hireling): boolean {
  return Math.random() <= 0.20
}

// Apply one hit to hireling — returns true if hireling dies
export function hirelingTakeHit(username: string): boolean {
  const hireling = activeHirelings.get(username)
  if (!hireling) return false
  hireling.hp -= 1
  if (hireling.hp <= 0) {
    activeHirelings.delete(username)
    return true
  }
  activeHirelings.set(username, hireling)
  return false
}

// Restore 1 HP on rest/shrine
export function hirelingRest(username: string): void {
  const hireling = activeHirelings.get(username)
  if (!hireling) return
  hireling.hp = Math.min(hireling.maxHp, hireling.hp + 1)
  activeHirelings.set(username, hireling)
}

// Archetype specials — called after victory
export async function applyHirelingSpecial(
  username: string,
  hireling: Hireling,
  monsterGold: number
): Promise<string | null> {
  switch (hireling.archetype) {
    case 'finesse': {
      if (Math.random() <= 0.15) {
        const bonus = Math.floor(Math.random() * 6) + 1
        const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', username).single()
        if (char) await supabase.from('characters').update({ gold: char.gold + bonus }).eq('twitch_username', username)
        return `${hireling.name} rifles through the corpse's pockets. Finds ${bonus}gp. Keeps half. Gives you the other half.`
      }
      return null
    }
    case 'divine': {
      if (Math.random() <= 0.20) {
        const heal = Math.floor(Math.random() * 4) + 1
        const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
        if (char) {
          const newHp = Math.min(char.max_hp, char.hp + heal)
          await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
          return `${hireling.name} lays a hand on your shoulder. +${heal} HP. (${newHp}/${char.max_hp})`
        }
      }
      return null
    }
    case 'arcane': {
      // Wild magic surge — double damage already applied in engine, this is post-fight flavor
      return null
    }
    case 'support': {
      // Attack bonus applied in engine, no post-fight effect
      return null
    }
    default:
      return null
  }
}

// ------------------------------------------------------------
// !hireling command
// ------------------------------------------------------------

export const hirelingCommand: BotCommand = {
  name: 'hireling',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    // !hireling status
    if (args[0]?.toLowerCase() === 'status') {
      const hireling = activeHirelings.get(username)
      if (!hireling) {
        client.say(channel, `@${username} — you don't have a hireling. Use !hireling [class] to hire one for 2g.`)
      } else {
        client.say(channel,
          `🗡️ @${username}'s hireling: ${hireling.name} the ${hireling.hirelingClass} ` +
          `(HP: ${hireling.hp}/${hireling.maxHp})`
        )
      }
      return
    }

    // Already has a hireling
    if (activeHirelings.has(username)) {
      const hireling = activeHirelings.get(username)!
      client.say(channel,
        `@${username} — you already have ${hireling.name} the ${hireling.hirelingClass}. ` +
        `They're fine. Probably. (HP: ${hireling.hp}/${hireling.maxHp})`
      )
      return
    }

    // Parse class argument
    const requestedClass = args[0]?.toLowerCase().replace(/\s+/g, '_')
    if (!requestedClass) {
      client.say(channel,
        `@${username} — usage: !hireling [class]. Available classes: fighter, rogue, cleric, wizard, ranger, bard, and more. 2g per hire.`
      )
      return
    }

    if (!CLASS_ARCHETYPE[requestedClass]) {
      client.say(channel,
        `@${username} — unknown class "${requestedClass}". Check !help for available hireling classes.`
      )
      return
    }

    // Cost check
    const cost = 2
    if (char.gold < cost) {
      client.say(channel, `@${username} — you need ${cost}gp to hire a companion. You have ${char.gold}gp.`)
      return
    }

    // Deduct gold
    await supabase
      .from('characters')
      .update({ gold: char.gold - cost })
      .eq('twitch_username', username)

    // Create hireling
    const archetype = CLASS_ARCHETYPE[requestedClass]
    const name = pickName(archetype)

    const hireling: Hireling = {
      ownerUsername: username,
      hirelingClass: requestedClass,
      archetype,
      hp: 3,
      maxHp: 3,
      name,
    }

    activeHirelings.set(username, hireling)

    client.say(channel, `🗡️ ${getHireMessage(archetype, name, requestedClass)} (-${cost}gp)`)
  }
}