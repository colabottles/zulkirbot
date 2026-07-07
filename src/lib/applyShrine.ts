import { Client } from 'tmi.js'
import { supabase } from './supabase'
import { applyExploreEffect } from './exploreEffects'
import { pickShrine, GOOD_CLASSES, EVIL_CLASSES } from '../game/godShrines'
import type { ExploreStat } from './exploreEffects'

function getStat(msg: string): ExploreStat {
  if (msg.includes('ATK')) return 'attack'
  if (msg.includes('DEF')) return 'defense'
  return 'damage'
}

export async function triggerGodShrine(
  client: Client,
  channel: string,
  username: string
): Promise<void> {
  const { data: char } = await supabase
    .from('characters')
    .select('class')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const shrine = pickShrine()
  const isGood = GOOD_CLASSES.includes(char.class)
  const isEvil = EVIL_CLASSES.includes(char.class)

  if (shrine.alignment === 'good') {
    if (isGood) {
      const stat = getStat(shrine.boonMsg(username))
      await applyExploreEffect(username, 'buff', stat, 5, `shrine_${shrine.name.toLowerCase()}`, 24 * 60 * 60 * 1000)
      client.say(channel, shrine.boonMsg(username))
    } else if (isEvil) {
      client.say(channel, shrine.debuffMsg(username))
    } else {
      client.say(channel, shrine.neutralMsg(username))
    }
  } else {
    // Evil shrine
    if (isEvil) {
      const stat = getStat(shrine.boonMsg(username))
      await applyExploreEffect(username, 'buff', stat, 5, `shrine_${shrine.name.toLowerCase()}`, 24 * 60 * 60 * 1000)
      client.say(channel, shrine.boonMsg(username))
    } else if (isGood) {
      const stat = getStat(shrine.debuffMsg(username))
      await applyExploreEffect(username, 'debuff', stat, 5, `shrine_${shrine.name.toLowerCase()}_debuff`, 60 * 60 * 1000)
      client.say(channel, shrine.debuffMsg(username))
    } else {
      client.say(channel, shrine.neutralMsg(username))
    }
  }
}