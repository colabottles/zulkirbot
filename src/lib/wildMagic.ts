import { supabase } from './supabase'

export interface WildMagicEffect {
  roll: number
  description: string
  effect: (username: string, channel: string, client: any) => Promise<void>
}

const roll = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export const WILD_MAGIC_TABLE: WildMagicEffect[] = [
  {
    roll: 1,
    description: 'A fireball explodes centered on the caster for 3d6 damage.',
    effect: async (username, channel, client) => {
      const dmg = roll(3, 18)
      await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.max(1, data.hp - dmg) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! A fireball explodes from @${username}! They take ${dmg} fire damage!`)
    }
  },
  {
    roll: 2,
    description: 'The caster restores 5d6 hit points.',
    effect: async (username, channel, client) => {
      const heal = roll(5, 30)
      await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.min(data.max_hp, data.hp + heal) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! Healing energy erupts from @${username}! +${heal} HP!`)
    }
  },
  {
    roll: 3,
    description: 'The caster is surrounded by faint, ethereal music for 1 minute. Flavor only.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! Ethereal music surrounds @${username}. It is faint but persistent. Combat continues.`)
    }
  },
  {
    roll: 4,
    description: 'The caster loses 1d10 gold.',
    effect: async (username, channel, client) => {
      const drain = roll(1, 10)
      await supabase.from('characters').select('gold').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ gold: Math.max(0, data.gold - drain) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! ${drain}g vanishes from @${username}'s pouch. Where did it go? Nowhere good.`)
    }
  },
  {
    roll: 5,
    description: 'The caster glows with a bright light. +2 defense until next rest.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} glows with brilliant light! +2 defense until next rest.`)
    }
  },
  {
    roll: 6,
    description: 'The caster casts the spell twice. Both copies fire.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! The spell duplicates! @${username}'s spell fires TWICE this turn!`)
    }
  },
  {
    roll: 7,
    description: 'The caster gains 1d6 temporary HP.',
    effect: async (username, channel, client) => {
      const bonus = roll(1, 6)
      await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.min(data.max_hp + bonus, data.hp + bonus) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! @${username} gains ${bonus} temporary HP from raw magical overflow!`)
    }
  },
  {
    roll: 8,
    description: 'The caster is frightened of the target until end of next turn.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is suddenly terrified of their own target! They lose their next turn.`)
    }
  },
  {
    roll: 9,
    description: 'Up to 3 creatures within 30 feet of the caster are polymorphed into sheep briefly.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! Something nearby becomes briefly sheepish. @${username} is unaffected. Probably.`)
    }
  },
  {
    roll: 10,
    description: 'The caster gains advantage on their next attack.',
    effect: async (username, channel, client) => {
      const { advantagePlayers } = await import('../commands/new_commands')
      advantagePlayers.set(username, true)
      client.say(channel, `🎲 WILD SURGE! Wild magic grants @${username} advantage on their next attack!`)
    }
  },
  {
    roll: 11,
    description: 'The caster\'s skin turns blue for the rest of the day. Flavor only.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username}'s skin turns a vivid blue. This is permanent for today. They are fine.`)
    }
  },
  {
    roll: 12,
    description: 'An eye appears on the caster\'s forehead for the rest of the day. +1 to attack.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! A third eye opens on @${username}'s forehead! +1 to attacks for the rest of this fight.`)
    }
  },
  {
    roll: 13,
    description: 'The next creature to hit the caster takes 1d6 psychic damage.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} crackles with psychic energy — the next creature to hit them takes 1d6 psychic damage back!`)
    }
  },
  {
    roll: 14,
    description: 'The caster\'s spells deal maximum damage for the next minute.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username}'s magic overcharges — MAXIMUM DAMAGE on their next spell!`)
    }
  },
  {
    roll: 15,
    description: 'A cloud of 600 butterflies fills a 30-foot radius. Flavor only.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! The air fills with butterflies. So many butterflies. @${username} continues fighting through them.`)
    }
  },
  {
    roll: 16,
    description: 'The caster regains their lowest-level expended spell slot.',
    effect: async (username, channel, client) => {
      const { data: char } = await supabase.from('characters').select('class, level').eq('twitch_username', username).single()
      if (!char) return
      const { getMaxSpellPoints } = await import('./spellPoints')
      const restore = Math.ceil(char.level / 4)
      await supabase.from('player_spell_points').select('current_points, max_points').eq('username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('player_spell_points').update({ current_points: Math.min(data.max_points, data.current_points + restore) }).eq('username', username)
      })
      client.say(channel, `🎲 WILD SURGE! Magical energy flows back to @${username}! +${restore} spell points recovered!`)
    }
  },
  {
    roll: 17,
    description: 'The caster teleports up to 60 feet in a random direction.',
    effect: async (username, channel, client) => {
      const goldBonus = roll(5, 15)
      await supabase.from('characters').select('gold').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ gold: data.gold + goldBonus }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! @${username} teleports randomly — and lands on a pile of ${goldBonus}g! Lucky direction.`)
    }
  },
  {
    roll: 18,
    description: 'The caster is invisible until they attack or cast a spell.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} turns invisible! Next attack against them automatically misses.`)
    }
  },
  {
    roll: 19,
    description: 'The caster is frightened of the nearest creature until end of their next turn.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is suddenly frightened! They lose their next turn.`)
    }
  },
  {
    roll: 20,
    description: 'The caster loses 1d4 XP levels worth of XP.',
    effect: async (username, channel, client) => {
      const xpDrain = roll(100, 500)
      await supabase.from('characters').select('xp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ xp: Math.max(0, data.xp - xpDrain) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! Wild magic drains ${xpDrain} XP from @${username}! The magic gives and takes.`)
    }
  },
  {
    roll: 21,
    description: 'The caster\'s hair falls out but grows back within 24 hours. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username}'s hair departs immediately. It will return. Probably.`)
    }
  },
  {
    roll: 22,
    description: 'The caster polymorphs into a potted plant until start of next turn. They lose that turn.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} briefly becomes a potted plant. A very nice fern. They lose their next turn.`)
    }
  },
  {
    roll: 23,
    description: 'The caster is blinded until end of next turn.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is blinded! Disadvantage on next attack.`)
      const { disadvantagePlayers } = await import('../commands/new_commands')
      disadvantagePlayers.set(username, true)
    }
  },
  {
    roll: 24,
    description: 'The caster is deafened until end of next turn. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is deafened! Everything is muffled. Combat continues in eerie silence.`)
    }
  },
  {
    roll: 25,
    description: 'A random magic item appears in the caster\'s possession.',
    effect: async (username, channel, client) => {
      const { rollLootByRarity } = await import('../game/loot')
      const item = rollLootByRarity('rare')
      const { data: char } = await supabase.from('characters').select('id').eq('twitch_username', username).single()
      if (!char) return
      await supabase.from('inventory').insert({ character_id: char.id, item_name: item.name, item_type: item.type, rarity: item.rarity, stat_bonus: item.stat_bonus, description: item.description })
      client.say(channel, `🎲 WILD SURGE! A ${item.rarity.toUpperCase()} ${item.name} materializes in @${username}'s hands! Wild magic provides.`)
    }
  },
  {
    roll: 26,
    description: 'The caster grows a beard of feathers. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} grows a magnificent beard of feathers. It suits them.`)
    }
  },
  {
    roll: 27,
    description: 'Each creature within 30 feet of the caster takes 1d10 necrotic damage.',
    effect: async (username, channel, client) => {
      const dmg = roll(1, 10)
      client.say(channel, `🎲 WILD SURGE! Necrotic energy bursts from @${username}! The monster takes ${dmg} necrotic damage!`)
    }
  },
  {
    roll: 28,
    description: 'The caster is surrounded by multicolored light. +1d4 to next damage roll.',
    effect: async (username, channel, client) => {
      const bonus = roll(1, 4)
      client.say(channel, `🎲 WILD SURGE! @${username} shimmers with multicolored light! +${bonus} to next damage roll.`)
    }
  },
  {
    roll: 29,
    description: 'The caster\'s size increases by one category for 1 minute.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} grows to enormous size! +2 to attack for this fight. Also much harder to fit through doorways.`)
    }
  },
  {
    roll: 30,
    description: 'The caster\'s size decreases by one category for 1 minute.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} shrinks to tiny size. -1 to attack but the monster keeps swinging at where they used to be.`)
    }
  },
  {
    roll: 31,
    description: 'The caster can\'t speak for 1 minute. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} loses the ability to speak. They communicate entirely in gestures for this fight.`)
    }
  },
  {
    roll: 32,
    description: 'A spectral shield hovers near the caster, granting +2 AC.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! A spectral shield appears beside @${username}! +2 defense for this fight.`)
    }
  },
  {
    roll: 33,
    description: 'The caster is immune to being intoxicated for 5d6 days. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} becomes immune to intoxication for the foreseeable future. Useless in combat. Noted.`)
    }
  },
  {
    roll: 34,
    description: 'The caster\'s hair stands on end. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username}'s hair stands perfectly vertical. It stays that way. Combat continues.`)
    }
  },
  {
    roll: 35,
    description: 'The caster regains 2d10 HP.',
    effect: async (username, channel, client) => {
      const heal = roll(2, 20)
      await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.min(data.max_hp, data.hp + heal) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! Wild magic heals @${username} for ${heal} HP!`)
    }
  },
  {
    roll: 36,
    description: 'Each creature within 30 feet of the caster becomes invisible until they attack.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! Everything nearby turns invisible briefly. @${username} continues attacking by sound.`)
    }
  },
  {
    roll: 37,
    description: 'The caster knows the location of all treasure within 60 feet. Grants 1d6×5 gold.',
    effect: async (username, channel, client) => {
      const gold = roll(1, 6) * 5
      await supabase.from('characters').select('gold').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ gold: data.gold + gold }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! @${username} senses all nearby treasure! ${gold}g materializes from the walls.`)
    }
  },
  {
    roll: 38,
    description: 'The caster is affected by the slow spell until end of next turn.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} moves in slow motion. Disadvantage on their next attack.`)
      const { disadvantagePlayers } = await import('../commands/new_commands')
      disadvantagePlayers.set(username, true)
    }
  },
  {
    roll: 39,
    description: 'The caster levitates 2 feet off the ground for 1 minute. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} floats exactly 2 feet off the ground. Not useful. Not harmful. Just floating.`)
    }
  },
  {
    roll: 40,
    description: 'A unicorn appears, heals the caster for 1d8 HP, and vanishes.',
    effect: async (username, channel, client) => {
      const heal = roll(1, 8)
      await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.min(data.max_hp, data.hp + heal) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! A unicorn appears, heals @${username} for ${heal} HP, and immediately vanishes without explanation.`)
    }
  },
  {
    roll: 41,
    description: 'The caster cannot take reactions until end of next turn. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} loses the ability to react. Everything happens too fast. This resolves next turn.`)
    }
  },
  {
    roll: 42,
    description: 'The caster\'s weight doubles for 1 minute. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} doubles in weight instantly. The floor complains. Combat continues.`)
    }
  },
  {
    roll: 43,
    description: 'The caster\'s weight halves for 1 minute. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} halves in weight. They drift slightly with each step. Combat continues.`)
    }
  },
  {
    roll: 44,
    description: 'The caster is confused and attacks a random target. They attack themselves for 1d6.',
    effect: async (username, channel, client) => {
      const dmg = roll(1, 6)
      await supabase.from('characters').select('hp').eq('twitch_username', username).single().then(async ({ data }) => {
        if (!data) return
        await supabase.from('characters').update({ hp: Math.max(1, data.hp - dmg) }).eq('twitch_username', username)
      })
      client.say(channel, `🎲 WILD SURGE! @${username} is confused and attacks themselves for ${dmg} damage! That was not the plan.`)
    }
  },
  {
    roll: 45,
    description: 'The caster gains truesight for 1 minute. +1 to attacks.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} gains truesight! They see through all illusions. +1 to attacks for this fight.`)
    }
  },
  {
    roll: 46,
    description: 'The caster is affected by the bane spell for 1 minute.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is baned! Disadvantage on next attack.`)
      const { disadvantagePlayers } = await import('../commands/new_commands')
      disadvantagePlayers.set(username, true)
    }
  },
  {
    roll: 47,
    description: 'The caster is affected by the bless spell for 1 minute.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! @${username} is blessed! Advantage on next attack.`)
      const { advantagePlayers } = await import('../commands/new_commands')
      advantagePlayers.set(username, true)
    }
  },
  {
    roll: 48,
    description: 'A burst of colorful confetti erupts from the caster. Flavor.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! Confetti bursts from @${username}. It is very colorful. The monster seems confused.`)
    }
  },
  {
    roll: 49,
    description: 'The caster deals maximum damage with their next spell.',
    effect: async (username, channel, client) => {
      client.say(channel, `🎲 WILD SURGE! Wild magic overcharges @${username}'s next spell — MAXIMUM DAMAGE on the next cast!`)
    }
  },
  {
    roll: 50,
    description: 'The caster regains all expended spell points.',
    effect: async (username, channel, client) => {
      await supabase.rpc('recharge_spell_points', { p_username: username })
      client.say(channel, `🎲 WILD SURGE! All spell points restored to @${username}! Wild magic giveth.`)
    }
  },
]

export async function triggerWildMagicSurge(username: string, channel: string, client: any): Promise<void> {
  const surgeRoll = Math.floor(Math.random() * 50) + 1
  const effect = WILD_MAGIC_TABLE.find(e => e.roll === surgeRoll) ?? WILD_MAGIC_TABLE[0]

  await supabase.from('wild_magic_log').insert({
    username,
    surge_roll: surgeRoll,
    effect_description: effect.description,
  })

  await effect.effect(username, channel, client)
}