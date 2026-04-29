// ============================================================
// ZulkirBot: Greyhawk Campaign Arc
// ============================================================
// The classic TSR Greyhawk arc adapted as five named campaigns:
//   1. The Village of Hommlet (T1)
//   2. The Temple of Elemental Evil (T1-4)
//   3. Scourge of the Slave Lords (A1-4)
//   4. Against the Giants (G1-2-3)
//   5. Queen of the Spiders (GDQ1-7)
// ============================================================

import { Client } from 'tmi.js'
import { supabase } from '../lib/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import { summonYvannis, rollYvannisStage } from './cleric'
import { d20 } from '../game/dice'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

interface NamedCampaignStage {
  stage: number
  stage_name: string
  enemy_name: string
  enemy_count: number
  enemy_hp: number
  enemy_damage_min: number
  enemy_damage_max: number
  special_name: string | null
  special_damage: number | null
  special_type: 'single' | 'all' | 'debuff' | 'null' | null
  flavor_intro: string
  shrine_flavor: string | null
}

interface NamedCampaignOutcome {
  outcome_key: string
  outcome_label: string
  flavor_text: string
  reward_modifier: number
  bonus_xp: number
  consequence_key: string | null
  is_known: boolean
}

interface NamedCampaign {
  slug: string
  name: string
  setting: string
  description: string
  unlock_required: number
  difficulty_mod: number
  yvannis_stage: number | null
}

interface Participant {
  username: string
  hp: number
  max_hp: number
  is_alive: boolean
  stage_reached: number
}

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const JOIN_WINDOW_MS = 60_000
const MODE_CHOICE_MS = 30_000
const VOTE_WINDOW_MS = 180_000
const TIEBREAK_WINDOW_MS = 180_000
const SHRINE_HEAL_HP = 20
const NAMED_STAGE_XP = [75, 150, 200, 275, 400]
const NAMED_STAGE_GOLD = [30, 60, 80, 110, 160]
const CLEAR_BONUS_XP = 350
const CLEAR_BONUS_GOLD = 150

const GREYHAWK_SLUGS = [
  'village-of-hommlet',
  'temple-of-elemental-evil',
  'scourge-of-the-slave-lords',
  'against-the-giants',
  'queen-of-the-spiders',
]

// Sequential unlock — each campaign requires the previous one
const GREYHAWK_PREREQUISITES: Record<string, string | null> = {
  'village-of-hommlet': null,
  'temple-of-elemental-evil': 'village-of-hommlet',
  'scourge-of-the-slave-lords': 'temple-of-elemental-evil',
  'against-the-giants': 'scourge-of-the-slave-lords',
  'queen-of-the-spiders': 'against-the-giants',
}

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

const roll = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const say = (client: Client, channel: string, msg: string) =>
  client.say(channel, msg)

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

// ------------------------------------------------------------
// Unlock check
// ------------------------------------------------------------

async function checkGreyhawkUnlock(
  supabase: SupabaseClient,
  username: string,
  slug: string
): Promise<boolean> {
  // First campaign requires 3 standard clears
  if (slug === 'village-of-hommlet') {
    const { data } = await supabase
      .from('player_campaign_clears')
      .select('standard_clears')
      .eq('username', username)
      .single()
    if (!data) return false
    return data.standard_clears >= 3
  }

  // All others require the previous Greyhawk campaign to be cleared
  const prerequisite = GREYHAWK_PREREQUISITES[slug]
  if (!prerequisite) return false

  const { data } = await supabase
    .from('player_greyhawk_clears')
    .select('slug')
    .eq('username', username)
    .eq('slug', prerequisite)
    .single()

  return !!data
}

async function recordGreyhawkClear(
  supabase: SupabaseClient,
  username: string,
  slug: string
): Promise<void> {
  await supabase
    .from('player_greyhawk_clears')
    .upsert(
      { username, slug, cleared_at: new Date().toISOString() },
      { onConflict: 'username,slug', ignoreDuplicates: true }
    )
}

async function ensureClearRecord(supabase: SupabaseClient, username: string) {
  await supabase
    .from('player_campaign_clears')
    .upsert({ username }, { onConflict: 'username', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Channel difficulty modifier
// ------------------------------------------------------------

async function getChannelDifficultyMod(
  supabase: SupabaseClient,
  channel: string
): Promise<{ hpMod: number; dmgMod: number }> {
  const { data } = await supabase
    .from('channel_consequence_flags')
    .select('difficulty_hp_mod, difficulty_dmg_mod')
    .eq('channel', channel)
    .eq('flag_type', 'spread_difficulty_active')
    .eq('is_active', true)
    .single()

  if (!data) return { hpMod: 1.0, dmgMod: 1.0 }
  return {
    hpMod: data.difficulty_hp_mod ?? 1.0,
    dmgMod: data.difficulty_dmg_mod ?? 1.0,
  }
}

// ------------------------------------------------------------
// Consequence triggers
// ------------------------------------------------------------

// hommlet_informant — Lareth delivered, the authorities are watching (Deliver Lareth)
async function triggerHommletInformant(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.60 // tilted toward boon — the authorities remember you favorably

  if (isBoon) {
    const bonus = roll(10, 25)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — A message arrives from Verbobonc. The authorities remember what you did in Hommlet. ` +
      `The information Lareth provided led somewhere useful. You are owed a favor. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const drain = Math.floor(char.gold * 0.10)
    if (drain > 0) {
      await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username)
      await say(client, channel,
        `@${username} — The authorities who took custody of Lareth have questions. ` +
        `The questions require a journey to Verbobonc. The journey requires coin. ` +
        `-${drain}gp. (${char.gold - drain}gp remaining)`
      )
    }
  }

  await supabase.from('player_consequence_flags').update({ hommlet_triggered: true }).eq('id', flagId)
}

// hommlet_watcher — someone noticed Lareth died (Execute Lareth)
async function triggerHommletWatcher(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.30) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const drain = Math.floor(char.max_hp * 0.10)
  const newHp = Math.max(1, char.hp - drain)

  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The traveller with the closed fist symbol found you. ` +
    `He did not speak. He did not need to. The message was delivered in a more direct medium. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ hommlet_watcher_triggered: true }).eq('id', flagId)
}

// hommlet_shadow — Lareth walked and is reporting (Let Lareth Escape)
async function triggerHommletShadow(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.15)
  const hpDrain = Math.floor(char.max_hp * 0.10)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — Lareth the Beautiful has not forgotten who let him walk out of that dungeon. ` +
    `He has not forgiven it either. The Master he serves has long reach. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ hommlet_shadow_triggered: true }).eq('id', flagId)
}

// hommlet_failure — the cult regrouped (Failure)
async function triggerHommletFailure(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const drain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - drain)

  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The moathouse is more active than it was. ` +
    `The cult you failed to stop has had time to rebuild. ` +
    `Something in the marsh remembers you. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ hommlet_failure_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Temple of Elemental Evil consequence triggers
// ------------------------------------------------------------

// temple_sealed — the seals hold, for now (Seal the Temple)
async function triggerTemplateSealed(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.65 // tilted toward boon — the seals are holding

  if (isBoon) {
    const bonus = roll(10, 25)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The seals on the Temple are holding. ` +
      `Something that was watching has turned its attention elsewhere, briefly. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const drain = Math.floor(char.max_hp * 0.08)
    const newHp = Math.max(1, char.hp - drain)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The seals on the Temple are holding. ` +
      `Something is testing them. You can feel it from here. ` +
      `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ temple_sealed_triggered: true }).eq('id', flagId)
}

// eye_shattered — the Eye is gone but the absence left something (Destroy the Eye)
async function triggerEyeShattered(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.50

  if (isBoon) {
    const bonus = roll(15, 35)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Something filled the space where the Elder Elemental Eye was. ` +
      `Today it is favorable. The scholars in Greyhawk City are still arguing about what it is. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const goldDrain = Math.floor(char.gold * 0.15)
    const hpDrain = Math.floor(char.max_hp * 0.10)
    const newHp = Math.max(1, char.hp - hpDrain)
    const newGold = Math.max(0, char.gold - goldDrain)
    await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Something filled the space where the Elder Elemental Eye was. ` +
      `Today it is not favorable. The scholars in Greyhawk City are still arguing about what it is. ` +
      `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ eye_shattered_triggered: true }).eq('id', flagId)
}

// zuggtmoy_pact — Zuggtmoy is free and keeping track (Bargain with Zuggtmoy)
async function triggerZuggtmoyPact(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.20)
  const hpDrain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — Zuggtmoy has not forgotten who opened her door. ` +
    `She does not forget anything. The Demon Queen of Fungi has long reach and no goodwill toward you specifically. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ zuggtmoy_triggered: true }).eq('id', flagId)
}

// temple_rising — the Temple is more active than before (Failure)
async function triggerTempleRising(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const drain = Math.floor(char.max_hp * 0.14)
  const newHp = Math.max(1, char.hp - drain)

  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The Temple is more active than it was. ` +
    `The seals continue to weaken on the schedule they were already weakening on. ` +
    `Something in the Temple remembers you were there. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ temple_rising_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Scourge of the Slave Lords consequence triggers
// ------------------------------------------------------------

// slavers_broken — the organization is broken, the Pomarj remembers (Destroy the Slave Lords)
async function triggerSlaversBroken(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.65

  if (isBoon) {
    const bonus = roll(10, 30)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The Pomarj remembers who broke the Slave Lords. ` +
      `Someone who was in the stockade has found a way to return the favor. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const drain = Math.floor(char.max_hp * 0.08)
    const newHp = Math.max(1, char.hp - drain)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The Pomarj remembers who broke the Slave Lords. ` +
      `Not everyone who remembers is grateful. ` +
      `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ slavers_broken_triggered: true }).eq('id', flagId)
}

// network_exposed — the ledger is public, the information keeps paying forward (Expose the Network)
async function triggerNetworkExposed(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.40) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const bonus = roll(15, 35)
  const newHp = Math.min(char.max_hp, char.hp + bonus)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel,
    `@${username} — The ledger keeps producing consequences. ` +
    `One of Mordenkainen''s associates sends a message. The information you found is still useful. ` +
    `+${bonus} HP. (${newHp}/${char.max_hp})`
  )

  await supabase.from('player_consequence_flags').update({ network_exposed_triggered: true }).eq('id', flagId)
}

// slaver_gold — the treasury was taken, hunters follow (Take the Treasury)
async function triggerSlaverGold(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.20)
  const hpDrain = Math.floor(char.max_hp * 0.10)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The organization has a list of people who took their treasury. ` +
    `You are on the list. The list has been acted upon. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ slaver_gold_triggered: true }).eq('id', flagId)
}

// slavers_regrouped — the organization rebuilt, it remembers (Failure)
async function triggerSlaversRegrouped(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.15)
  const hpDrain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The Slave Lords regrouped. The succession process worked. ` +
    `The organization filed a report on what happened in the aerie. Your name is in it. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ slavers_regrouped_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Against the Giants consequence triggers
// ------------------------------------------------------------

// eclavdra_slain — House Eilservs hunts the party (Destroy Eclavdra)
async function triggerEclavdraSlain(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.30 // tilted toward toll — House Eilservs has a long memory

  if (isBoon) {
    const bonus = roll(10, 25)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — House Eilservs has enemies of its own. ` +
      `One of them has decided that the party is useful, briefly. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const hpDrain = Math.floor(char.max_hp * 0.12)
    const goldDrain = Math.floor(char.gold * 0.15)
    const newHp = Math.max(1, char.hp - hpDrain)
    const newGold = Math.max(0, char.gold - goldDrain)
    await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — House Eilservs has a long memory. ` +
      `The party killed one of its nobles. The house has sent a reminder that it noticed. ` +
      `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ eclavdra_slain_triggered: true }).eq('id', flagId)
}

// drow_exposed — the evidence pays forward (Expose the Drow Connection)
async function triggerDrowExposed(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.40) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const bonus = roll(15, 35)
  const newHp = Math.min(char.max_hp, char.hp + bonus)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The evidence of drow involvement keeps producing consequences. ` +
    `Mordenkainen''s associate sends another message. The information is still useful to people who know how to use it. ` +
    `+${bonus} HP. (${newHp}/${char.max_hp})`
  )

  await supabase.from('player_consequence_flags').update({ drow_exposed_triggered: true }).eq('id', flagId)
}

// underdark_marked — the Underdark noticed the party (Follow the Thread)
async function triggerUnderdarked(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.40

  if (isBoon) {
    const bonus = roll(10, 28)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Something in the Underdark has decided the party is interesting rather than dangerous. Briefly. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const hpDrain = Math.floor(char.max_hp * 0.12)
    const newHp = Math.max(1, char.hp - hpDrain)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The Underdark noticed the party when they entered. ` +
      `It has not stopped noticing. Something has followed the thread back up. ` +
      `-${hpDrain} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ underdark_triggered: true }).eq('id', flagId)
}

// giants_emboldened — the routes are finished, the raids resumed (Failure)
async function triggerGiantsEmboldened(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const hpDrain = Math.floor(char.max_hp * 0.14)
  const goldDrain = Math.floor(char.gold * 0.18)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The routes are finished. The raids have resumed with a different character. ` +
    `Eclavdra sent the brooch back. It was not a compliment. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ giants_emboldened_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Queen of the Spiders consequence triggers
// ------------------------------------------------------------

// web_broken — Lolth driven back, the problem she was containing is loose (Destroy Lolth's Web)
async function triggerWebBroken(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const hpDrain = Math.floor(char.max_hp * 0.14)
  const newHp = Math.max(1, char.hp - hpDrain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The problem Lolth was containing is no longer contained. ` +
    `You broke the web that was holding it. The consequences are arriving on their own schedule. ` +
    `-${hpDrain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ web_broken_triggered: true }).eq('id', flagId)
}

// web_sealed — the seal holds, Iuz noticed (Seal the Demonweb)
async function triggerWebSealed(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.40) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const isBoon = Math.random() < 0.55

  if (isBoon) {
    const bonus = roll(15, 35)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The seal on the Demonweb is holding. ` +
      `Something that was counting on it not holding is having to revise its plans. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const hpDrain = Math.floor(char.max_hp * 0.10)
    const newHp = Math.max(1, char.hp - hpDrain)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Iuz noticed what you did in the Demonweb. He is not pleased. ` +
      `You were counting on a plan proceeding that did not proceed because of you. ` +
      `-${hpDrain} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ web_sealed_triggered: true }).eq('id', flagId)
}

// lolth_pact — the pact follows, the information is terrible (Bargain with Lolth)
async function triggerLolthPact(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.25)
  const hpDrain = Math.floor(char.max_hp * 0.16)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — The pact with Lolth includes a clause you noticed only after agreeing. ` +
    `The clause involves Iuz. The Demon Queen of Spiders collects what she is owed. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ lolth_pact_triggered: true }).eq('id', flagId)
}

// lolth_triumphant — the plan matured (Failure)
async function triggerLolthTriumphant(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp, gold')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const goldDrain = Math.floor(char.gold * 0.25)
  const hpDrain = Math.floor(char.max_hp * 0.18)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — Lolth''s plan matured. The situation is the message. ` +
    `The world changed while you were in the Demonweb. ` +
    `The change is your fault in the particular way that inaction is fault. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ lolth_triumphant_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Consequence check (called from router.ts via checkConsequences)
// ------------------------------------------------------------

export async function checkGreyhawkConsequences(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string
) {
  const { data: flags } = await supabase
    .from('active_player_consequences')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)

  if (!flags || flags.length === 0) return

  for (const flag of flags) {
    if (flag.flag_type === 'hommlet_informant' && flag.trigger_ready && !flag.hommlet_triggered)
      await triggerHommletInformant(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'hommlet_watcher' && flag.trigger_ready && !flag.hommlet_watcher_triggered)
      await triggerHommletWatcher(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'hommlet_shadow' && flag.trigger_ready && !flag.hommlet_shadow_triggered)
      await triggerHommletShadow(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'hommlet_failure' && flag.trigger_ready && !flag.hommlet_failure_triggered)
      await triggerHommletFailure(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'temple_sealed' && flag.trigger_ready && !flag.temple_sealed_triggered)
      await triggerTemplateSealed(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'eye_shattered' && flag.trigger_ready && !flag.eye_shattered_triggered)
      await triggerEyeShattered(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'zuggtmoy_pact' && flag.trigger_ready && !flag.zuggtmoy_triggered)
      await triggerZuggtmoyPact(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'temple_rising' && flag.trigger_ready && !flag.temple_rising_triggered)
      await triggerTempleRising(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'slavers_broken' && flag.trigger_ready && !flag.slavers_broken_triggered)
      await triggerSlaversBroken(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'network_exposed' && flag.trigger_ready && !flag.network_exposed_triggered)
      await triggerNetworkExposed(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'slaver_gold' && flag.trigger_ready && !flag.slaver_gold_triggered)
      await triggerSlaverGold(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'slavers_regrouped' && flag.trigger_ready && !flag.slavers_regrouped_triggered)
      await triggerSlaversRegrouped(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'eclavdra_slain' && flag.trigger_ready && !flag.eclavdra_slain_triggered)
      await triggerEclavdraSlain(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'drow_exposed' && flag.trigger_ready && !flag.drow_exposed_triggered)
      await triggerDrowExposed(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'underdark_marked' && flag.trigger_ready && !flag.underdark_triggered)
      await triggerUnderdarked(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'giants_emboldened' && flag.trigger_ready && !flag.giants_emboldened_triggered)
      await triggerGiantsEmboldened(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'web_broken' && flag.trigger_ready && !flag.web_broken_triggered)
      await triggerWebBroken(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'web_sealed' && flag.trigger_ready && !flag.web_sealed_triggered)
      await triggerWebSealed(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'lolth_pact' && flag.trigger_ready && !flag.lolth_pact_triggered)
      await triggerLolthPact(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'lolth_triumphant' && flag.trigger_ready && !flag.lolth_triumphant_triggered)
      await triggerLolthTriumphant(client, supabase, channel, username, flag.id)
  }
}

// ------------------------------------------------------------
// Stage milestone titles
// ------------------------------------------------------------

const HOMMLET_STAGE_TITLES: Record<number, string> = {
  2: 'Drank at the Welcome Wench',
  3: 'Crossed the Rotted Bridge',
  4: 'Found the Dungeon Below',
  5: 'Heard the Name Spoken',
}

async function awardHommletStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = HOMMLET_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'village-of-hommlet' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

const TEMPLE_STAGE_TITLES: Record<number, string> = {
  2: 'Walked the Road East',
  3: 'Entered the Forecourt',
  4: 'Walked Between the Nodes',
  5: 'Stood in the Inner Fane',
}

async function awardTempleStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = TEMPLE_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'temple-of-elemental-evil' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

const SLAVERS_STAGE_TITLES: Record<number, string> = {
  2: 'Walked the Docks of Highport',
  3: 'Found the Ledger',
  4: 'Entered Suderham',
  5: 'Sat in the Council Chamber',
}

async function awardSlaversStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = SLAVERS_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'scourge-of-the-slave-lords' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

const GIANTS_STAGE_TITLES: Record<number, string> = {
  2: 'Broke the Steading',
  3: 'Crossed the Glacial Rift',
  4: 'Walked the Hall of the Fire Giant King',
  5: 'Entered the Dark Passage',
}

async function awardGiantsStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = GIANTS_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'against-the-giants' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

const SPIDERS_STAGE_TITLES: Record<number, string> = {
  2: 'Walked the Underdark Roads',
  3: 'Entered the City of the Drow',
  4: 'Stood in the Fane of Lolth',
  5: 'Passed the Aspect',
}

async function awardSpidersStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = SPIDERS_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'queen-of-the-spiders' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

async function awardGreyhawkArcTitle(
  supabase: SupabaseClient,
  username: string
) {
  await supabase
    .from('player_titles')
    .upsert(
      { username, title: 'Who Walked the Greyhawk Arc', source: 'greyhawk-arc' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
  await supabase
    .from('player_greyhawk_arc_complete')
    .upsert(
      { username, completed_at: new Date().toISOString() },
      { onConflict: 'username', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// Death handler
// ------------------------------------------------------------

async function handleDeath(
  supabase: SupabaseClient,
  campaignId: string,
  player: Participant,
  stage: number
) {
  await supabase
    .from('campaign_participants')
    .update({ hp: 0, is_alive: false, stage_reached: stage })
    .eq('campaign_id', campaignId)
    .eq('username', player.username)
}

// ------------------------------------------------------------
// Rest shrine
// ------------------------------------------------------------

async function restShrine(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  stage: NamedCampaignStage,
  participants: Participant[]
) {
  if (!stage.shrine_flavor) return
  await say(client, channel, stage.shrine_flavor)
  await delay(2000)
  for (const p of participants.filter(p => p.is_alive)) {
    const healed = Math.min(SHRINE_HEAL_HP, p.max_hp - p.hp)
    p.hp += healed
    await supabase
      .from('campaign_participants')
      .update({ hp: p.hp })
      .eq('campaign_id', campaignId)
      .eq('username', p.username)
    await say(client, channel, `${p.username} recovers ${healed} HP at the shrine. (${p.hp}/${p.max_hp} HP)`)
    await delay(800)
  }
}

// ------------------------------------------------------------
// Stage combat engine
// ------------------------------------------------------------

async function runStage(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  stage: NamedCampaignStage,
  participants: Participant[],
  diffMod: { hpMod: number; dmgMod: number }
): Promise<{ survivors: Participant[]; defeated: Participant[] }> {
  const alive = participants.filter(p => p.is_alive)
  const enemyMaxHp = Math.ceil(stage.enemy_hp * diffMod.hpMod)
  const dmgMin = Math.ceil(stage.enemy_damage_min * diffMod.dmgMod)
  const dmgMax = Math.ceil(stage.enemy_damage_max * diffMod.dmgMod)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `Stage ${stage.stage}/5 — ${stage.stage_name}`)
  await delay(1500)
  await say(client, channel, stage.flavor_intro)
  await delay(2500)

  const enemyHPs = Array(stage.enemy_count).fill(enemyMaxHp)
  let specialFired = false
  let round = 1

  while (enemyHPs.some(hp => hp > 0) && alive.some(p => p.is_alive)) {
    await say(client, channel, `— Round ${round} —`)
    await delay(1500)

    for (const player of alive.filter(p => p.is_alive)) {
      const targetIdx = enemyHPs.findIndex(hp => hp > 0)
      if (targetIdx === -1) break

      const dmg = roll(12, 28)
      enemyHPs[targetIdx] = Math.max(0, enemyHPs[targetIdx] - dmg)
      await say(client, channel,
        `${player.username} hits ${stage.enemy_name} for ${dmg} damage! ` +
        `(${Math.max(0, enemyHPs[targetIdx])} HP remaining)`
      )
      await delay(1200)

      if (enemyHPs[targetIdx] === 0) {
        await say(client, channel, `${stage.enemy_name} has fallen!`)
        await delay(1000)
      }
    }

    for (let i = 0; i < stage.enemy_count; i++) {
      if (enemyHPs[i] <= 0) continue

      if (!specialFired && round === 2 && stage.special_name) {
        if (stage.special_type === 'all') {
          const specialDmg = Math.ceil((stage.special_damage ?? 20) * diffMod.dmgMod)
          await say(client, channel,
            `${stage.enemy_name} uses ${stage.special_name}! All party members take ${specialDmg} damage!`
          )
          for (const p of alive.filter(p => p.is_alive)) {
            p.hp = Math.max(0, p.hp - specialDmg)
            await say(client, channel, `${p.username} — ${p.hp} HP remaining.`)
            if (p.hp <= 0) {
              p.is_alive = false
              await handleDeath(supabase, campaignId, p, stage.stage)
              await say(client, channel, `${p.username} has fallen! Permadeath — they are out of the campaign.`)
            }
          }
          specialFired = true
          await delay(2000)
        } else if (stage.special_type === 'single') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            const specialDmg = Math.ceil((stage.special_damage ?? 25) * diffMod.dmgMod)
            target.hp = Math.max(0, target.hp - specialDmg)
            await say(client, channel,
              `${stage.enemy_name} uses ${stage.special_name} on ${target.username} for ${specialDmg} damage! ` +
              `(${target.hp} HP remaining)`
            )
            if (target.hp <= 0) {
              target.is_alive = false
              await handleDeath(supabase, campaignId, target, stage.stage)
              await say(client, channel, `${target.username} has fallen! Permadeath — they are out of the campaign.`)
            }
          }
          specialFired = true
          await delay(1500)
        } else if (stage.special_type === 'debuff') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            await say(client, channel,
              `${stage.enemy_name} uses ${stage.special_name}! ${target.username}''s next attack is suppressed!`
            )
          }
          specialFired = true
          await delay(1500)
        }
      } else {
        const target = pickRandom(alive.filter(p => p.is_alive))
        if (!target) break
        const dmg = roll(dmgMin, dmgMax)
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel,
          `${stage.enemy_name} strikes ${target.username} for ${dmg} damage! (${target.hp} HP remaining)`
        )
        await delay(1200)
        if (target.hp <= 0) {
          target.is_alive = false
          await handleDeath(supabase, campaignId, target, stage.stage)
          await say(client, channel, `${target.username} has fallen! Permadeath — they are out of the campaign.`)
          await delay(1000)
        }
      }
    }

    round++
    if (round > 8) {
      for (let i = 0; i < enemyHPs.length; i++) enemyHPs[i] = 0
      await say(client, channel, `The enemy is overwhelmed and routed!`)
    }
    await delay(1500)
  }

  return {
    survivors: alive.filter(p => p.is_alive),
    defeated: alive.filter(p => !p.is_alive),
  }
}

// ------------------------------------------------------------
// Ending vote
// ------------------------------------------------------------

async function runEndingVote(
  client: Client,
  channel: string,
  participants: Participant[],
  outcomes: NamedCampaignOutcome[]
): Promise<NamedCampaignOutcome> {
  const participantNames = new Set(participants.map(p => p.username.toLowerCase()))
  const votes = new Map<string, string>()
  const voteMenu = outcomes.map((o, i) => `${i + 1}) ${o.outcome_label}`).join(' | ')

  await say(client, channel,
    `THE DECISION AWAITS. Participants vote now! Type the number of your choice. 3 minutes. | ${voteMenu}`
  )

  await collectVotes(client, channel, participantNames, outcomes, votes, VOTE_WINDOW_MS)
  let result = tallyVotes(votes, outcomes)

  if (result === null) {
    await say(client, channel,
      `The vote is tied! The decision opens to ALL of chat for 3 more minutes! | ${voteMenu}`
    )
    const allChat = new Map<string, string>()
    await collectVotes(client, channel, null, outcomes, allChat, TIEBREAK_WINDOW_MS)
    result = tallyVotes(new Map([...allChat, ...votes]), outcomes)
    if (result === null) {
      result = pickRandom(outcomes)
      await say(client, channel, `Still tied. Fate decides. The answer is: ${result.outcome_label}`)
    }
  }

  return result
}

function collectVotes(
  client: Client,
  channel: string,
  allowedUsers: Set<string> | null,
  outcomes: NamedCampaignOutcome[],
  votes: Map<string, string>,
  windowMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.removeListener('message', handler)
      resolve()
    }, windowMs)

    const handler = (_chan: string, tags: Record<string, unknown>, message: string) => {
      const username = tags['display-name']?.toString().toLowerCase() ?? ''
      if (allowedUsers && !allowedUsers.has(username)) return
      const num = parseInt(message.trim(), 10)
      if (isNaN(num) || num < 1 || num > outcomes.length) return
      votes.set(username, outcomes[num - 1].outcome_key)
    }

    client.on('message', handler)

    if (allowedUsers) {
      const interval = setInterval(() => {
        if ([...allowedUsers].every(u => votes.has(u))) {
          clearTimeout(timeout)
          clearInterval(interval)
          client.removeListener('message', handler)
          resolve()
        }
      }, 2000)
    }
  })
}

function tallyVotes(
  votes: Map<string, string>,
  outcomes: NamedCampaignOutcome[]
): NamedCampaignOutcome | null {
  if (votes.size === 0) return pickRandom(outcomes)
  const counts = new Map<string, number>()
  for (const key of votes.values()) counts.set(key, (counts.get(key) ?? 0) + 1)
  const max = Math.max(...counts.values())
  const winners = outcomes.filter(o => (counts.get(o.outcome_key) ?? 0) === max)
  return winners.length === 1 ? winners[0] : null
}

// ------------------------------------------------------------
// Consequence writer
// ------------------------------------------------------------

async function writeConsequences(
  supabase: SupabaseClient,
  campaignId: string,
  participants: Participant[],
  outcome: NamedCampaignOutcome,
  campaignSlug: string
) {
  if (!outcome.consequence_key) return

  for (const p of participants) {
    const failureKeys = [
      'hommlet_failure', 'temple_rising', 'slavers_regrouped',
      'giants_emboldened', 'lolth_triumphant'
    ]
    if (!p.is_alive && !failureKeys.includes(outcome.consequence_key ?? '')) continue

    const base: Record<string, unknown> = {
      username: p.username,
      flag_type: outcome.consequence_key,
      is_active: true,
      source_campaign_slug: campaignSlug,
      source_campaign_id: campaignId,
    }

    switch (outcome.consequence_key) {
      case 'hommlet_informant':
        base.hommlet_trigger_at = roll(2, 4)
        base.hommlet_campaign_counter = 0
        break
      case 'hommlet_watcher':
        base.hommlet_trigger_at = roll(1, 3)
        base.hommlet_campaign_counter = 0
        break
      case 'hommlet_shadow':
        base.hommlet_trigger_at = 1
        base.hommlet_campaign_counter = 0
        break
      case 'hommlet_failure':
        base.hommlet_trigger_at = 1
        base.hommlet_campaign_counter = 0
        break
      case 'temple_sealed':
        base.temple_trigger_at = roll(2, 4)
        base.temple_campaign_counter = 0
        break
      case 'eye_shattered':
        base.eye_trigger_at = 1
        base.eye_campaign_counter = 0
        break
      case 'zuggtmoy_pact':
        base.zuggtmoy_trigger_at = 1
        base.zuggtmoy_campaign_counter = 0
        break
      case 'temple_rising':
        base.temple_trigger_at = 1
        base.temple_campaign_counter = 0
        break
      case 'slavers_broken':
        base.slavers_trigger_at = roll(2, 4)
        base.slavers_campaign_counter = 0
        break
      case 'network_exposed':
        base.network_trigger_at = roll(2, 4)
        base.network_campaign_counter = 0
        break
      case 'slaver_gold':
        base.slaver_trigger_at = 1
        base.slaver_campaign_counter = 0
        break
      case 'slavers_regrouped':
        base.regrouped_trigger_at = 1
        base.regrouped_campaign_counter = 0
        break
      case 'eclavdra_slain':
        base.eclavdra_trigger_at = 1
        base.eclavdra_campaign_counter = 0
        break
      case 'drow_exposed':
        base.drow_trigger_at = roll(2, 4)
        base.drow_campaign_counter = 0
        break
      case 'underdark_marked':
        base.underdark_trigger_at = 1
        base.underdark_campaign_counter = 0
        break
      case 'giants_emboldened':
        base.giants_trigger_at = 1
        base.giants_campaign_counter = 0
        break
      case 'web_broken':
        base.web_broken_trigger_at = 1
        base.web_broken_campaign_counter = 0
        break
      case 'web_sealed':
        base.web_sealed_trigger_at = roll(2, 4)
        base.web_sealed_campaign_counter = 0
        break
      case 'lolth_pact':
        base.lolth_trigger_at = 1
        base.lolth_campaign_counter = 0
        break
      case 'lolth_triumphant':
        base.lolth_triumphant_trigger_at = 1
        base.lolth_triumphant_campaign_counter = 0
        break
    }

    await supabase
      .from('player_consequence_flags')
      .upsert(base, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
  }
}

// ------------------------------------------------------------
// Reward writer
// ------------------------------------------------------------

async function writeRewards(
  supabase: SupabaseClient,
  campaignId: string,
  participants: Participant[],
  outcome: NamedCampaignOutcome,
  campaignSlug: string,
  fullClear: boolean
) {
  const { data: titleRows } = await supabase
    .from('named_campaign_titles')
    .select('title')
    .eq('campaign_slug', campaignSlug)
    .or(`outcome_key.is.null,outcome_key.eq.${outcome.outcome_key}`)

  const { data: artifactRows } = await supabase
    .from('named_campaign_artifacts')
    .select('artifact_name')
    .eq('campaign_slug', campaignSlug)

  const titlePool = (titleRows ?? []) as { title: string }[]
  const artifactPool = (artifactRows ?? []) as { artifact_name: string }[]
  const titleEarned = titlePool.length > 0 ? pickRandom(titlePool).title : null
  const artifactName = artifactPool.length > 0 ? pickRandom(artifactPool).artifact_name : null
  const survivors = participants.filter(p => p.is_alive)
  const artWinner = survivors.length > 0 ? pickRandom(survivors) : null

  for (const p of participants) {
    let xp = NAMED_STAGE_XP.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    let gold = NAMED_STAGE_GOLD.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    xp = Math.floor(xp * outcome.reward_modifier)
    gold = Math.floor(gold * outcome.reward_modifier)

    if (fullClear && p.is_alive) {
      xp += Math.floor(CLEAR_BONUS_XP * outcome.reward_modifier) + outcome.bonus_xp
      gold += Math.floor(CLEAR_BONUS_GOLD * outcome.reward_modifier)
    }

    await supabase.from('campaign_rewards').insert({
      campaign_id: campaignId,
      username: p.username,
      xp_earned: xp,
      gold_earned: gold,
      title_earned: fullClear && p.is_alive ? titleEarned : null,
      artifact_earned: p.username === artWinner?.username ? artifactName : null,
    })

    const { data: char } = await supabase
      .from('characters')
      .select('xp, gold')
      .eq('twitch_username', p.username)
      .single()

    if (char) {
      await supabase
        .from('characters')
        .update({ xp: char.xp + xp, gold: char.gold + gold })
        .eq('twitch_username', p.username)
    }

    await supabase.rpc('increment_campaign_counters', { p_username: p.username })

    if (campaignSlug === 'village-of-hommlet' && p.stage_reached >= 2) {
      await awardHommletStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'temple-of-elemental-evil' && p.stage_reached >= 2) {
      await awardTempleStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'scourge-of-the-slave-lords' && p.stage_reached >= 2) {
      await awardSlaversStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'against-the-giants' && p.stage_reached >= 2) {
      await awardGiantsStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'queen-of-the-spiders' && p.stage_reached >= 2) {
      await awardSpidersStageMilestone(supabase, p.username, p.stage_reached)
    }
  }

  if (fullClear && campaignSlug === 'queen-of-the-spiders') {
    for (const p of survivors) {
      await awardGreyhawkArcTitle(supabase, p.username)
    }
  }

  return { titleEarned, artifactName, artWinner }
}

// ------------------------------------------------------------
// Lolth boss fight — two phases
// ------------------------------------------------------------

async function runLolthFight(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  participants: Participant[],
  diffMod: { hpMod: number; dmgMod: number }
): Promise<{ survivors: Participant[]; defeated: Participant[] }> {
  const alive = participants.filter(p => p.is_alive)
  const dmgMin = Math.ceil(24 * diffMod.dmgMod)
  const dmgMax = Math.ceil(38 * diffMod.dmgMod)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `Stage 5/5 — The Demonweb Pits`)
  await delay(1500)
  await say(client, channel,
    `The Demonweb is not a place. It is a condition. ` +
    `The party has been inside it since the moment they entered the Underdark roads, ` +
    `perhaps since the moment they stepped into the moathouse east of Hommlet. ` +
    `Lolth has been here the entire time.`
  )
  await delay(3000)
  await say(client, channel,
    `"You thought I was the problem." She descends from the web above. ` +
    `"I am not the problem. I am the one who has been trying to contain the problem. " ` +
    `"Iuz built his empire on the assumption that I would be occupied with my own ambitions. " ` +
    `"He was correct. But he did not account for you." ` +
    `She raises her hand. "Prove me right."`)
  await delay(3000)

  await say(client, channel, `⚔️ PHASE 1 — Lolth, Demon Queen of Spiders (450 HP)`)
  await delay(1500)

  let lolthHp = Math.ceil(450 * diffMod.hpMod)
  let webOfFateFired = false
  let phaseFired = false
  let round = 1
  let inPhase2 = false

  while (lolthHp > 0 && alive.some(p => p.is_alive)) {
    await say(client, channel, `— Round ${round} —`)
    await delay(1500)

    for (const player of alive.filter(p => p.is_alive)) {
      const rawDmg = roll(14, 30)
      lolthHp = Math.max(0, lolthHp - rawDmg)
      await say(client, channel,
        `${player.username} strikes Lolth for ${rawDmg} damage! (${lolthHp} HP remaining)`
      )
      await delay(1200)
      if (lolthHp <= 0) break
    }

    // Web of Fate — fires when HP drops below 300 in phase 1
    if (!webOfFateFired && lolthHp <= Math.ceil(300 * diffMod.hpMod) && !inPhase2) {
      webOfFateFired = true
      await say(client, channel,
        `💀 "The web was always here. You have been walking it since Hommlet." ` +
        `WEB OF FATE — every living participant takes 55 damage. ` +
        `The threads of the web pull tight around everyone present.`
      )
      await delay(2500)
      for (const p of alive.filter(p => p.is_alive)) {
        p.hp = Math.max(0, p.hp - 55)
        if (p.hp <= 0) {
          p.is_alive = false
          await handleDeath(supabase, campaignId, p, 5)
          await say(client, channel, `${p.username} is caught in the web. Permadeath.`)
        } else {
          await say(client, channel, `${p.username} — ${p.hp} HP remaining.`)
        }
      }
      await delay(2000)
    }

    if (lolthHp <= 0) break
    if (!alive.some(p => p.is_alive)) break

    // Phase transition at 225 HP
    if (lolthHp <= Math.ceil(225 * diffMod.hpMod) && !inPhase2) {
      inPhase2 = true
      await say(client, channel,
        `Lolth laughs. "Adequate. You are adequate." ` +
        `She transforms — the humanoid form falls away. ` +
        `⚡ PHASE 2 — The Demon Queen in her true form.`
      )
      await delay(3000)
    }

    // Lolth attacks
    const monsterRoll = d20()
    const monsterHit = monsterRoll + 18 > 12
    if (monsterHit) {
      const dmg = roll(dmgMin, dmgMax)
      const target = pickRandom(alive.filter(p => p.is_alive))
      if (target) {
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel,
          `Lolth strikes ${target.username} for ${dmg} damage! (${target.hp} HP remaining)`
        )
        await delay(1200)

        // Phase 2 bonus attack — spider swarm
        if (inPhase2 && Math.floor(Math.random() * 100) + 1 <= 45) {
          const swarmDmg = roll(15, 25)
          const swarmTarget = pickRandom(alive.filter(p => p.is_alive))
          if (swarmTarget) {
            swarmTarget.hp = Math.max(0, swarmTarget.hp - swarmDmg)
            await say(client, channel,
              `The Demonweb itself attacks — ${swarmTarget.username} takes ${swarmDmg} additional damage! ` +
              `(${swarmTarget.hp} HP remaining)`
            )
            if (swarmTarget.hp <= 0) {
              swarmTarget.is_alive = false
              await handleDeath(supabase, campaignId, swarmTarget, 5)
              await say(client, channel, `${swarmTarget.username} has fallen! Permadeath.`)
            }
          }
        }

        if (target.hp <= 0) {
          target.is_alive = false
          await handleDeath(supabase, campaignId, target, 5)
          await say(client, channel, `${target.username} has fallen! Permadeath — they are out of the campaign.`)
        }
      }
    } else {
      await say(client, channel,
        `Lolth''s attack passes through a gap in reality. She seems more amused than concerned.`
      )
    }

    // Web resurrection — fires once in phase 2 when HP reaches 0
    if (inPhase2 && lolthHp <= 0 && !phaseFired) {
      phaseFired = true
      lolthHp = Math.ceil(225 * diffMod.hpMod)
      await say(client, channel,
        `THE WEB HOLDS HER. Lolth falls — and the Demonweb catches her. ` +
        `"Did you think it would be that simple?" ` +
        `The web feeds her. She rises. ` +
        `"One more time. Show me you deserve to know what I know." ` +
        `Lolth resets to 225 HP. The Demonweb is her domain.`
      )
      await delay(4000)
    }

    round++
    if (round > 15) {
      lolthHp = 0
      await say(client, channel,
        `Lolth staggers. "Adequate," she says again. This time she means something different by it. ` +
        `"You will do." She falls.`
      )
    }
    await delay(1500)
  }

  return {
    survivors: alive.filter(p => p.is_alive),
    defeated: alive.filter(p => !p.is_alive),
  }
}

// ------------------------------------------------------------
// Main campaign runner
// ------------------------------------------------------------

async function runGreyhawkCampaign(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  campaignData: NamedCampaign,
  stages: NamedCampaignStage[],
  outcomes: NamedCampaignOutcome[],
  participants: Participant[]
) {
  const diffMod = await getChannelDifficultyMod(supabase, channel)
  await supabase
    .from('campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', campaignId)

  for (const stage of stages.sort((a, b) => a.stage - b.stage)) {
    const alive = participants.filter(p => p.is_alive)
    if (alive.length === 0) break

    if (stage.stage > 1) {
      await delay(3000)
      await restShrine(client, supabase, channel, campaignId, stage, participants)
      await delay(2000)
      if (stage.stage === campaignData.yvannis_stage) {
        await summonYvannis(client, supabase, channel, campaignId, stage.stage, participants)
        await delay(1500)
      }
    }

    await supabase.from('campaigns').update({ stage: stage.stage }).eq('id', campaignId)

    let result: { survivors: Participant[]; defeated: Participant[] }

    if (campaignData.slug === 'queen-of-the-spiders' && stage.stage === 5) {
      result = await runLolthFight(client, supabase, channel, campaignId, participants, diffMod)
    } else {
      result = await runStage(client, supabase, channel, campaignId, stage, participants, diffMod)
    }

    for (const p of result.survivors) {
      p.stage_reached = stage.stage
      await supabase
        .from('campaign_participants')
        .update({ hp: p.hp, stage_reached: stage.stage })
        .eq('campaign_id', campaignId)
        .eq('username', p.username)
    }

    if (result.survivors.length === 0) {
      await say(client, channel,
        `All adventurers have fallen in ${campaignData.name}. The daily cooldown is spent.`
      )
      await supabase
        .from('campaigns')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', campaignId)
      return
    }

    await say(client, channel,
      `Stage ${stage.stage} — ${stage.stage_name} — cleared! ` +
      `Survivors: ${result.survivors.map(p => p.username).join(', ')}`
    )
    await delay(2000)
  }

  const survivors = participants.filter(p => p.is_alive)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `The final chamber stands before you. The moment of decision has arrived.`)
  await delay(3000)

  const chosenOutcome = await runEndingVote(client, channel, survivors, outcomes)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `${survivors.map(p => p.username).join(', ')} chose: ${chosenOutcome.outcome_label}`)
  await delay(1500)
  await say(client, channel, chosenOutcome.flavor_text)
  await delay(3000)

  await writeConsequences(supabase, campaignId, participants, chosenOutcome, campaignData.slug)

  // Outcome announcements
  if (chosenOutcome.outcome_key === 'deliver_lareth') {
    await say(client, channel,
      `Lareth is taken alive. The constable sends word to Verbobonc. ` +
      `A representative of Mordenkainen arrives the next day, asks three questions, and leaves. ` +
      `The village is quieter now. The moathouse is sealed. ` +
      `The thread is not cut — it is just shorter.`
    )
  } else if (chosenOutcome.outcome_key === 'execute_lareth') {
    await say(client, channel,
      `Lareth dies in the dungeon. Whatever he knew dies with him. ` +
      `Hommlet celebrates in the cautious way of people who are not yet sure the fear is over. ` +
      `A traveller arrives three days later asking pointed questions, sees the party, and leaves quickly. ` +
      `His cloak bore a closed fist.`
    )
  } else if (chosenOutcome.outcome_key === 'let_lareth_escape') {
    await say(client, channel,
      `Lareth walks into the marsh and is gone. ` +
      `The village never learns this. The reward is the same. ` +
      `Somewhere in the Flanaess, Lareth is having a conversation about what happened in Hommlet. ` +
      `The conversation is not going well for the party.`
    )
  } else if (chosenOutcome.outcome_key === 'failure') {
    await say(client, channel,
      `The moathouse remains active. The cult regroups. ` +
      `The new adventurers hired three weeks later find a dungeon cleaned out and resealed from the inside. ` +
      `The thread leads east, toward something much larger.`
    )
  } else if (chosenOutcome.outcome_key === 'seal_the_temple') {
    await say(client, channel,
      `The seals are restored. Zuggtmoy remains imprisoned with the Eye. ` +
      `The Temple is sealed from the outside. The party emerges into daylight that feels different. ` +
      `The tree line east of Hommlet, someone will notice years later, has begun growing toward the Temple again. ` +
      `Very slowly. It is probably nothing.`
    )
  } else if (chosenOutcome.outcome_key === 'destroy_the_eye') {
    await say(client, channel,
      `The Elder Elemental Eye is destroyed. The Temple does not take it well. ` +
      `Zuggtmoy, freed, is somewhere in the Flanaess. She is not grateful. ` +
      `The closed fist symbol is less present in the weeks that follow. ` +
      `Something that was watching has stopped. Something else has started.`
    )
  } else if (chosenOutcome.outcome_key === 'bargain_with_zuggtmoy') {
    await say(client, channel,
      `Zuggtmoy is freed. She told the party the name of the Master. ` +
      `She told them what the Master wants. She told them this is the early part of a plan ` +
      `that has been running longer than any of them have been alive. ` +
      `She seemed to find their expressions satisfying.`
    )
  } else if (chosenOutcome.outcome_key === 'failure') {
    await say(client, channel,
      `The Temple continues its work. The seals weaken on schedule. ` +
      `Mordenkainen reads the constable''s report, sets it down, ` +
      `and says something to his associates that is not recorded.`
    )
  } else if (chosenOutcome.outcome_key === 'destroy_the_slave_lords') {
    await say(client, channel,
      `The council is broken. Stalman Klim is dead. The organization collapses. ` +
      `The people in the stockade are freed. The ledger goes to Greyhawk City. ` +
      `Mordenkainen sends a note. The note says: well done, and also: ` +
      `you should know that what you found in the aerie is the third instance of that particular arrangement.`
    )
  } else if (chosenOutcome.outcome_key === 'expose_the_network') {
    await say(client, channel,
      `The ledger and records go to Greyhawk City. The name is made public. ` +
      `The political disruption is significant. Stalman Klim escapes with part of the council. ` +
      `One of Mordenkainen''s associates arrives and asks very specific questions about what the party found in the aerie.`
    )
  } else if (chosenOutcome.outcome_key === 'take_the_treasure') {
    await say(client, channel,
      `The treasury is considerable. The party takes it and goes. ` +
      `Stalman Klim survives. The organization begins rebuilding. ` +
      `The party is richer than they have ever been and is now on a list. ` +
      `Mordenkainen is annoyed, though he has the grace not to say so directly.`
    )
  } else if (chosenOutcome.outcome_key === 'failure') {
    await say(client, channel,
      `Stalman Klim survives. The council replaces its losses within the month. ` +
      `The ledger goes back into the filing system. ` +
      `The closed fist becomes more common in the weeks that follow.`
    )
  } else if (chosenOutcome.outcome_key === 'destroy_eclavdra') {
    await say(client, channel,
      `Eclavdra dies in the Vault. The giant raids stop within weeks. ` +
      `The routes she was mapping are not finished. ` +
      `House Eilservs has a grudge. Lolth has the party''s attention. ` +
      `Mordenkainen''s note says: the Underdark is deeper than you have gone.`
    )
  } else if (chosenOutcome.outcome_key === 'expose_the_drow') {
    await say(client, channel,
      `The evidence goes to Greyhawk City. Three nations reconsider their positions. ` +
      `Eclavdra escapes. The routes are incomplete but not useless. ` +
      `Mordenkainen''s associate says the next part is going to be considerably more complicated.`
    )
  } else if (chosenOutcome.outcome_key === 'follow_the_thread') {
    await say(client, channel,
      `The party follows Eclavdra into the Underdark. The Vault is a waypoint. ` +
      `The giant raids stop — the giants have completed their purpose. ` +
      `The routes are finished. Whatever they were for is now possible. ` +
      `Mordenkainen''s note says: I was hoping you would do this. I was also hoping you would not have to.`
    )
  } else if (chosenOutcome.outcome_key === 'failure') {
    await say(client, channel,
      `The moathouse remains active. The cult regroups. ` +
      `The new adventurers hired three weeks later find a dungeon cleaned out and resealed from the inside. ` +
      `The thread leads east, toward something much larger.`
    )
  } else if (chosenOutcome.outcome_key === 'temple_failure') {
    await say(client, channel,
      `The Temple continues its work. The seals weaken on schedule. ` +
      `Mordenkainen reads the constable's report, sets it down, ` +
      `and says something to his associates that is not recorded.`
    )
  } else if (chosenOutcome.outcome_key === 'slavers_failure') {
    await say(client, channel,
      `Stalman Klim survives. The council replaces its losses within the month. ` +
      `The ledger goes back into the filing system. ` +
      `The closed fist becomes more common in the weeks that follow.`
    )
  } else if (chosenOutcome.outcome_key === 'giants_failure') {
    await say(client, channel,
      `Eclavdra escapes. The routes are finished on schedule. ` +
      `The raids resume with a different character. ` +
      `She sends the brooch back. It is not a compliment.`
    )
  } else if (chosenOutcome.outcome_key === 'spiders_failure') {
    await say(client, channel,
      `Lolth's plan matures. The surface world does not understand what is happening for months. ` +
      `Mordenkainen understands immediately but cannot act alone. ` +
      `The situation is the message. Lolth sends nothing else.`
    )
  }

  const { titleEarned, artifactName, artWinner } = await writeRewards(
    supabase, campaignId, participants, chosenOutcome, campaignData.slug, true
  )

  if (campaignData.slug === 'queen-of-the-spiders') {
    await say(client, channel,
      `🏆 The Greyhawk Arc is complete. ` +
      `All five campaigns — from the inn at Hommlet to the Demonweb Pits. ` +
      `Title awarded to all survivors: [Who Walked the Greyhawk Arc]`
    )
  }

  await supabase
    .from('campaigns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', campaignId)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `${campaignData.name} COMPLETE! ${survivors.map(p => p.username).join(' & ')} emerge from the moathouse.`
  )
  if (titleEarned) await say(client, channel, `Title earned: [${titleEarned}] — awarded to qualifying survivors!`)
  if (artifactName && artWinner) await say(client, channel, `Artifact: ${artifactName} — claimed by ${artWinner.username}!`)
  await say(client, channel, `Full clear bonus applied. Check !status for updated XP and gold.`)
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

const greyhawkLock = new Map<string, boolean>()
const greyhawkPendingJoins = new Map<string, Set<string>>()

export async function handleGreyhawkCampaignCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  slug: string
) {
  if (!GREYHAWK_SLUGS.includes(slug)) return

  if (greyhawkLock.get(channel)) {
    await say(client, channel, `@${username} A campaign is already being set up. Hang tight!`)
    return
  }

  const { data: existing } = await supabase
    .from('campaign_today')
    .select('*')
    .eq('channel', channel)
    .limit(1)
    .single()

  if (existing) {
    await say(client, channel,
      `@${username} The channel has already run a campaign today. Try again tomorrow.`
    )
    return
  }

  const { data: initiatorChar } = await supabase
    .from('characters')
    .select('hp, is_dead')
    .eq('twitch_username', username)
    .single()

  if (!initiatorChar) {
    await say(client, channel, `@${username} You need a character to run a campaign. Use !join to create one.`)
    return
  }

  if (initiatorChar.hp <= 0 || initiatorChar.is_dead) {
    await say(client, channel, `@${username} Your character is dead. Use !join to start over before running a campaign.`)
    return
  }

  await ensureClearRecord(supabase, username)

  const unlocked = await checkGreyhawkUnlock(supabase, username, slug)
  if (!unlocked) {
    const prerequisite = GREYHAWK_PREREQUISITES[slug]
    if (prerequisite) {
      await say(client, channel,
        `@${username} — You must complete ${prerequisite.replace(/-/g, ' ')} before attempting this campaign.`
      )
    } else {
      await say(client, channel,
        `@${username} — You need 3 standard campaign clears to access The Village of Hommlet. Use !campaign to run the standard gauntlet.`
      )
    }
    return
  }

  const { data: campaignData } = await supabase
    .from('named_campaigns')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!campaignData) {
    await say(client, channel, `@${username} Campaign not found. Contact the dungeon master.`)
    return
  }

  greyhawkLock.set(channel, true)

  try {
    const { data: stagesData } = await supabase
      .from('named_campaign_stages')
      .select('*')
      .eq('campaign_slug', slug)
      .order('stage', { ascending: true })

    const { data: outcomesData } = await supabase
      .from('named_campaign_outcomes')
      .select('*')
      .eq('campaign_slug', slug)

    const stages = (stagesData ?? []) as NamedCampaignStage[]
    const outcomes = (outcomesData ?? []) as NamedCampaignOutcome[]

    await say(client, channel,
      `@${username} calls for a campaign: ${campaignData.name} (${campaignData.setting})! ` +
      `Type !solo to run alone or !joincamp to form a party (60 seconds to gather).`
    )

    const mode = await waitForModeChoice(client, channel, username, MODE_CHOICE_MS)
    const bossStage = stages.find(s => s.stage === 5)
    const bossName = bossStage?.enemy_name ?? 'Unknown'

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        channel,
        initiated_by: username,
        mode,
        status: mode === 'party' ? 'joining' : 'active',
        stage: 1,
        boss_name: bossName,
        boss_special: bossStage?.special_name ?? '',
        started_at: mode === 'solo' ? new Date().toISOString() : null,
        yvannis_stage: rollYvannisStage(),
      })
      .select()
      .single()

    if (error || !campaign) throw error

    await supabase
      .from('campaign_participants')
      .insert({ campaign_id: campaign.id, username, hp: 100, max_hp: 100 })

    if (mode === 'solo') {
      await say(client, channel,
        `${username} enters ${campaignData.setting} alone. ${bossName} waits at the end.`
      )
    } else {
      const joiners = new Set<string>([username])
      greyhawkPendingJoins.set(channel, joiners)

      await say(client, channel,
        `Party forming for ${campaignData.name}! ` +
        `Type !joincamp to join. Window closes in 60 seconds. ${username} is already in.`
      )

      await delay(JOIN_WINDOW_MS)
      greyhawkPendingJoins.delete(channel)

      for (const joiner of joiners) {
        if (joiner !== username) {
          await supabase
            .from('campaign_participants')
            .insert({ campaign_id: campaign.id, username: joiner, hp: 100, max_hp: 100 })
        }
      }

      await say(client, channel,
        `The party is set: ${[...joiners].join(', ')}. Entering ${campaignData.setting}. ${bossName} awaits.`
      )
    }

    await delay(2000)

    const { data: participantsData } = await supabase
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', campaign.id)

    const participants = (participantsData ?? []) as Participant[]

    await runGreyhawkCampaign(
      client, supabase, channel, campaign.id,
      campaignData as NamedCampaign, stages, outcomes, participants
    )

  } finally {
    greyhawkLock.delete(channel)
  }
}

export async function handleGreyhawkJoinCamp(
  client: Client,
  channel: string,
  username: string
): Promise<boolean> {
  const joiners = greyhawkPendingJoins.get(channel)
  if (!joiners) return false

  const { data: joinerChar } = await supabase
    .from('characters')
    .select('hp, is_dead')
    .eq('twitch_username', username)
    .single()

  if (!joinerChar || joinerChar.hp <= 0 || joinerChar.is_dead === true) {
    await say(client, channel,
      `@${username} You need a living character to join a campaign. Use !join to create one.`
    )
    return false
  }

  if (joiners.has(username)) {
    await say(client, channel, `@${username} You're already in the party!`)
    return true
  }

  joiners.add(username)
  await say(client, channel, `${username} joins the party! (${joiners.size} adventurers so far)`)
  return true
}

function waitForModeChoice(
  client: Client,
  channel: string,
  username: string,
  windowMs: number
): Promise<'solo' | 'party'> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.removeListener('message', handler)
      resolve('solo')
    }, windowMs)

    const handler = (_chan: string, tags: Record<string, unknown>, message: string) => {
      if (tags['display-name']?.toString().toLowerCase() !== username.toLowerCase()) return
      const msg = message.trim().toLowerCase()
      if (msg === '!solo' || msg === '!joincamp') {
        clearTimeout(timeout)
        client.removeListener('message', handler)
        resolve(msg === '!solo' ? 'solo' : 'party')
      }
    }

    client.on('message', handler)
  })
}