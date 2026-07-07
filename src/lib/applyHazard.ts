import { Client } from 'tmi.js'
import { supabase } from './supabase'
import { pickHazard, rollHazardDamage, HAZARD_IMMUNE_CLASSES, HAZARD_RESISTANT_CLASSES } from '../game/hazards'
import { trimGraveyard } from './graveyard'

export async function triggerHazard(
  client: Client,
  channel: string,
  username: string
): Promise<void> {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, class, twitch_username, display_name, character_name, level, xp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const hazard = pickHazard()

  if (HAZARD_IMMUNE_CLASSES.includes(char.class)) {
    client.say(channel,
      `⚠️ @${username} — ${hazard.name}! ${hazard.description} ` +
      `Your experience keeps you out of harm's way. No damage taken.`
    )
    return
  }

  let damage = rollHazardDamage(hazard)

  if (HAZARD_RESISTANT_CLASSES.includes(char.class)) {
    damage = Math.max(1, Math.floor(damage / 2))
  }

  const newHp = char.hp - damage

  if (newHp <= 0) {
    await supabase.from('graveyard').insert({
      twitch_username: char.twitch_username,
      display_name: char.display_name,
      character_name: char.character_name ?? null,
      class: char.class,
      level: char.level,
      xp: char.xp,
      killed_by: hazard.name,
    })
    await trimGraveyard()
    await supabase.from('characters').delete().eq('twitch_username', username)
    client.say(channel,
      `💀 @${username} — ${hazard.name}! ${hazard.description} ` +
      `${damage} damage. That was the last of it. Use !join to start over.`
    )
    return
  }

  await supabase
    .from('characters')
    .update({ hp: newHp })
    .eq('twitch_username', username)

  const resistMsg = HAZARD_RESISTANT_CLASSES.includes(char.class)
    ? ' (halved — your training absorbs some of it)'
    : ''

  client.say(channel,
    `⚠️ @${username} — ${hazard.name}! ${hazard.description} ` +
    `${damage} damage taken${resistMsg}. (HP: ${newHp}/${char.max_hp})`
  )
}