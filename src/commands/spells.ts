// ============================================================
// ZulkirBot: Spell System
// ============================================================
// !spells              — show your spellbook
// !cast [spellname]    — cast a spell in or out of combat
// !learnspell          — browse available spells
// !learnspell [name]   — learn a specific spell
// !prayforspells       — divine casters prepare spells (same as learnspell)
// !scribescroll [name] — learn a spell from a scroll in inventory
// ============================================================

import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import {
  getSpellSlotCount, getMinLevelForSpellLevel,
  getArmorFailureChance, getConcentrationFailChance,
  ensureSpellPoints, getSpellPoints, spendSpellPoints,
  DIVINE_PREP_CLASSES, ARCANE_FAILURE_CLASSES,
} from '../lib/spellPoints'
import { triggerWildMagicSurge } from '../lib/wildMagic'

// ------------------------------------------------------------
// In-memory concentration tracking
// ------------------------------------------------------------

interface ConcentrationState {
  spellName: string
  turnsRemaining: number
  effectValue: number
}

export const concentratingPlayers = new Map<string, ConcentrationState>()

export function breakConcentration(username: string): void {
  concentratingPlayers.delete(username)
}

export function checkConcentrationOnHit(username: string, damageTaken: number, channel: string, client: any): void {
  if (!concentratingPlayers.has(username)) return
  const failChance = getConcentrationFailChance(damageTaken)
  const roll = Math.floor(Math.random() * 100) + 1
  if (roll <= failChance) {
    const state = concentratingPlayers.get(username)!
    concentratingPlayers.delete(username)
    client.say(channel, `💔 @${username}'s concentration on ${state.spellName} breaks from the hit!`)
  }
}

// ------------------------------------------------------------
// Resolve spell effect
// ------------------------------------------------------------

async function resolveSpellEffect(
  spell: any,
  username: string,
  channel: string,
  client: any,
  isMaxDamage: boolean = false
): Promise<{ damage: number; heal: number; message: string }> {
  const result = { damage: 0, heal: 0, message: '' }

  if (!spell.effect_die || spell.effect_die === 0) {
    result.message = spell.hit_message ?? spell.cast_message
    return result
  }

  const dieCount = spell.effect_die_count ?? 1
  let total = 0

  if (isMaxDamage) {
    total = spell.effect_die * dieCount
  } else {
    for (let i = 0; i < dieCount; i++) {
      total += Math.floor(Math.random() * spell.effect_die) + 1
    }
  }

  if (spell.effect_type === 'damage') {
    result.damage = total
    result.message = (spell.hit_message ?? '').replace('{damage}', String(total))
  } else if (spell.effect_type === 'heal') {
    result.heal = total
    result.message = (spell.hit_message ?? '').replace('{damage}', String(total))
  } else {
    result.message = spell.hit_message ?? spell.cast_message
  }

  return result
}

// ------------------------------------------------------------
// !spells — show spellbook
// ------------------------------------------------------------

export const spellsCommand: BotCommand = {
  name: 'spells',
  cooldownSeconds: 5,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('id, class, level')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    await ensureSpellPoints(username, char.class, char.level)
    const { current, max } = await getSpellPoints(username)

    if (max === 0) {
      client.say(channel, `@${username} — your class (${char.class}) cannot cast spells.`)
      return
    }

    const { data: spellbook } = await supabase
      .from('player_spellbook')
      .select('spell_name')
      .eq('username', username)

    if (!spellbook || spellbook.length === 0) {
      client.say(channel,
        `📖 @${username}'s spellbook is empty. Use !learnspell to add spells. ` +
        `Spell points: ${current}/${max}.`
      )
      return
    }

    const spellNames = spellbook.map(s => s.spell_name).join(', ')
    client.say(channel,
      `📖 @${username}'s spellbook: ${spellNames} | ` +
      `Spell points: ${current}/${max} | ` +
      `Slots: ${spellbook.length}/${getSpellSlotCount(char.level)} | ` +
      `Use !cast [spellname] to cast.`
    )
  }
}

// ------------------------------------------------------------
// !cast [spellname] — cast a spell
// ------------------------------------------------------------

export const castCommand: BotCommand = {
  name: 'cast',
  cooldownSeconds: 3,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !cast [spellname]. Use !spells to see your spellbook.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet!`)
      return
    }

    await ensureSpellPoints(username, char.class, char.level)
    const { current } = await getSpellPoints(username)

    if (current <= 0) {
      client.say(channel, `@${username} — you have no spell points remaining! Use !rest or !shrine to recharge.`)
      return
    }

    const spellNameInput = args.join(' ').toLowerCase()

    const { data: spellbookEntry } = await supabase
      .from('player_spellbook')
      .select('spell_name')
      .eq('username', username)
      .ilike('spell_name', `%${spellNameInput}%`)
      .limit(1)
      .single()

    if (!spellbookEntry) {
      client.say(channel, `@${username} — you don't know that spell, or it wasn't found. Use !spells to see your spellbook.`)
      return
    }

    const { data: spell } = await supabase
      .from('spells')
      .select('*')
      .eq('name', spellbookEntry.spell_name)
      .single()

    if (!spell) {
      client.say(channel, `@${username} — spell data not found. Contact the dungeon master.`)
      return
    }

    const inFight = activeFights.has(username)
    if (!inFight && spell.effect_type === 'damage') {
      client.say(channel, `@${username} — you can only cast offensive spells in combat. Use !fight to find a monster.`)
      return
    }

    // Armor failure check (arcane only)
    const armorType = char.equipped_armor ?? null
    const failChance = getArmorFailureChance(armorType, char.class)
    if (failChance > 0) {
      const failRoll = Math.floor(Math.random() * 100) + 1
      if (failRoll <= failChance) {
        client.say(channel,
          `@${username} — spell failure! Your armor interferes with the casting. ` +
          `(${failChance}% chance, rolled ${failRoll})`
        )
        return
      }
    }

    // Spend spell points
    const spent = await spendSpellPoints(username, spell.spell_level)
    if (!spent) {
      client.say(channel, `@${username} — not enough spell points for ${spell.name} (costs ${spell.spell_level}). Use !rest to recharge.`)
      return
    }

    const castMsg = spell.cast_message
      .replace('{caster}', `@${username}`)
      .replace('{target}', inFight ? activeFights.get(username)!.monster.name : 'the air')

    client.say(channel, `✨ ${castMsg}`)

    // Wild Mage surge check (10% chance on any cast)
    if (char.class === 'wild_mage' && Math.floor(Math.random() * 100) + 1 <= 10) {
      await triggerWildMagicSurge(username, channel, client)
    }

    const { damage, heal, message } = await resolveSpellEffect(spell, username, channel, client)

    if (inFight) {
      const fight = activeFights.get(username)!

      if (damage > 0) {
        fight.monster_current_hp -= damage
        const resultMsg = message
          .replace('{caster}', `@${username}`)
          .replace('{target}', fight.monster.name)
          .replace('{damage}', String(damage))
          .replace('{duration}', String(spell.duration_turns))
        client.say(channel, resultMsg)

        if (fight.monster_current_hp <= 0) {
          client.say(channel, `${fight.monster.name} is defeated! Use !attack to confirm the kill.`)
        } else {
          client.say(channel,
            `[${fight.monster.name} HP: ${fight.monster_current_hp}] ` +
            `Spell points remaining: ${current - spell.spell_level}.`
          )
        }
      }

      if (heal > 0) {
        const newHp = Math.min(char.max_hp, char.hp + heal)
        await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
        const resultMsg = message
          .replace('{caster}', `@${username}`)
          .replace('{damage}', String(heal))
        client.say(channel, `${resultMsg} (HP: ${newHp}/${char.max_hp})`)
      }

      if (spell.effect_type === 'buff' || spell.effect_type === 'debuff' || spell.effect_type === 'utility') {
        const resultMsg = message
          .replace('{caster}', `@${username}`)
          .replace('{target}', fight.monster.name)
          .replace('{effect_value}', String(spell.effect_value ?? 0))
          .replace('{duration}', String(spell.duration_turns))
        client.say(channel, resultMsg)
      }

      if (spell.requires_concentration && spell.duration_turns > 0) {
        concentratingPlayers.set(username, {
          spellName: spell.name,
          turnsRemaining: spell.duration_turns,
          effectValue: spell.effect_value ?? 0,
        })
        client.say(channel, `🎯 @${username} is concentrating on ${spell.name}. Taking damage may break concentration.`)
      }

    } else {
      if (heal > 0) {
        const newHp = Math.min(char.max_hp, char.hp + heal)
        await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
        const resultMsg = message
          .replace('{caster}', `@${username}`)
          .replace('{damage}', String(heal))
        client.say(channel, `${resultMsg} (HP: ${newHp}/${char.max_hp})`)
      } else {
        const resultMsg = message
          .replace('{caster}', `@${username}`)
          .replace('{target}', 'the surroundings')
          .replace('{effect_value}', String(spell.effect_value ?? 0))
          .replace('{duration}', String(spell.duration_turns))
        client.say(channel, resultMsg)
      }
    }
  }
}

// ------------------------------------------------------------
// !learnspell / !prayforspells — learn a spell
// ------------------------------------------------------------

async function handleLearnSpell(
  channel: string,
  username: string,
  args: string[],
  client: any,
  isPrayer: boolean
): Promise<void> {
  const { data: char } = await supabase
    .from('characters')
    .select('class, level')
    .eq('twitch_username', username)
    .single()

  if (!char) {
    client.say(channel, `@${username} — you don't have a character yet!`)
    return
  }

  const maxSlots = getSpellSlotCount(char.level)
  const { data: currentSpells } = await supabase
    .from('player_spellbook')
    .select('spell_name')
    .eq('username', username)

  const currentCount = currentSpells?.length ?? 0

  if (!args.length) {
    const knownNames = (currentSpells ?? []).map(s => s.spell_name)
    const { data: available } = await supabase
      .from('spells')
      .select('name, spell_level')
      .contains('classes', [char.class])
      .order('spell_level', { ascending: true })

    if (!available || available.length === 0) {
      client.say(channel, `@${username} — you've learned all available spells for your class!`)
      return
    }

    const eligible = available.filter(s =>
      !knownNames.includes(s.name) &&
      char.level >= getMinLevelForSpellLevel(s.spell_level)
    )

    if (eligible.length === 0) {
      client.say(channel, `@${username} — no spells available at your current level. Keep leveling!`)
      return
    }

    const prefix = isPrayer ? '🙏 Spells available to pray for' : '📚 Spells available to learn'
    const spellList = eligible.slice(0, 10).map(s => `${s.name} (Lv${s.spell_level})`).join(', ')
    client.say(channel,
      `${prefix} — @${username} (${currentCount}/${maxSlots} slots used): ${spellList} ` +
      `${eligible.length > 10 ? `...and ${eligible.length - 10} more.` : ''} ` +
      `Use !learnspell [name] to learn one.`
    )
    return
  }

  if (currentCount >= maxSlots) {
    client.say(channel, `@${username} — your spellbook is full (${maxSlots} spells). Level up to unlock more slots.`)
    return
  }

  const spellNameInput = args.join(' ').toLowerCase()
  const { data: spell } = await supabase
    .from('spells')
    .select('*')
    .contains('classes', [char.class])
    .ilike('name', `%${spellNameInput}%`)
    .limit(1)
    .single()

  if (!spell) {
    client.say(channel, `@${username} — spell not found or not available to your class. Use !learnspell to browse.`)
    return
  }

  const minLevel = getMinLevelForSpellLevel(spell.spell_level)
  if (char.level < minLevel) {
    client.say(channel, `@${username} — you need to be level ${minLevel} to learn ${spell.name} (spell level ${spell.spell_level}).`)
    return
  }

  const alreadyKnown = (currentSpells ?? []).some(s => s.spell_name === spell.name)
  if (alreadyKnown) {
    client.say(channel, `@${username} — you already know ${spell.name}.`)
    return
  }

  await supabase.from('player_spellbook').insert({
    username,
    spell_name: spell.name,
    source: isPrayer ? 'prayer' : 'learned',
  })

  const successMsg = isPrayer
    ? `🙏 @${username} prays and receives ${spell.name} (Level ${spell.spell_level}) from their deity!`
    : `📚 @${username} learns ${spell.name} (Level ${spell.spell_level})! (${currentCount + 1}/${maxSlots} slots)`

  client.say(channel, successMsg)
}

export const learnspellCommand: BotCommand = {
  name: 'learnspell',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    await handleLearnSpell(channel, username, args, client, false)
  }
}

export const prayforspellsCommand: BotCommand = {
  name: 'prayforspells',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('class')
      .eq('twitch_username', username)
      .single()

    if (!char || !DIVINE_PREP_CLASSES.includes(char.class)) {
      client.say(channel, `@${username} — only divine casters (Cleric, Paladin, Favored Soul, Dark Apostate) can pray for spells.`)
      return
    }

    await handleLearnSpell(channel, username, args, client, true)
  }
}

// ------------------------------------------------------------
// !scribescroll [spellname] — learn spell from scroll in inventory
// ------------------------------------------------------------

export const scribescrollCommand: BotCommand = {
  name: 'scribescroll',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !scribescroll [spellname]. Check !inventory for scrolls.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('id, class, level')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet!`)
      return
    }

    const spellNameInput = args.join(' ').toLowerCase()

    const { data: scroll } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .eq('item_type', 'scroll')
      .ilike('item_name', `%${spellNameInput}%`)
      .limit(1)
      .single()

    if (!scroll) {
      client.say(channel, `@${username} — no matching scroll found in your inventory. Use !inventory to check.`)
      return
    }

    const { data: spell } = await supabase
      .from('spells')
      .select('*')
      .contains('classes', [char.class])
      .ilike('name', `%${spellNameInput}%`)
      .limit(1)
      .single()

    if (!spell) {
      client.say(channel, `@${username} — this scroll contains a spell your class cannot use.`)
      return
    }

    const minLevel = getMinLevelForSpellLevel(spell.spell_level)
    if (char.level < minLevel) {
      client.say(channel, `@${username} — you need to be level ${minLevel} to scribe ${spell.name}.`)
      return
    }

    const { data: existing } = await supabase
      .from('player_spellbook')
      .select('id')
      .eq('username', username)
      .eq('spell_name', spell.name)
      .single()

    if (existing) {
      client.say(channel, `@${username} — you already know ${spell.name}. The scroll is still consumed.`)
      await supabase.from('inventory').delete().eq('id', scroll.id)
      return
    }

    const maxSlots = getSpellSlotCount(char.level)
    const { data: currentSpells } = await supabase
      .from('player_spellbook')
      .select('spell_name')
      .eq('username', username)

    if ((currentSpells?.length ?? 0) >= maxSlots) {
      client.say(channel, `@${username} — your spellbook is full. Level up to unlock more slots.`)
      return
    }

    await supabase.from('player_spellbook').insert({
      username,
      spell_name: spell.name,
      source: 'scroll',
    })

    await supabase.from('inventory').delete().eq('id', scroll.id)

    client.say(channel,
      `📜 @${username} scribes ${spell.name} from the scroll! ` +
      `The scroll crumbles to dust. Knowledge preserved.`
    )
  }
}