// ============================================================
// ZulkirBot: Named Campaign Handler
// ============================================================
// Handles named campaign lifecycle:
//   unlock check → initiation → solo/party prompt →
//   join window → stage loop → rest shrine → boss fight →
//   ending vote → consequence writes → reward distribution
//
// Campaigns housed in this file:
//   - The Crystal of Rafiel (Mystara)
//   - The Seal of the Incomparable (Al-Qadim)
//   - The Dying Star (Spelljammer)
//   - Embers of the Second War (Planescape)
//   - The Shattered Memory of Darkon (Ravenloft)
//   - The Ritual of Nibenay (Dark Sun)
//   - The Whispering Flame (Eberron)
//   - The Black Emperor (Dragonlance)
//   - The Smiling Tyrant (Greyhawk)
//   - The Tyrant Reforged (Forgotten Realms / Zhentil Keep)
//   - The Lich King of Thay (Forgotten Realms / Thay)
// ============================================================

import { Client } from 'tmi.js'
import { supabase } from './../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js'
import { getDisplayName } from '../lib/displayName'
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
  character_name: string | null  // ← add this
  hp: number
  max_hp: number
  is_alive: boolean
  stage_reached: number
}

interface ElementalSpawn {
  name: string
  hp: number
  damage_min: number
  damage_max: number
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

export const ELEMENTAL_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Rogue Fire Elemental', hp: 60, damage_min: 10, damage_max: 18 },
  { name: 'Rogue Earth Elemental', hp: 80, damage_min: 8, damage_max: 15 },
  { name: 'Rogue Air Elemental', hp: 50, damage_min: 12, damage_max: 20 },
  { name: 'Rogue Water Elemental', hp: 70, damage_min: 9, damage_max: 16 },
]

export const SPIRIT_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Unbound River Spirit', hp: 65, damage_min: 10, damage_max: 17 },
  { name: 'Rogue Wind Spirit', hp: 50, damage_min: 12, damage_max: 20 },
  { name: 'Wayward Mountain Spirit', hp: 80, damage_min: 8, damage_max: 15 },
  { name: 'Lost Flame Spirit', hp: 60, damage_min: 11, damage_max: 18 },
]

export const MIST_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Mist Wraith', hp: 55, damage_min: 10, damage_max: 18 },
  { name: 'Memory Shade', hp: 60, damage_min: 11, damage_max: 17 },
  { name: 'Darkon Phantom', hp: 50, damage_min: 12, damage_max: 19 },
  { name: 'Lost Soul of Darkon', hp: 65, damage_min: 9, damage_max: 16 },
]

export const ATHAS_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Nibenay Templar Enforcer', hp: 65, damage_min: 11, damage_max: 18 },
  { name: 'Defiler Shade', hp: 55, damage_min: 12, damage_max: 19 },
  { name: 'Psionic Remnant', hp: 60, damage_min: 10, damage_max: 17 },
  { name: 'Ash Wraith of Athas', hp: 70, damage_min: 9, damage_max: 16 },
]

export const WHISPER_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Cinder Voice Shade', hp: 60, damage_min: 11, damage_max: 18 },
  { name: 'Thrall of the Whispering Flame', hp: 65, damage_min: 10, damage_max: 17 },
  { name: 'Paranoia Wraith', hp: 55, damage_min: 12, damage_max: 19 },
  { name: 'False Light Specter', hp: 70, damage_min: 9, damage_max: 16 },
]

export const DRAGONLANCE_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Dragonarmy Remnant', hp: 65, damage_min: 11, damage_max: 18 },
  { name: 'Enforcer of the Black Throne', hp: 70, damage_min: 10, damage_max: 17 },
  { name: 'War Shade of Krynn', hp: 60, damage_min: 12, damage_max: 19 },
  { name: 'Chain-Bound Soldier', hp: 55, damage_min: 11, damage_max: 18 },
]

// Greyhawk spawn pool (web_remnant consequence)
export const GREYHAWK_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Iuz Cult Operative', hp: 65, damage_min: 11, damage_max: 18 },
  { name: 'Collapse Engine Agent', hp: 60, damage_min: 12, damage_max: 19 },
  { name: 'Fiend-Touched Agitator', hp: 70, damage_min: 10, damage_max: 17 },
  { name: 'Network Enforcer', hp: 55, damage_min: 11, damage_max: 18 },
]

// Forgotten Realms spawn pool (banes_ledger consequence)
export const FORGOTTEN_REALMS_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Zhentarim Enforcer', hp: 65, damage_min: 11, damage_max: 18 },
  { name: 'Banite Doctrine Agent', hp: 60, damage_min: 12, damage_max: 19 },
  { name: 'Network Node Operative', hp: 70, damage_min: 10, damage_max: 17 },
  { name: 'Mark-Bound Soldier', hp: 55, damage_min: 11, damage_max: 18 },
]

// Thay spawn pool (lich_servant consequence)
export const THAY_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Thayan Knight', hp: 70, damage_min: 13, damage_max: 20 },
  { name: 'Red Wizard Acolyte', hp: 65, damage_min: 14, damage_max: 21 },
  { name: 'Eltabbar Undead Soldier', hp: 75, damage_min: 12, damage_max: 19 },
  { name: 'Phylactery Shard Construct', hp: 60, damage_min: 15, damage_max: 22 },
]

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

async function checkUnlock(
  supabase: SupabaseClient,
  username: string,
  requiredClears: number
): Promise<boolean> {
  const { data } = await supabase
    .from('player_campaign_clears')
    .select('standard_clears, named_unlocked')
    .eq('username', username)
    .single()

  if (!data) return false
  return data.standard_clears >= requiredClears
}

async function ensureClearRecord(supabase: SupabaseClient, username: string) {
  await supabase
    .from('player_campaign_clears')
    .upsert({ username }, { onConflict: 'username', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Ultimate Unlock check
// ------------------------------------------------------------

async function checkUltimateUnlock(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { data } = await supabase
    .from('player_campaign_clears')
    .select('standard_clears, named_clears')
    .eq('username', username)
    .single()

  if (!data) return false
  return data.standard_clears >= 10 && (data.named_clears ?? 0) >= 10
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
// Fetch character names after participants are loaded
// ------------------------------------------------------------

async function enrichParticipantsWithNames(
  supabase: SupabaseClient,
  participants: Participant[]
): Promise<void> {
  await Promise.all(
    participants.map(async p => {
      const { data: char } = await supabase
        .from('characters')
        .select('character_name')
        .eq('twitch_username', p.username)
        .single()
      p.character_name = char?.character_name ?? null
    })
  )
}

// ------------------------------------------------------------
// Consequence checks
// ------------------------------------------------------------

export async function checkConsequences(
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

    if (flag.flag_type === 'shadow_marked' && flag.trigger_ready) {
      await say(client, channel,
        `@${username} — A figure dressed in Shadow Elf grey steps from the dark. ` +
        `No words. No warning. The blade finds its mark before you can react. ` +
        `${username} has been killed by an assassin of the Shadow Elf god. Their story ends here.`
      )
      await supabase.from('characters').update({ hp: 0, is_dead: true }).eq('twitch_username', username)
      await supabase.from('player_consequence_flags').update({ is_active: false, resolved_at: new Date().toISOString() }).eq('id', flag.id)
      return
    }

    if (flag.flag_type === 'crystal_control' && flag.trigger_ready && !flag.madness_triggered) {
      if (Math.random() <= 0.40) await triggerMadness(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'seal_bound' && flag.trigger_ready && !flag.seal_triggered) {
      const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', username).single()
      if (char && char.gold > 0) {
        const drain = Math.floor(char.gold * 0.30)
        await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username)
        await say(client, channel, `@${username} — The Seal tightens its hold. ${drain}gp slips into nothing.`)
        await supabase.from('player_consequence_flags').update({ seal_triggered: true }).eq('id', flag.id)
      }
    }

    if (flag.flag_type === 'genie_debt' && flag.trigger_ready && !flag.debt_triggered) {
      const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
      if (char) {
        const goldCost = Math.floor(char.gold * 0.25)
        const hpCost = Math.floor(char.max_hp * 0.20)
        if (char.gold >= goldCost && goldCost > 0) {
          await supabase.from('characters').update({ gold: char.gold - goldCost }).eq('twitch_username', username)
          await say(client, channel, `@${username} — "The genie courts remember the debt." ${goldCost}gp lifts from your purse.`)
        } else {
          const newHp = Math.max(1, char.hp - hpCost)
          await supabase.from('characters').update({ hp: newHp, max_hp: char.max_hp - hpCost }).eq('twitch_username', username)
          await say(client, channel, `@${username} — "The genie courts remember the debt. Gold you do not have." Your max HP is reduced by ${hpCost}.`)
        }
        await supabase.from('player_consequence_flags').update({ debt_triggered: true }).eq('id', flag.id)
      }
    }

    if (flag.flag_type === 'mandate_restored' && flag.trigger_ready && !flag.mandate_triggered) await triggerCelestialAudit(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'mandate_reforged' && flag.trigger_ready && !flag.mandate_triggered) await triggerMandateReforged(client, supabase, channel, username, flag.id, flag.mandate_boon ?? true)
    if (flag.flag_type === 'celestial_debt' && flag.trigger_ready && !flag.celestial_triggered) await triggerCelestialDebt(client, supabase, channel, username, flag.id)

    // ── Ashes of Xaryxis ─────────────────────────────────────
    if (flag.flag_type === 'starfire_marked' && flag.trigger_ready && !flag.starfire_triggered) await triggerStarfireMark(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'cycle_bound' && flag.trigger_ready && !flag.cycle_triggered) await triggerCycleBound(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'engine_forged' && flag.trigger_ready && !flag.engine_triggered) await triggerEngineForged(client, supabase, channel, username, flag.id)

    // ── Embers of the Second War ──────────────────────────────
    if (flag.flag_type === 'infernal_marked' && flag.trigger_ready && !flag.infernal_triggered) await triggerInfernalMarked(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'abyssal_touched' && flag.trigger_ready && !flag.abyssal_triggered) await triggerAbyssalTouched(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'planar_witness' && flag.trigger_ready && !flag.witness_triggered) await triggerPlanarWitness(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'gem_bound' && flag.trigger_ready && !flag.gem_triggered) await triggerGemBound(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'iron_manacles_blight' && flag.trigger_ready && !flag.blight_triggered) await triggerManaclesBlight(client, supabase, channel, username, flag.id)

    // ── Shattered Memory of Darkon ────────────────────────────
    if (flag.flag_type === 'domain_bound' && flag.trigger_ready && !flag.domain_triggered) await triggerDomainBound(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'curse_shattered' && flag.trigger_ready && !flag.shatter_triggered) await triggerCurseShattered(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'mist_marked' && flag.trigger_ready && !flag.mist_triggered) await triggerMistMarked(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'darklord_echo' && flag.trigger_ready && !flag.darklord_triggered) await triggerDarklordEcho(client, supabase, channel, username, flag.id)

    // ── Ashes of the Shadow King ──────────────────────────────
    if (flag.flag_type === 'ashen_debt' && flag.trigger_ready && !flag.ashen_triggered) await triggerAshenDebt(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'city_breaker' && flag.trigger_ready && !flag.city_breaker_triggered) await triggerCityBreaker(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'tenuous_balance' && flag.trigger_ready && !flag.balance_triggered) await triggerTenuousBalance(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'athasian_lord' && flag.trigger_ready && !flag.athasian_triggered) await triggerAthasianLord(client, supabase, channel, username, flag.id)

    // ── Ashes Beneath the Flame ───────────────────────────────
    if (flag.flag_type === 'flame_scarred' && flag.trigger_ready && !flag.flame_triggered) await triggerFlameScarred(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'whisper_bound' && flag.trigger_ready && !flag.whisper_triggered) await triggerWhisperBound(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'bel_shalors_eye' && flag.trigger_ready && !flag.eye_triggered) await triggerBelShalorsEye(client, supabase, channel, username, flag.id)

    // ── Ashes of the Black Emperor ────────────────────────────
    if (flag.flag_type === 'krynnish_burden' && flag.trigger_ready && !flag.burden_triggered) await triggerKrynnishBurden(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'war_unending' && flag.trigger_ready && !flag.war_triggered) await triggerWarUnending(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'tyrant_marked' && flag.trigger_ready && !flag.tyrant_triggered) await triggerTyrantMarked(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'chains_of_order' && flag.trigger_ready && !flag.chains_triggered) await triggerChainsOfOrder(client, supabase, channel, username, flag.id)

    // ── The Smiling Tyrant ────────────────────────────────────
    if (flag.flag_type === 'truth_bearer' && flag.trigger_ready && !flag.truth_triggered) await triggerTruthBearer(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'web_remnant' && flag.trigger_ready && !flag.web_triggered) await triggerWebRemnant(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'smiling_tyrant' && flag.trigger_ready && !flag.smiling_triggered) await triggerSmilingTyrant(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'old_ones_mark' && flag.trigger_ready && !flag.old_ones_triggered) await triggerOldOnesMark(client, supabase, channel, username, flag.id)

    // ── The Tyrant Reforged ───────────────────────────────────
    if (flag.flag_type === 'shattered_order' && flag.trigger_ready && !flag.order_triggered) await triggerShatteredOrder(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'banes_ledger' && flag.trigger_ready && !flag.ledger_triggered) await triggerBanesLedger(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'tyrants_mark' && flag.trigger_ready && !flag.tyrants_triggered) await triggerTyrantsMark(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'hand_of_bane' && flag.trigger_ready && !flag.bane_triggered) await triggerHandOfBane(client, supabase, channel, username, flag.id)

    // ── The Lich King of Thay ─────────────────────────────────
    if (flag.flag_type === 'thayan_survivor' && flag.trigger_ready && !flag.thayan_triggered) await triggerThayanSurvivor(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'lich_servant' && flag.trigger_ready && !flag.lich_triggered) await triggerLichServant(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'uneasy_pact' && flag.trigger_ready && !flag.pact_triggered) await triggerUneasyPact(client, supabase, channel, username, flag.id)
    if (flag.flag_type === 'zulkirjax_triumphant' && flag.trigger_ready && !flag.triumphant_triggered) await triggerZulkirjaxTriumphant(client, supabase, channel, username, flag.id)
  }
}

// ------------------------------------------------------------
// Spawn checks
// ------------------------------------------------------------

export async function checkConvergenceSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'convergence_marked').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkSpiritSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'mandate_shattered').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.15
}

export async function checkMistSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'mist_marked').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkAthasSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'city_breaker').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkWhisperSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'whisper_bound').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkDragonlanceSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'war_unending').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkGreyhawkSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'web_remnant').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkForgottenRealmsSpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'banes_ledger').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkThaySpawn(supabase: SupabaseClient, username: string): Promise<boolean> {
  const { data: flag } = await supabase.from('player_consequence_flags').select('id').eq('username', username).eq('flag_type', 'lich_servant').eq('is_active', true).single()
  if (!flag) return false
  return Math.random() < 0.20
}

// ------------------------------------------------------------
// Madness trigger (Mystara / crystal_control)
// ------------------------------------------------------------

async function triggerMadness(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const madnessRoll = roll(1, 6)
  const { data: outcome } = await supabase.from('madness_outcomes').select('*').eq('roll', madnessRoll).single()
  if (!outcome) return
  const description = outcome.description.replace('{username}', `@${username}`)
  await say(client, channel, `THE CRYSTAL STIRS — @${username}'s mind fractures! ${description}`)
  switch (outcome.effect_type) {
    case 'destroy_item': {
      const { data: items } = await supabase.from('inventory').select('id, item_name').eq('twitch_username', username).limit(20)
      if (items && items.length > 0) {
        const target = pickRandom(items)
        await supabase.from('inventory').delete().eq('id', target.id)
        await say(client, channel, `${target.item_name} crumbles to dust in @${username}'s hands.`)
      }
      break
    }
    case 'drop_gold': {
      const { data: char } = await supabase.from('characters').select('gold').eq('twitch_username', username).single()
      if (char && char.gold > 0) {
        await supabase.from('characters').update({ gold: 0 }).eq('twitch_username', username)
        await say(client, channel, `@${username} has lost all ${char.gold}gp to the madness.`)
      }
      break
    }
    case 'flee':
      await say(client, channel, `@${username} flees into the dark. They do not return.`)
      break
  }
  await supabase.from('player_consequence_flags').update({ madness_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Celestial audit (Al-Qadim / mandate_restored)
// ------------------------------------------------------------

export async function triggerCelestialAudit(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp, kill_count').eq('twitch_username', username).single()
  if (!char) return
  if ((char.kill_count ?? 0) < 50) { await supabase.from('player_consequence_flags').update({ mandate_triggered: true }).eq('id', flagId); return }
  const baseFine = Math.floor(char.gold * 0.35)
  const harshFine = Math.floor(char.gold * 0.50)
  const lenientFine = Math.floor(char.gold * 0.40)
  const hpCost = Math.floor(char.max_hp * 0.20)
  await client.say(channel, `@${username} — "The Court has reviewed your record. ${char.kill_count} registered actions of terminal force. The balance tax is assessed at ${baseFine}gp. Type !pay to settle or !dispute to contest. You have 60 seconds."`)
  const response = await waitForAuditResponse(client, channel, username, 60_000)
  if (response === 'pay') {
    if (char.gold >= baseFine && baseFine > 0) {
      await supabase.from('characters').update({ gold: char.gold - baseFine }).eq('twitch_username', username)
      await client.say(channel, `@${username} — "Payment received." ${baseFine}gp deducted.`)
    } else {
      const newHp = Math.max(1, char.hp - hpCost)
      await supabase.from('characters').update({ hp: newHp, max_hp: char.max_hp - hpCost }).eq('twitch_username', username)
      await client.say(channel, `@${username} — "Insufficient funds. The Court accepts an alternative settlement." Your max HP is reduced by ${hpCost}.`)
    }
  } else if (response === 'dispute') {
    if (Math.random() < 0.50) {
      await client.say(channel, `@${username} — "The Court finds merit in the objection. Fine waived — this cycle." Future audits will cost ${lenientFine}gp.`)
      await supabase.from('player_consequence_flags').update({ mandate_triggered: false }).eq('id', flagId)
      return
    } else {
      const actualFine = char.gold >= harshFine ? harshFine : char.gold
      await supabase.from('characters').update({ gold: char.gold - actualFine }).eq('twitch_username', username)
      await client.say(channel, `@${username} — "Objection overruled. Fine increased." ${harshFine}gp deducted.`)
    }
  } else {
    const contemptFine = Math.floor(char.gold * 0.45)
    const actualFine = char.gold >= contemptFine ? contemptFine : char.gold
    await supabase.from('characters').update({ gold: char.gold - actualFine }).eq('twitch_username', username)
    await client.say(channel, `@${username} — "Non-responsive. Contempt assessed." ${contemptFine}gp deducted.`)
  }
  await supabase.from('player_consequence_flags').update({ mandate_triggered: true }).eq('id', flagId)
}

function waitForAuditResponse(client: Client, channel: string, username: string, windowMs: number): Promise<'pay' | 'dispute' | 'none'> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { client.removeListener('message', handler); resolve('none') }, windowMs)
    const handler = (_chan: string, tags: Record<string, unknown>, message: string) => {
      if (tags['display-name']?.toString().toLowerCase() !== username.toLowerCase()) return
      const msg = message.trim().toLowerCase()
      if (msg === '!pay' || msg === '!dispute') { clearTimeout(timeout); client.removeListener('message', handler); resolve(msg === '!pay' ? 'pay' : 'dispute') }
    }
    client.on('message', handler)
  })
}

async function triggerMandateReforged(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string, isBoon: boolean) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  if (isBoon) {
    await supabase.from('characters').update({ max_hp: char.max_hp + 20, hp: char.hp + 20 }).eq('twitch_username', username)
    await client.say(channel, `@${username} — The reforged Mandate stirs. Your max HP is permanently increased by 20.`)
  } else {
    const newHp = Math.max(1, char.hp - 20)
    await supabase.from('characters').update({ max_hp: char.max_hp - 20, hp: newHp }).eq('twitch_username', username)
    await client.say(channel, `@${username} — The reforged Mandate stirs. Your max HP is permanently reduced by 20.`)
  }
  await supabase.from('player_consequence_flags').update({ mandate_triggered: true }).eq('id', flagId)
}

async function triggerCelestialDebt(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.20)
  const hpCost = Math.floor(char.max_hp * 0.20)
  await client.say(channel, `@${username} — "The Court calls in its debt. A tithe of ${tithe}gp is requested." Type !pay to comply or ignore to have it taken automatically.`)
  const response = await waitForAuditResponse(client, channel, username, 60_000)
  if (response === 'pay' && char.gold >= tithe) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await client.say(channel, `@${username} — "Compliance noted." ${tithe}gp tithed. +10% XP on your next 5 campaigns.`)
  } else if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await client.say(channel, `@${username} — The tithe is collected. ${tithe}gp removed.`)
  } else {
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp, max_hp: char.max_hp - hpCost }).eq('twitch_username', username)
    await client.say(channel, `@${username} — "Insufficient funds. The Court accepts vitality in lieu of gold." Your max HP is reduced by ${hpCost}.`)
  }
  await supabase.from('player_consequence_flags').update({ celestial_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// Ashes of Xaryxis
// ------------------------------------------------------------

async function triggerStarfireMark(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.30) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — Xaryxis is still dying. The starfire mark burns cold. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ starfire_triggered: true }).eq('id', flagId)
}

async function triggerCycleBound(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.15)
  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The Engine's ledger updates. Somewhere, a world dims. Your share: ${tithe}gp. (${char.gold - tithe}gp remaining)`)
  } else {
    const hpCost = Math.floor(char.max_hp * 0.10)
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The Engine's ledger updates. No gold. It takes vitality. -${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`)
  }
  await supabase.from('player_consequence_flags').update({ cycle_triggered: true }).eq('id', flagId)
}

async function triggerEngineForged(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const isBoon = Math.random() < 0.50
  if (isBoon) {
    const bonus = roll(10, 25)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The Engine hums. Something feeds back: +${bonus} HP. (${newHp}/${char.max_hp})`)
  } else {
    if (Math.random() < 0.50) {
      const drain = roll(8, 20); const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel, `@${username} — The Engine hums. The architecture is unstable. -${drain} HP. (${newHp}/${char.max_hp})`)
    } else {
      const drain = Math.floor(char.gold * 0.12)
      if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — The Engine hums. Something slips through: -${drain}gp. (${char.gold - drain}gp remaining)`) }
    }
  }
  await supabase.from('player_consequence_flags').update({ engine_triggered: true, engine_boon: isBoon }).eq('id', flagId)
}

const XARYXIS_STAGE_TITLES: Record<number, string> = { 2: 'Witness to the Dying', 3: 'Wildspace Wanderer', 4: 'Touched by the Engine', 5: 'Who Stood Before the Star' }
async function awardXaryxisStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = XARYXIS_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'the-dying-star' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Embers of the Second War
// ------------------------------------------------------------

async function triggerInfernalMarked(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.15)
  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The ledger of Dis updates. ${tithe}gp vanishes. (${char.gold - tithe}gp remaining)`)
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08); const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The ledger of Dis updates. No gold. The Iron City takes something else. -${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`)
  }
  await supabase.from('player_consequence_flags').update({ infernal_triggered: true }).eq('id', flagId)
}

async function triggerAbyssalTouched(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.30) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.10); const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — The Abyss does not forget the one who cracked it open. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ abyssal_triggered: true }).eq('id', flagId)
}

async function triggerPlanarWitness(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  await say(client, channel, `@${username} — The neutral powers of the planes acknowledge what you did. +10% XP this campaign.`)
  await supabase.from('player_consequence_flags').update({ witness_triggered: true }).eq('id', flagId)
}

async function triggerGemBound(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const isBoon = Math.random() < 0.50
  if (isBoon) {
    const bonus = roll(10, 30); const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The Gem pulses. The power is real today. +${bonus} HP. (${newHp}/${char.max_hp})`)
  } else {
    if (Math.random() < 0.50) {
      const drain = roll(10, 25); const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel, `@${username} — The Gem pulses. The pressure costs you. -${drain} HP. (${newHp}/${char.max_hp})`)
    } else {
      const drain = Math.floor(char.gold * 0.15)
      if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — The Gem pulses. Keeping it hidden has costs. -${drain}gp. (${char.gold - drain}gp remaining)`) }
    }
  }
  await supabase.from('player_consequence_flags').update({ gem_triggered: true, gem_boon: isBoon }).eq('id', flagId)
}

async function triggerManaclesBlight(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.25) return
  await say(client, channel, `@${username} — The Iron Manacles tighten. A psionic fire scatters thought. -3 to all attacks this campaign.`)
  await supabase.from('player_consequence_flags').update({ blight_triggered: true, blight_attack_penalty: 3 }).eq('id', flagId)
}

export async function applyIronManaclesBlight(client: Client, supabase: SupabaseClient, channel: string, username: string) {
  await supabase.from('player_consequence_flags').upsert({ username, flag_type: 'iron_manacles_blight', is_active: true, source_campaign_slug: 'embers-of-the-second-war', blight_attack_penalty: 3, blight_triggered: false }, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
  await say(client, channel, `@${username} equips the Iron Manacles of Dis. Power flows — and behind it, pain. -3 to all attacks while equipped. The +5 damage bonus is real. So is the cost.`)
}

export async function removeIronManaclesBlight(supabase: SupabaseClient, username: string) {
  await supabase.from('player_consequence_flags').update({ is_active: false, resolved_at: new Date().toISOString() }).eq('username', username).eq('flag_type', 'iron_manacles_blight').eq('is_active', true)
}

const EMBERS_STAGE_TITLES: Record<number, string> = { 2: 'Walked the Iron Streets', 3: 'Vault Breaker', 4: 'Caught Between Hells', 5: 'Stood in the Infernal Crucible' }
async function awardEmbersStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = EMBERS_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'embers-of-the-second-war' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Shattered Memory of Darkon
// ------------------------------------------------------------

async function triggerDomainBound(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.10); const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — Darkon remembers you. It holds on. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ domain_triggered: true }).eq('id', flagId)
}

async function triggerCurseShattered(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  if (Math.random() < 0.50) {
    const drain = roll(8, 22); const newHp = Math.max(1, char.hp - drain)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The curse broke. Not cleanly. -${drain} HP. (${newHp}/${char.max_hp})`)
  } else {
    const drain = Math.floor(char.gold * 0.12)
    if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — Darkon's collapse took things with it. -${drain}gp. (${char.gold - drain}gp remaining)`) }
  }
  await supabase.from('player_consequence_flags').update({ shatter_triggered: true }).eq('id', flagId)
}

async function triggerMistMarked(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  await say(client, channel, `@${username} — The Mists remember the crack you slipped through. Something from Darkon may find you before this campaign is over.`)
  await supabase.from('player_consequence_flags').update({ mist_triggered: true }).eq('id', flagId)
}

async function triggerDarklordEcho(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const goldDrain = Math.floor(char.gold * 0.20); const hpDrain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - hpDrain); const newGold = Math.max(0, char.gold - goldDrain)
  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)
  await say(client, channel, `@${username} — The domain feeds. -${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`)
  await supabase.from('player_consequence_flags').update({ darklord_triggered: true }).eq('id', flagId)
}

const DARKON_STAGE_TITLES: Record<number, string> = { 2: 'Touched by the Mists', 3: 'Who Knew the Broken King', 4: 'Witness to Unraveling', 5: 'Stood Before Azalin Ascendant' }
async function awardDarkonStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = DARKON_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'shattered-memory-of-darkon' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Ashes of the Shadow King
// ------------------------------------------------------------

async function triggerAshenDebt(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.10); const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — The Crescent Forest is still dying. The ash remembers. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ ashen_triggered: true }).eq('id', flagId)
}

async function triggerCityBreaker(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.15)
  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel, `@${username} — A templar's mark finds you. ${tithe}gp collected. (${char.gold - tithe}gp remaining)`)
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08); const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — A templar's mark finds you. No gold. The mark burns instead. -${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`)
  }
  await supabase.from('player_consequence_flags').update({ city_breaker_triggered: true }).eq('id', flagId)
}

async function triggerTenuousBalance(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  await say(client, channel, `@${username} — The balance you struck in Nibenay is holding. Barely. +10% XP this campaign.`)
  await supabase.from('player_consequence_flags').update({ balance_triggered: true }).eq('id', flagId)
}

async function triggerAthasianLord(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const isBoon = Math.random() < 0.50
  if (isBoon) {
    const bonus = roll(15, 35); const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The ritual nexus answers. The power flows today. +${bonus} HP. (${newHp}/${char.max_hp})`)
  } else {
    if (Math.random() < 0.50) {
      const drain = roll(12, 28); const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel, `@${username} — The ritual nexus answers. Today it takes instead. -${drain} HP. (${newHp}/${char.max_hp})`)
    } else {
      const drain = Math.floor(char.gold * 0.18)
      if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — Staying hidden has a cost. -${drain}gp. (${char.gold - drain}gp remaining)`) }
    }
  }
  await supabase.from('player_consequence_flags').update({ athasian_triggered: true, athasian_boon: isBoon }).eq('id', flagId)
}

const DARKSUN_STAGE_TITLES: Record<number, string> = { 2: 'Walked the Crescent Forest', 3: 'Inside the City of Spires', 4: 'Witnessed the Devouring', 5: 'Stood Before the Shadow King' }
async function awardDarkSunStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = DARKSUN_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'the-ritual-of-nibenay' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Ashes Beneath the Flame
// ------------------------------------------------------------

async function triggerFlameScarred(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.10); const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — The mark faded. Not gone. The Whispering Flame finds the scar. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ flame_triggered: true }).eq('id', flagId)
}

async function triggerWhisperBound(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.15)
  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The voices in the flame are patient. Today they want ${tithe}gp. (${char.gold - tithe}gp remaining)`)
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08); const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The voices in the flame are patient. No gold. They take something else. -${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`)
  }
  await supabase.from('player_consequence_flags').update({ whisper_triggered: true }).eq('id', flagId)
}

async function triggerBelShalorsEye(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const isBoon = Math.random() < 0.50
  if (isBoon) {
    const bonus = roll(10, 28); const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — Bel Shalor's eye is on you. Today you are more useful intact. +${bonus} HP. (${newHp}/${char.max_hp})`)
  } else {
    if (Math.random() < 0.50) {
      const drain = roll(10, 24); const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel, `@${username} — Bel Shalor's eye is on you. Something reaches through. -${drain} HP. (${newHp}/${char.max_hp})`)
    } else {
      const drain = Math.floor(char.gold * 0.14)
      if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — Bel Shalor's eye is on you. Being watched has a cost. -${drain}gp. (${char.gold - drain}gp remaining)`) }
    }
  }
  await supabase.from('player_consequence_flags').update({ eye_triggered: true, eye_boon: isBoon }).eq('id', flagId)
}

const EBERRON_STAGE_TITLES: Record<number, string> = { 2: 'Faith in Fracture', 3: 'Who Named the Wyrmbreaker', 4: 'Held the Brazier', 5: 'Stood in the Shadow of the Flame' }
async function awardEberronStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = EBERRON_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'the-whispering-flame' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// Ashes of the Black Emperor
// ------------------------------------------------------------

async function triggerKrynnishBurden(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const drain = Math.floor(char.max_hp * 0.10); const newHp = Math.max(1, char.hp - drain)
  await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
  await say(client, channel, `@${username} — Krynn avoids a second great war. You carry what it cost. The burden does not lighten. -${drain} HP. (${newHp}/${char.max_hp} HP remaining)`)
  await supabase.from('player_consequence_flags').update({ burden_triggered: true }).eq('id', flagId)
}

async function triggerWarUnending(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  if (Math.random() > 0.35) return
  const { data: char } = await supabase.from('characters').select('gold, hp, max_hp').eq('twitch_username', username).single()
  if (!char) return
  const tithe = Math.floor(char.gold * 0.15)
  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The war you failed to end reorganized. It found you again. ${tithe}gp taken. (${char.gold - tithe}gp remaining)`)
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08); const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The war you failed to end reorganized. No gold. It takes something else. -${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`)
  }
  await supabase.from('player_consequence_flags').update({ war_triggered: true }).eq('id', flagId)
}

async function triggerTyrantMarked(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const isBoon = Math.random() < 0.50
  if (isBoon) {
    const bonus = roll(15, 35); const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel, `@${username} — The system you took still answers to you. The power flows today. +${bonus} HP. (${newHp}/${char.max_hp})`)
  } else {
    if (Math.random() < 0.50) {
      const drain = roll(12, 28); const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel, `@${username} — The system you took still answers to you. Ruling through domination has costs. -${drain} HP. (${newHp}/${char.max_hp})`)
    } else {
      const drain = Math.floor(char.gold * 0.18)
      if (drain > 0) { await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username); await say(client, channel, `@${username} — Maintaining order is expensive. -${drain}gp. (${char.gold - drain}gp remaining)`) }
    }
  }
  await supabase.from('player_consequence_flags').update({ tyrant_triggered: true, tyrant_boon: isBoon }).eq('id', flagId)
}

async function triggerChainsOfOrder(client: Client, supabase: SupabaseClient, channel: string, username: string, flagId: string) {
  const { data: char } = await supabase.from('characters').select('hp, max_hp, gold').eq('twitch_username', username).single()
  if (!char) return
  const goldDrain = Math.floor(char.gold * 0.22); const hpDrain = Math.floor(char.max_hp * 0.14)
  const newHp = Math.max(1, char.hp - hpDrain); const newGold = Math.max(0, char.gold - goldDrain)
  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)
  await say(client, channel, `@${username} — The chains of order collect what is owed. You chose this. You called it peace. -${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`)
  await supabase.from('player_consequence_flags').update({ chains_triggered: true }).eq('id', flagId)
}

const DRAGONLANCE_STAGE_TITLES: Record<number, string> = { 2: 'Witnessed the Perfect Weapon', 3: 'Stood Against the Dragonarmies', 4: 'Who Faced the Clone', 5: 'Walked into the Emperor\'s Citadel' }
async function awardDragonlanceStageMilestone(supabase: SupabaseClient, username: string, stageReached: number) {
  const title = DRAGONLANCE_STAGE_TITLES[stageReached]; if (!title) return
  await supabase.from('player_titles').upsert({ username, title, source: 'the-black-emperor' }, { onConflict: 'username,title', ignoreDuplicates: true })
}

// ------------------------------------------------------------
// The Smiling Tyrant consequence triggers
// ------------------------------------------------------------

// truth_bearer — the chaos you unleashed follows you (Expose the Truth)
// 35% chance per campaign entry
async function triggerTruthBearer(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const drain = Math.floor(char.max_hp * 0.10)
  const newHp = Math.max(1, char.hp - drain)

  await supabase
    .from('characters')
    .update({ hp: newHp })
    .eq('twitch_username', username)

  await say(client, channel,
    `@${username} — You told the truth. The chaos that caused is still out there. ` +
    `It finds you today, as it finds you periodically, as it will continue to find you. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ truth_triggered: true })
    .eq('id', flagId)
}

// web_remnant — the network is still out there (Cut the Head)
// 35% chance per campaign entry — gold tithe
async function triggerWebRemnant(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('gold, hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const tithe = Math.floor(char.gold * 0.15)

  if (char.gold >= tithe && tithe > 0) {
    await supabase
      .from('characters')
      .update({ gold: char.gold - tithe })
      .eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The network Iuz built survived him. It still functions. ` +
      `It still collects. Today it collects from you. ` +
      `${tithe}gp taken. (${char.gold - tithe}gp remaining)`
    )
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08)
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The network Iuz built survived him. It still functions. ` +
      `No gold to take. The web finds another way. ` +
      `-${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase
    .from('player_consequence_flags')
    .update({ web_triggered: true })
    .eq('id', flagId)
}

// smiling_tyrant — power and its cost (Control the System)
// Always fires — mirrors tyrant_marked
async function triggerSmilingTyrant(
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
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Iuz's network answers to you today. ` +
      `The infrastructure of coordinated confusion, repurposed. It works. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const debtType = Math.random() < 0.50 ? 'hp' : 'gold'
    if (debtType === 'hp') {
      const drain = roll(12, 28)
      const newHp = Math.max(1, char.hp - drain)
      await supabase
        .from('characters')
        .update({ hp: newHp })
        .eq('twitch_username', username)
      await say(client, channel,
        `@${username} — Iuz's network answers to you today. ` +
        `The cost of running a system built on other people's suffering is not small. ` +
        `-${drain} HP. (${newHp}/${char.max_hp})`
      )
    } else {
      const drain = Math.floor(char.gold * 0.18)
      if (drain > 0) {
        await supabase
          .from('characters')
          .update({ gold: char.gold - drain })
          .eq('twitch_username', username)
        await say(client, channel,
          `@${username} — Iuz's network answers to you today. ` +
          `You are smiling. You did not notice when that started. ` +
          `-${drain}gp. (${char.gold - drain}gp remaining)`
        )
      }
    }
  }

  await supabase
    .from('player_consequence_flags')
    .update({ smiling_triggered: true, smiling_boon: isBoon })
    .eq('id', flagId)
}

// old_ones_mark — Iuz's empire remembers you (Failure)
// Always fires — heaviest toll, mirrors chains_of_order
async function triggerOldOnesMark(
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

  const goldDrain = Math.floor(char.gold * 0.22)
  const hpDrain = Math.floor(char.max_hp * 0.14)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase
    .from('characters')
    .update({ hp: newHp, gold: newGold })
    .eq('twitch_username', username)

  await say(client, channel,
    `@${username} — Iuz's empire is the only stable thing left in the Flanaess. ` +
    `You live in it. You know exactly how it was built. ` +
    `That knowledge costs you, as it costs everyone who has it. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ old_ones_triggered: true })
    .eq('id', flagId)
}

// ------------------------------------------------------------
// The Smiling Tyrant stage milestone titles
// ------------------------------------------------------------

const GREYHAWK_STAGE_TITLES: Record<number, string> = {
  2: 'Pulled a Thread',
  3: 'Saw the Empire Without Borders',
  4: 'Understood the Collapse Engine',
  5: 'Stood in Dorakaa',
}

async function awardGreyhawkStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = GREYHAWK_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'the-smiling-tyrant' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// The Tyrant Reforged consequence triggers
// ------------------------------------------------------------

// shattered_order — the chaos you unleashed follows you (Break the Tyranny)
// 35% chance per campaign entry
async function triggerShatteredOrder(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

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
    `@${username} — The order you broke in Zhentil Keep is still breaking. ` +
    `Chaos does not stay where you leave it. It travels. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ order_triggered: true }).eq('id', flagId)
}

// banes_ledger — the system still collects (Controlled Order)
// 35% chance per campaign entry — gold tithe
async function triggerBanesLedger(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

  const { data: char } = await supabase
    .from('characters')
    .select('gold, hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const tithe = Math.floor(char.gold * 0.15)

  if (char.gold >= tithe && tithe > 0) {
    await supabase.from('characters').update({ gold: char.gold - tithe }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The ledger of Bane updates without warning. ` +
      `The system you left intact is still running. It still collects. ` +
      `${tithe}gp taken. (${char.gold - tithe}gp remaining)`
    )
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08)
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — The ledger of Bane updates without warning. ` +
      `No gold. The system accepts alternative payment. ` +
      `-${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ ledger_triggered: true }).eq('id', flagId)
}

// tyrants_mark — power and its cost (Serve the Tyrant)
// Always fires — mirrors smiling_tyrant
async function triggerTyrantsMark(
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
      `@${username} — The Scepter answers to you today. ` +
      `Bane's network is extensive and today it works in your favor. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const debtType = Math.random() < 0.50 ? 'hp' : 'gold'
    if (debtType === 'hp') {
      const drain = roll(12, 28)
      const newHp = Math.max(1, char.hp - drain)
      await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
      await say(client, channel,
        `@${username} — The Scepter answers to you today. ` +
        `The ledger also answers to you. It has found a discrepancy. ` +
        `-${drain} HP. (${newHp}/${char.max_hp})`
      )
    } else {
      const drain = Math.floor(char.gold * 0.18)
      if (drain > 0) {
        await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username)
        await say(client, channel,
          `@${username} — The Scepter answers to you today. ` +
          `Maintaining a divine mandate has operational costs. ` +
          `-${drain}gp. (${char.gold - drain}gp remaining)`
        )
      }
    }
  }

  await supabase.from('player_consequence_flags').update({ tyrants_triggered: true, tyrants_boon: isBoon }).eq('id', flagId)
}

// hand_of_bane — Bane's empire remembers you (Tyranny Triumphant)
// Always fires — heaviest toll, mirrors chains_of_order
async function triggerHandOfBane(
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

  const goldDrain = Math.floor(char.gold * 0.22)
  const hpDrain = Math.floor(char.max_hp * 0.14)
  const newHp = Math.max(1, char.hp - hpDrain)
  const newGold = Math.max(0, char.gold - goldDrain)

  await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)

  await say(client, channel,
    `@${username} — Bane's system expanded as designed. ` +
    `You are in the ledger now. You were always going to be in the ledger. ` +
    `The mark collects what the mark collects. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ bane_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// The Tyrant Reforged stage milestone titles
// ------------------------------------------------------------

const FORGOTTEN_REALMS_STAGE_TITLES: Record<number, string> = {
  2: 'Saw the Doctrine Written',
  3: 'Walked the Network',
  4: 'Felt the Scepter\'s Reach',
  5: 'Stood in the Temple of Bane',
}

async function awardForgottenRealmsStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = FORGOTTEN_REALMS_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'the-tyrant-reforged' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// The Lich King of Thay consequence triggers
// ------------------------------------------------------------

// thayan_survivor — chaos of Thay's collapse follows you (Defeat the Lich)
// 35% chance per campaign entry
async function triggerThayanSurvivor(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.35) return

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
    `@${username} — Thay without a Zulkir is not peaceful. ` +
    `The chaos you caused follows you as it follows everyone who caused it. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase.from('player_consequence_flags').update({ thayan_triggered: true }).eq('id', flagId)
}

// lich_servant — Zulkirjax's mark collects (Submit to Zulkirjax)
// Always fires — heavy toll
async function triggerLichServant(
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

  const isBoon = Math.random() < 0.30 // tilted toward toll — serving a lich is costly

  if (isBoon) {
    const bonus = roll(15, 40)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — Zulkir Jax's network answers to you today. ` +
      `Serving the Lich King has its advantages. He is generous when it costs him nothing. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const goldDrain = Math.floor(char.gold * 0.22)
    const hpDrain = Math.floor(char.max_hp * 0.14)
    const newHp = Math.max(1, char.hp - hpDrain)
    const newGold = Math.max(0, char.gold - goldDrain)
    await supabase.from('characters').update({ hp: newHp, gold: newGold }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — the mark of the Lich King collects what the mark collects. ` +
      `He told you it would. He was not lying. He does not need to lie. ` +
      `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
    )
  }

  await supabase.from('player_consequence_flags').update({ lich_triggered: true, lich_boon: isBoon }).eq('id', flagId)
}

// uneasy_pact — the pact holds, for now (Negotiate)
// Random boon or toll
async function triggerUneasyPact(
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
    const bonus = roll(10, 30)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await say(client, channel,
      `@${username} — the pact with Zulkir Jax holds. Today it works in your favor. ` +
      `He has not forgotten the fine print. Neither has he forgotten the agreement. ` +
      `+${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const drain = Math.floor(char.gold * 0.18)
    if (drain > 0) {
      await supabase.from('characters').update({ gold: char.gold - drain }).eq('twitch_username', username)
      await say(client, channel,
        `@${username} — the pact with Zulkir Jax holds. Today it collects. ` +
        `The fine print was always going to say something like this. ` +
        `-${drain}gp. (${char.gold - drain}gp remaining)`
      )
    }
  }

  await supabase.from('player_consequence_flags').update({ pact_triggered: true, pact_boon: isBoon }).eq('id', flagId)
}

// zulkirjax_triumphant — Thay expanded, you live in it (Failure)
// Always fires — heaviest toll
async function triggerZulkirjaxTriumphant(
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
    `@${username} — Thay expanded as designed. The letters arrived as promised. ` +
    `You live in what Zulkir Jax built. You know exactly how it was built. ` +
    `You were there. That knowledge has a cost. ` +
    `-${hpDrain} HP, -${goldDrain}gp. (${newHp}/${char.max_hp} HP | ${newGold}gp remaining)`
  )

  await supabase.from('player_consequence_flags').update({ triumphant_triggered: true }).eq('id', flagId)
}

// ------------------------------------------------------------
// The Lich King of Thay stage milestone titles
// ------------------------------------------------------------

const THAY_STAGE_TITLES: Record<number, string> = {
  2: 'Passed the Gates of Eltabbar',
  3: 'Walked the Undead Warrens',
  4: 'Survived the Conclave',
  5: 'Breached the Vault',
}

async function awardThayStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = THAY_STAGE_TITLES[stageReached]
  if (!title) return
  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'the-lich-king-of-thay' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// Stage combat engine
// ------------------------------------------------------------

async function runNamedStage(
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

      let hitPenaltyActive = false
      const { data: stabilizeFlag } = await supabase.from('player_consequence_flags').select('hit_penalty').eq('username', player.username).eq('flag_type', 'corruption_stabilized').eq('is_active', true).single()
      if (stabilizeFlag) hitPenaltyActive = Math.random() < (stabilizeFlag.hit_penalty ?? 0.20)

      if (hitPenaltyActive) { await say(client, channel, `@${player.username} (${getDisplayName(player.username, player)})'s attack wavers — the corruption interferes! Miss!`); await delay(1200); continue }

      let manaclesPenalty = 0
      const { data: blightFlag } = await supabase.from('player_consequence_flags').select('blight_attack_penalty').eq('username', player.username).eq('flag_type', 'iron_manacles_blight').eq('is_active', true).single()
      if (blightFlag) manaclesPenalty = blightFlag.blight_attack_penalty ?? 3

      const rawDmg = roll(12, 28)
      const dmg = Math.max(1, rawDmg - manaclesPenalty)
      enemyHPs[targetIdx] = Math.max(0, enemyHPs[targetIdx] - dmg)
      const penaltyNote = manaclesPenalty > 0 ? ` (−${manaclesPenalty} from psionic blight)` : ''
      await say(client, channel, `@${player.username} (${getDisplayName(player.username, player)}) hits ${stage.enemy_name} for ${dmg} damage!${penaltyNote} (${Math.max(0, enemyHPs[targetIdx])} HP remaining)`)
      await delay(1200)

      if (enemyHPs[targetIdx] === 0) { await say(client, channel, `${stage.enemy_name} has fallen!`); await delay(1000) }
    }

    for (let i = 0; i < stage.enemy_count; i++) {
      if (enemyHPs[i] <= 0) continue

      if (!specialFired && round === 2 && stage.special_name) {
        if (stage.special_type === 'all') {
          const specialDmg = Math.ceil((stage.special_damage ?? 20) * diffMod.dmgMod)
          await say(client, channel, `${stage.enemy_name} uses ${stage.special_name}! All party members take ${specialDmg} damage!`)
          for (const p of alive.filter(p => p.is_alive)) {
            p.hp = Math.max(0, p.hp - specialDmg)
            await say(client, channel, `@${p.username} (${getDisplayName(p.username, p)}) — ${p.hp} HP remaining.`)
            if (p.hp <= 0) { p.is_alive = false; await handleDeath(supabase, campaignId, p, stage.stage); await say(client, channel, `@${p.username} (${getDisplayName(p.username, p)}) has fallen! Permadeath — they are out of the campaign.`) }
          }
          specialFired = true; await delay(2000)
        } else if (stage.special_type === 'debuff') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) await say(client, channel, `${stage.enemy_name} uses ${stage.special_name}! @${target.username} (${getDisplayName(target.username, target)})'s next attack is suppressed!`)
          specialFired = true; await delay(1500)
        } else if (stage.special_type === 'single') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            const specialDmg = Math.ceil((stage.special_damage ?? 25) * diffMod.dmgMod)
            target.hp = Math.max(0, target.hp - specialDmg)
            await say(client, channel, `${stage.enemy_name} uses ${stage.special_name} on @${target.username} (${getDisplayName(target.username, target)}) for ${specialDmg} damage! (${target.hp} HP remaining)`)
            if (target.hp <= 0) { target.is_alive = false; await handleDeath(supabase, campaignId, target, stage.stage); await say(client, channel, `@${target.username} (${getDisplayName(target.username, target)}) has fallen! Permadeath — they are out of the campaign.`) }
          }
          specialFired = true; await delay(1500)
        }
      } else {
        const target = pickRandom(alive.filter(p => p.is_alive))
        if (!target) break
        const dmg = roll(dmgMin, dmgMax)
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel, `${stage.enemy_name} strikes @${target.username} (${getDisplayName(target.username, target)}) for ${dmg} damage! (${target.hp} HP remaining)`)
        await delay(1200)
        if (target.hp <= 0) { target.is_alive = false; await handleDeath(supabase, campaignId, target, stage.stage); await say(client, channel, `@${target.username} (${getDisplayName(target.username, target)}) has fallen! Permadeath — they are out of the campaign.`); await delay(1000) }
      }
    }

    round++
    if (round > 8) { for (let i = 0; i < enemyHPs.length; i++) enemyHPs[i] = 0; await say(client, channel, `The enemy is overwhelmed and routed!`) }
    await delay(1500)
  }

  return { survivors: alive.filter(p => p.is_alive), defeated: alive.filter(p => !p.is_alive) }
}

// ------------------------------------------------------------
// Death handler
// ------------------------------------------------------------

async function handleDeath(supabase: SupabaseClient, campaignId: string, player: Participant, stage: number) {
  await supabase.from('campaign_participants').update({ hp: 0, is_alive: false, stage_reached: stage }).eq('campaign_id', campaignId).eq('username', player.username)
}

// ------------------------------------------------------------
// Rest shrine
// ------------------------------------------------------------

async function restShrine(client: Client, supabase: SupabaseClient, channel: string, campaignId: string, stage: NamedCampaignStage, participants: Participant[]) {
  if (!stage.shrine_flavor) return
  await say(client, channel, stage.shrine_flavor)
  await delay(2000)
  for (const p of participants.filter(p => p.is_alive)) {
    const healed = Math.min(SHRINE_HEAL_HP, p.max_hp - p.hp)
    p.hp += healed
    await supabase.from('campaign_participants').update({ hp: p.hp }).eq('campaign_id', campaignId).eq('username', p.username)
    await say(client, channel, `@${p.username} (${getDisplayName(p.username, p)}) recovers ${healed} HP at the shrine. (${p.hp}/${p.max_hp} HP)`)
    await delay(800)
  }
}

// ------------------------------------------------------------
// Spawn combat
// ------------------------------------------------------------

async function runElementalSpawn(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  markedUsername: string,
  participants: Participant[],
  pool: ElementalSpawn[] = ELEMENTAL_SPAWN_POOL,
  flavorPrefix?: string
) {
  const spawnEnemy = pickRandom(pool)
  const prefix = flavorPrefix ?? `The elemental planes bleed through! A ${spawnEnemy.name} manifests — drawn by ${markedUsername}'s mark from Zakhara!`
  await say(client, channel, prefix)
  await delay(1500)
  const spawnHp = [spawnEnemy.hp]
  let spawnRound = 1
  while (spawnHp[0] > 0 && participants.some(p => p.is_alive)) {
    for (const player of participants.filter(p => p.is_alive)) {
      const dmg = roll(10, 22)
      spawnHp[0] = Math.max(0, spawnHp[0] - dmg)
      await say(client, channel, `@${player.username} (${getDisplayName(player.username, player)}) strikes the ${spawnEnemy.name} for ${dmg} damage! (${spawnHp[0]} HP remaining)`)
      await delay(1000)
      if (spawnHp[0] <= 0) break
    }
    if (spawnHp[0] > 0) {
      const target = pickRandom(participants.filter(p => p.is_alive))
      if (target) {
        const dmg = roll(spawnEnemy.damage_min, spawnEnemy.damage_max)
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel, `The ${spawnEnemy.name} strikes @${target.username} (${getDisplayName(target.username, target)}) for ${dmg} damage! (${target.hp} HP remaining)`)
        if (target.hp <= 0) { target.is_alive = false; await handleDeath(supabase, campaignId, target, 0); await say(client, channel, `@${target.username} (${getDisplayName(target.username, target)}) has fallen to the spawn! Permadeath.`) }
        await delay(1000)
      }
    }
    spawnRound++
    if (spawnRound > 5) spawnHp[0] = 0
  }
  if (spawnHp[0] <= 0) await say(client, channel, `The ${spawnEnemy.name} is defeated!`)
  await delay(1500)
}

// ------------------------------------------------------------
// Ending vote
// ------------------------------------------------------------

async function runEndingVote(client: Client, channel: string, participants: Participant[], outcomes: NamedCampaignOutcome[]): Promise<NamedCampaignOutcome> {
  const participantNames = new Set(participants.map(p => p.username.toLowerCase()))
  const votes = new Map<string, string>()
  const voteMenu = outcomes.map((o, i) => `${i + 1}) ${o.outcome_label}`).join(' | ')
  await say(client, channel, `THE DECISION AWAITS. Participants vote now! Type the number of your choice. 3 minutes. | ${voteMenu}`)
  await collectVotes(client, channel, participantNames, outcomes, votes, VOTE_WINDOW_MS)
  let result = tallyVotes(votes, outcomes)
  if (result === null) {
    await say(client, channel, `The vote is tied! The decision opens to ALL of chat for 3 more minutes! | ${voteMenu}`)
    const allChat = new Map<string, string>()
    await collectVotes(client, channel, null, outcomes, allChat, TIEBREAK_WINDOW_MS)
    result = tallyVotes(new Map([...allChat, ...votes]), outcomes)
    if (result === null) { result = pickRandom(outcomes); await say(client, channel, `Still tied. Fate decides. The answer is: ${result.outcome_label}`) }
  }
  return result
}

function collectVotes(client: Client, channel: string, allowedUsers: Set<string> | null, outcomes: NamedCampaignOutcome[], votes: Map<string, string>, windowMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { client.removeListener('message', handler); resolve() }, windowMs)
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
        if ([...allowedUsers].every(u => votes.has(u))) { clearTimeout(timeout); clearInterval(interval); client.removeListener('message', handler); resolve() }
      }, 2000)
    }
  })
}

function tallyVotes(votes: Map<string, string>, outcomes: NamedCampaignOutcome[]): NamedCampaignOutcome | null {
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

async function writeConsequences(supabase: SupabaseClient, campaignId: string, participants: Participant[], outcome: NamedCampaignOutcome, campaignSlug: string) {
  if (!outcome.consequence_key) return
  for (const p of participants) {
    if (!p.is_alive && outcome.consequence_key !== 'shadow_marked') continue
    const base: Record<string, unknown> = { username: p.username, flag_type: outcome.consequence_key, is_active: true, source_campaign_slug: campaignSlug, source_campaign_id: campaignId }
    switch (outcome.consequence_key) {
      case 'corruption_stabilized': base.hit_penalty = 0.20; break
      case 'crystal_control': base.madness_trigger_at = roll(2, 4); base.madness_campaign_counter = 0; break
      case 'shadow_marked': base.assassin_trigger_at = roll(5, 7); base.assassin_campaign_counter = 0; break
      case 'seal_bound': base.seal_trigger_at = roll(3, 5); base.seal_campaign_counter = 0; break
      case 'convergence_marked': break
      case 'genie_debt': base.debt_trigger_at = roll(2, 3); base.debt_campaign_counter = 0; break
      case 'mandate_restored': base.mandate_trigger_at = roll(2, 4); base.mandate_campaign_counter = 0; break
      case 'mandate_shattered': base.spirit_spawn_active = true; break
      case 'mandate_reforged': base.mandate_trigger_at = roll(3, 5); base.mandate_campaign_counter = 0; base.mandate_boon = Math.random() < 0.50; break
      case 'celestial_debt': base.celestial_trigger_at = roll(2, 3); base.celestial_campaign_counter = 0; break
      case 'starfire_marked': base.starfire_trigger_at = roll(1, 3); base.starfire_campaign_counter = 0; break
      case 'cycle_bound': base.cycle_trigger_at = roll(2, 4); base.cycle_campaign_counter = 0; break
      case 'engine_forged': base.engine_trigger_at = 1; base.engine_campaign_counter = 0; break
      case 'infernal_marked': base.infernal_trigger_at = roll(2, 4); base.infernal_campaign_counter = 0; break
      case 'abyssal_touched': base.abyssal_trigger_at = roll(1, 3); base.abyssal_campaign_counter = 0; break
      case 'planar_witness': base.witness_trigger_at = 1; base.witness_campaign_counter = 0; break
      case 'gem_bound': base.gem_trigger_at = 1; base.gem_campaign_counter = 0; break
      case 'domain_bound': base.domain_trigger_at = roll(2, 4); base.domain_campaign_counter = 0; break
      case 'curse_shattered': base.shatter_trigger_at = 1; base.shatter_campaign_counter = 0; break
      case 'mist_marked': base.mist_trigger_at = 1; base.mist_campaign_counter = 0; break
      case 'darklord_echo': base.darklord_trigger_at = 1; base.darklord_campaign_counter = 0; break
      case 'ashen_debt': base.ashen_trigger_at = roll(2, 4); base.ashen_campaign_counter = 0; break
      case 'city_breaker': base.city_breaker_trigger_at = roll(2, 4); base.city_breaker_campaign_counter = 0; break
      case 'tenuous_balance': base.balance_trigger_at = 1; base.balance_campaign_counter = 0; break
      case 'athasian_lord': base.athasian_trigger_at = 1; base.athasian_campaign_counter = 0; break
      case 'flame_scarred': base.flame_trigger_at = roll(2, 4); base.flame_campaign_counter = 0; break
      case 'whisper_bound': base.whisper_trigger_at = roll(1, 3); base.whisper_campaign_counter = 0; break
      case 'bel_shalors_eye': base.eye_trigger_at = 1; base.eye_campaign_counter = 0; break
      case 'krynnish_burden': base.burden_trigger_at = roll(2, 4); base.burden_campaign_counter = 0; break
      case 'war_unending': base.war_trigger_at = roll(2, 4); base.war_campaign_counter = 0; break
      case 'tyrant_marked': base.tyrant_trigger_at = 1; base.tyrant_campaign_counter = 0; break
      case 'chains_of_order': base.chains_trigger_at = 1; base.chains_campaign_counter = 0; break
      // ── The Smiling Tyrant ────────────────────────────────
      case 'truth_bearer': base.truth_trigger_at = roll(2, 4); base.truth_campaign_counter = 0; break
      case 'web_remnant': base.web_trigger_at = roll(2, 4); base.web_campaign_counter = 0; break
      case 'smiling_tyrant': base.smiling_trigger_at = 1; base.smiling_campaign_counter = 0; break
      case 'old_ones_mark': base.old_ones_trigger_at = 1; base.old_ones_campaign_counter = 0; break
      // ── The Tyrant Reforged ───────────────────────────────
      case 'shattered_order': base.order_trigger_at = roll(2, 4); base.order_campaign_counter = 0; break
      case 'banes_ledger': base.ledger_trigger_at = roll(2, 4); base.ledger_campaign_counter = 0; break
      case 'tyrants_mark': base.tyrants_trigger_at = 1; base.tyrants_campaign_counter = 0; break
      case 'hand_of_bane': base.bane_trigger_at = 1; base.bane_campaign_counter = 0; break
      // ── The Lich King of Thay ─────────────────────────────
      case 'thayan_survivor': base.thayan_trigger_at = roll(2, 4); base.thayan_campaign_counter = 0; break
      case 'lich_servant': base.lich_trigger_at = 1; base.lich_campaign_counter = 0; break
      case 'uneasy_pact': base.pact_trigger_at = 1; base.pact_campaign_counter = 0; break
      case 'zulkirjax_triumphant': base.triumphant_trigger_at = 1; base.triumphant_campaign_counter = 0; break
    }
    await supabase.from('player_consequence_flags').upsert(base, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
  }
}

async function writeSpreadDifficulty(supabase: SupabaseClient, channel: string, campaignId: string) {
  await supabase.from('channel_consequence_flags').upsert({ channel, flag_type: 'spread_difficulty_active', is_active: true, difficulty_hp_mod: 1.25, difficulty_dmg_mod: 1.25, source_campaign_id: campaignId }, { onConflict: 'channel,flag_type,is_active', ignoreDuplicates: false })
}

// ------------------------------------------------------------
// Reward writer
// ------------------------------------------------------------

async function writeNamedRewards(
  supabase: SupabaseClient,
  campaignId: string,
  participants: Participant[],
  outcome: NamedCampaignOutcome,
  campaignSlug: string,
  fullClear: boolean
) {
  const { data: titleRows } = await supabase.from('named_campaign_titles').select('title').eq('campaign_slug', campaignSlug).or(`outcome_key.is.null,outcome_key.eq.${outcome.outcome_key}`)
  const { data: artifactRows } = await supabase.from('named_campaign_artifacts').select('artifact_name').eq('campaign_slug', campaignSlug)

  const titlePool = (titleRows ?? []) as { title: string }[]
  const artifactPool = (artifactRows ?? []) as { artifact_name: string }[]

  const EMBERS_TITLE_OUTCOMES = ['balance_preserved', 'power_seized']
  const titleEarned = titlePool.length > 0 &&
    (campaignSlug !== 'embers-of-the-second-war' || EMBERS_TITLE_OUTCOMES.includes(outcome.outcome_key))
    ? pickRandom(titlePool).title : null

  const artifactName = artifactPool.length > 0 ? pickRandom(artifactPool).artifact_name : null
  const survivors = participants.filter(p => p.is_alive)
  const artWinner = survivors.length > 0 ? pickRandom(survivors) : null

  for (const p of participants) {
    let xp = NAMED_STAGE_XP.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    let gold = NAMED_STAGE_GOLD.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    xp = Math.floor(xp * outcome.reward_modifier)
    gold = Math.floor(gold * outcome.reward_modifier)

    if ((outcome.consequence_key === 'planar_witness' || outcome.consequence_key === 'tenuous_balance') && p.is_alive) xp = Math.floor(xp * 1.10)

    if (fullClear && p.is_alive) {
      xp += Math.floor(CLEAR_BONUS_XP * outcome.reward_modifier) + outcome.bonus_xp
      gold += Math.floor(CLEAR_BONUS_GOLD * outcome.reward_modifier)
    }

    await supabase.from('campaign_rewards').insert({ campaign_id: campaignId, username: p.username, xp_earned: xp, gold_earned: gold, title_earned: fullClear && p.is_alive ? titleEarned : null, artifact_earned: p.username === artWinner?.username ? artifactName : null })

    const { data: char } = await supabase.from('characters').select('xp, gold').eq('twitch_username', p.username).single()
    if (char) await supabase.from('characters').update({ xp: char.xp + xp, gold: char.gold + gold }).eq('twitch_username', p.username)

    await supabase.rpc('increment_campaign_counters', { p_username: p.username })

    // Artifact stat bonuses
    if (p.username === artWinner?.username) {
      if (artifactName === 'Iron Manacles of Dis') await supabase.from('inventory').update({ stat_bonus: 5 }).eq('twitch_username', p.username).eq('item_name', 'Iron Manacles of Dis')
      if (artifactName === 'Obsidian Orb of Nibenay') await supabase.from('inventory').update({ stat_bonus: 4 }).eq('twitch_username', p.username).eq('item_name', 'Obsidian Orb of Nibenay')
      if (artifactName === 'Brazier of Cinder Voices') await supabase.from('inventory').update({ stat_bonus: 5 }).eq('twitch_username', p.username).eq('item_name', 'Brazier of Cinder Voices')
      // Crown of Takhisis and Demonomicon of Iggwilv — pure flavor, no stat bonus
    }

    // Stage milestone titles
    if (campaignSlug === 'the-dying-star' && p.stage_reached >= 2) await awardXaryxisStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'embers-of-the-second-war' && p.stage_reached >= 2) await awardEmbersStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'shattered-memory-of-darkon' && p.stage_reached >= 2) await awardDarkonStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-ritual-of-nibenay' && p.stage_reached >= 2) await awardDarkSunStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-whispering-flame' && p.stage_reached >= 2) await awardEberronStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-black-emperor' && p.stage_reached >= 2) await awardDragonlanceStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-smiling-tyrant' && p.stage_reached >= 2) await awardGreyhawkStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-tyrant-reforged' && p.stage_reached >= 2) await awardForgottenRealmsStageMilestone(supabase, p.username, p.stage_reached)
    if (campaignSlug === 'the-lich-king-of-thay' && p.stage_reached >= 2) await awardThayStageMilestone(supabase, p.username, p.stage_reached)
  }

  if (fullClear) {
    for (const p of survivors) {
      await supabase.from('player_campaign_clears').upsert({ username: p.username, named_unlocked: true }, { onConflict: 'username' })
      await supabase.rpc('increment_named_clears', { p_username: p.username, p_slug: campaignSlug })
    }
  }

  return { titleEarned, artifactName, artWinner }
}

// ------------------------------------------------------------
// Zulkirjax boss fight — two phases
// ------------------------------------------------------------

async function runZulkirjaxFight(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  participants: Participant[],
  diffMod: { hpMod: number; dmgMod: number }
): Promise<{ survivors: Participant[]; defeated: Participant[] }> {
  const alive = participants.filter(p => p.is_alive)
  const dmgMin = Math.ceil(22 * diffMod.dmgMod)
  const dmgMax = Math.ceil(35 * diffMod.dmgMod)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `Stage 5/5 — The Throne of Szass Tam`)
  await delay(1500)
  await say(client, channel,
    `The throne room is exactly what it was under Szass Tam. Zulkir Jax changed nothing. ` +
    `The bones of Szass Tam's honor guard are arranged along the walls in the same positions they fell. ` +
    `The figure on the throne stands as the party enters.`
  )
  await delay(3000)
  await say(client, channel,
    `"I know your names. I know where you came from." He steps down from the throne. ` +
    `The phylactery pulses with cold light. "I won. Against everything. Against Szass Tam. ` +
    `Against the gods who apparently decided this was acceptable. What you are doing right now is the epilogue." ` +
    `He raises one hand. "Insects. Come, then."`
  )
  await delay(3000)

  // ── Phase 1 ──────────────────────────────────────────────────
  await say(client, channel, `⚔️ PHASE 1 — Zulkir Jax, Lich King of Thay (400 HP)`)
  await delay(1500)

  let zulkirjaxHp = Math.ceil(400 * diffMod.hpMod)
  let armyFired = false
  let pulseFired = false
  let round = 1
  let inPhase2 = false

  while (zulkirjaxHp > 0 && alive.some(p => p.is_alive)) {
    await say(client, channel, `— Round ${round} —`)
    await delay(1500)

    // Players attack
    for (const player of alive.filter(p => p.is_alive)) {
      const rawDmg = roll(12, 28)
      zulkirjaxHp = Math.max(0, zulkirjaxHp - rawDmg)
      await say(client, channel, `@${player.username} (${getDisplayName(player.username, player)}) strikes Zulkir Jax for ${rawDmg} damage! (${zulkirjaxHp} HP remaining)`)
      await delay(1200)
      if (zulkirjaxHp <= 0) break
    }

    // Army of Ten Thousand — fires when HP drops below 300 in phase 1
    if (!armyFired && zulkirjaxHp <= Math.ceil(300 * diffMod.hpMod) && !inPhase2) {
      armyFired = true
      await say(client, channel,
        `💀 "You wanted an army? I have one." Zulkir Jax raises both hands. ` +
        `The bones along the walls begin to move. The doors open. ` +
        `THE ARMY OF TEN THOUSAND — every living participant takes 25 damage. ` +
        `Those at or below 25 HP are eliminated.`
      )
      await delay(2500)
      for (const p of alive.filter(p => p.is_alive)) {
        p.hp = Math.max(0, p.hp - 25)
        if (p.hp <= 0) {
          p.is_alive = false
          await handleDeath(supabase, campaignId, p, 5)
          await say(client, channel, `@${p.username} (${getDisplayName(p.username, p)}) is overwhelmed by the undead army! Permadeath.`)
        } else {
          await say(client, channel, `@${p.username} (${getDisplayName(p.username, p)}) — ${p.hp} HP remaining.`)
        }
      }
      await delay(2000)
    }

    if (zulkirjaxHp <= 0) break
    if (!alive.some(p => p.is_alive)) break

    // Phase 1 → Phase 2 transition at 200 HP
    if (zulkirjaxHp <= Math.ceil(200 * diffMod.hpMod) && !inPhase2) {
      inPhase2 = true
      await say(client, channel,
        `The phylactery blazes. Zulkir Jax stops. ` +
        `"Adequate. You have done adequate damage. Let me show you what adequate means." ` +
        `⚡ PHASE 2 BEGINS — The Phylactery Pulse activates.`
      )
      await delay(3000)
    }

    // Zulkirjax attacks
    const monsterRoll = d20()
    const monsterHit = monsterRoll + 15 > 12
    if (monsterHit) {
      const dmg = roll(dmgMin, dmgMax)
      const target = pickRandom(alive.filter(p => p.is_alive))
      if (target) {
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel, `Zulkirjax strikes @${target.username} (${getDisplayName(target.username, target)}) for ${dmg} damage! (${target.hp} HP remaining)`)
        await delay(1200)

        // Undead specials — 45% chance in phase 1, 55% in phase 2
        const specialChance = inPhase2 ? 55 : 45
        if (Math.floor(Math.random() * 100) + 1 <= specialChance) {
          const specials = ['level_drain', 'fear', 'paralysis', 'necrotic_fire']
          const special = specials[Math.floor(Math.random() * specials.length)]
          const { applyUndeadSpecial } = await import('../lib/undeadSpecials')
          const { data: charData } = await supabase.from('characters').select('hp, max_hp, gold, xp, level').eq('twitch_username', target.username).single()
          if (charData) {
            const result = await applyUndeadSpecial(target.username, [special as any], 100, charData)
            if (result) {
              await say(client, channel, result.message)
              if (result.hpDrain > 0) target.hp = Math.max(0, target.hp - result.hpDrain)
            }
          }
        }

        if (target.hp <= 0) {
          target.is_alive = false
          await handleDeath(supabase, campaignId, target, 5)
          await say(client, channel, `@${target.username} (${getDisplayName(target.username, target)}) has fallen! Permadeath — they are out of the campaign.`)
        }
      }
    } else {
      await say(client, channel, `Zulkir Jax gestures and the attack passes through empty air. He seems mildly interested in this development.`)
    }

    // Phylactery Pulse — fires once in phase 2 when HP would reach 0
    if (inPhase2 && zulkirjaxHp <= 0 && !pulseFired) {
      pulseFired = true
      zulkirjaxHp = Math.ceil(200 * diffMod.hpMod)
      await say(client, channel,
        `THE PHYLACTERY PULSES. The killing blow lands. Zulkir Jax stops. ` +
        `The cold light from the phylactery floods the room. His wounds close. ` +
        `"Interesting. You actually did it. No one has ever actually done it." ` +
        `He looks at the phylactery. Back at the party. ` +
        `"That was the one. You have to do it again. I am, genuinely, curious if you can." ` +
        `Zulkir Jax resets to 200 HP. The phylactery is cracked but not broken.`
      )
      await delay(4000)
    }

    round++
    if (round > 15) {
      zulkirjaxHp = 0
      await say(client, channel, `Zulkir Jax is overwhelmed. "Well. That is unexpected." He falls.`)
    }
    await delay(1500)
  }

  return { survivors: alive.filter(p => p.is_alive), defeated: alive.filter(p => !p.is_alive) }
}

// ------------------------------------------------------------
// Main campaign runner
// ------------------------------------------------------------

async function runNamedCampaign(
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
  await supabase.from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', campaignId)

  for (const stage of stages.sort((a, b) => a.stage - b.stage)) {
    const alive = participants.filter(p => p.is_alive)
    if (alive.length === 0) break

    if (stage.stage > 1) {
      await delay(3000)
      await restShrine(client, supabase, channel, campaignId, stage, participants)
      await delay(2000)
      if (stage.stage === campaignData.yvannis_stage) { await summonYvannis(client, supabase, channel, campaignId, stage.stage, participants); await delay(1500) }
    }

    await supabase.from('campaigns').update({ stage: stage.stage }).eq('id', campaignId)

    // Convergence spawn
    let convergenceSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!convergenceSpawned && await checkConvergenceSpawn(supabase, p.username)) { convergenceSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants); break }
    }

    // Spirit spawn
    let spiritSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!spiritSpawned && await checkSpiritSpawn(supabase, p.username)) { spiritSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, SPIRIT_SPAWN_POOL); break }
    }

    // Mist spawn
    let mistSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!mistSpawned && await checkMistSpawn(supabase, p.username)) { mistSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, MIST_SPAWN_POOL, `The Mists tear open. Something from Darkon has followed ${p.username} through the crack.`); break }
    }

    // Athas spawn
    let athasSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!athasSpawned && await checkAthasSpawn(supabase, p.username)) { athasSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, ATHAS_SPAWN_POOL, `A templar's mark activates. Something from Nibenay has followed ${p.username} here.`); break }
    }

    // Whisper spawn
    let whisperSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!whisperSpawned && await checkWhisperSpawn(supabase, p.username)) { whisperSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, WHISPER_SPAWN_POOL, `The Brazier of Cinder Voices hums in ${p.username}'s possession. Something answers.`); break }
    }

    // Dragonlance spawn
    let dragonlanceSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!dragonlanceSpawned && await checkDragonlanceSpawn(supabase, p.username)) { dragonlanceSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, DRAGONLANCE_SPAWN_POOL, `The war that would not end has found ${p.username}. Remnants of the Dragonarmy emerge.`); break }
    }

    // Greyhawk spawn
    let greyhawkSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!greyhawkSpawned && await checkGreyhawkSpawn(supabase, p.username)) { greyhawkSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, GREYHAWK_SPAWN_POOL, `The network Iuz built is still functional. One of its agents has found ${p.username}.`); break }
    }

    // Forgotten Realms spawn
    let forgottenRealmsSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!forgottenRealmsSpawned && await checkForgottenRealmsSpawn(supabase, p.username)) { forgottenRealmsSpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, FORGOTTEN_REALMS_SPAWN_POOL, `The ledger of Bane is still active. A mark-bound agent has found ${p.username}.`); break }
    }

    // Thay spawn
    let thaySpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!thaySpawned && await checkThaySpawn(supabase, p.username)) { thaySpawned = true; await runElementalSpawn(client, supabase, channel, campaignId, p.username, participants, THAY_SPAWN_POOL, `The mark of the Lich King activates. One of Zulkir Jax's agents has found ${p.username}.`); break }
    }

    let result: { survivors: Participant[]; defeated: Participant[] }

    if (campaignData.slug === 'the-lich-king-of-thay' && stage.stage === 5) {
      result = await runZulkirjaxFight(client, supabase, channel, campaignId, participants, diffMod)
    } else {
      result = await runNamedStage(client, supabase, channel, campaignId, stage, participants, diffMod)
    }

    for (const p of result.survivors) {
      p.stage_reached = stage.stage
      await supabase.from('campaign_participants').update({ hp: p.hp, stage_reached: stage.stage }).eq('campaign_id', campaignId).eq('username', p.username)
    }

    if (result.survivors.length === 0) {
      await say(client, channel, `All adventurers have fallen in ${campaignData.name}. The daily cooldown is spent.`)
      await supabase.from('campaigns').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', campaignId)
      return
    }

    await say(client, channel, `Stage ${stage.stage} — ${stage.stage_name} — cleared! Survivors: ${result.survivors.map(p => `@${p.username} (${getDisplayName(p.username, p)})`).join(', ')}`)
    await delay(2000)
  }

  const survivors = participants.filter(p => p.is_alive)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `The final chamber stands before you. The moment of decision has arrived.`)
  await delay(3000)

  const chosenOutcome = await runEndingVote(client, channel, survivors, outcomes)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `${survivors.map(p => `@${p.username} (${getDisplayName(p.username, p)})`).join(', ')} chose: ${chosenOutcome.outcome_label}`)
  await delay(1500)
  await say(client, channel, chosenOutcome.flavor_text)
  await delay(3000)

  await writeConsequences(supabase, campaignId, participants, chosenOutcome, campaignData.slug)

  // Outcome-specific announcements
  if (chosenOutcome.outcome_key === 'spread') {
    await writeSpreadDifficulty(supabase, channel, campaignId)
    await say(client, channel, `The corruption spreads. Future campaigns will be harder.`)
  } else if (chosenOutcome.outcome_key === 'stabilize') {
    await say(client, channel, `The Crystal is stabilized — but something lingers. All participants suffer a -20% to hit chance until cleansed. Use !cleric to seek aid.`)
  } else if (chosenOutcome.outcome_key === 'take_control') {
    await say(client, channel, `Power yields to your will. A title is yours. But something watches.`)
  } else if (chosenOutcome.outcome_key === 'use_seal') {
    await say(client, channel, `The Seal is yours. The power is real. So is the cost.`)
  } else if (chosenOutcome.outcome_key === 'destroy_seal') {
    await say(client, channel, `The Seal is destroyed. Something old exhales. The elemental planes remember.`)
  } else if (chosenOutcome.outcome_key === 'return_seal') {
    await say(client, channel, `The Seal is returned. The genie courts remember your name.`)
  } else if (chosenOutcome.outcome_key === 'sacrifice_empire') {
    await say(client, channel, `The Engine is gone. Xaryxis dims. Your world lives. The starfire mark burns in all who made this choice.`)
  } else if (chosenOutcome.outcome_key === 'continue_cycle') {
    await say(client, channel, `The Engine runs on. Another world pays the price. The machine remembers its servants.`)
  } else if (chosenOutcome.outcome_key === 'rewrite_system') {
    await say(client, channel, `The Engine is different now. Those who reached into it carry its mark.`)
  } else if (chosenOutcome.outcome_key === 'devil_victory') {
    await say(client, channel, `The Gem passes to infernal hands. The Iron City's ledger now includes your name.`)
  } else if (chosenOutcome.outcome_key === 'demonic_chaos') {
    await say(client, channel, `The Gem is gone. The Blood War tears wider. The Abyss does not forget who opened the door.`)
  } else if (chosenOutcome.outcome_key === 'balance_preserved') {
    await say(client, channel, `The Gem is hidden. The war continues — contained. The planes take note.`)
  } else if (chosenOutcome.outcome_key === 'power_seized') {
    await say(client, channel, `You kept it. Both devils and demons now know your name.`)
  } else if (chosenOutcome.outcome_key === 'restore_azalin') {
    await say(client, channel, `Azalin is whole again. Darkon stabilizes. He looks at you the way a collector looks at something rare.`)
  } else if (chosenOutcome.outcome_key === 'destroy_azalin') {
    await say(client, channel, `The phylactery breaks. Darkon tears at the seams. You find a way through. It is not clean.`)
  } else if (chosenOutcome.outcome_key === 'exploit_curse') {
    await say(client, channel, `You slipped through. You are out. The Mists remember the crack you used.`)
  } else if (chosenOutcome.outcome_key === 'replace_darklord') {
    await say(client, channel, `Someone stepped into the space Azalin left. The cycle does not end. It just has a new name.`)
  } else if (chosenOutcome.outcome_key === 'save_the_city') {
    await say(client, channel, `The ritual holds. Nibenay endures. The Crescent Forest finishes dying. The ash remembers.`)
  } else if (chosenOutcome.outcome_key === 'break_the_ritual') {
    await say(client, channel, `The nexus collapses. The forest breathes again. The city will make you pay for it.`)
  } else if (chosenOutcome.outcome_key === 'balance_the_drain') {
    await say(client, channel, `Both the city and the wilds survive — weakened. On Athas, that is enough.`)
  } else if (chosenOutcome.outcome_key === 'seize_power') {
    await say(client, channel, `You take the nexus. Every faction on Athas now has a stake in what happens to you.`)
  } else if (chosenOutcome.outcome_key === 'purified_flame') {
    await say(client, channel, `The Brazier breaks. Durastoran ends. The Silver Flame steadies. The mark fades. Not gone. Faded.`)
  } else if (chosenOutcome.outcome_key === 'corrupted_faith') {
    await say(client, channel, `The Brazier stays. The whispers are still warm. Paranoia spreads. The party is part of it now.`)
  } else if (chosenOutcome.outcome_key === 'fractured_balance') {
    await say(client, channel, `Bel Shalor remains bound — but the binding is looser. The Church splits. Something is watching.`)
  } else if (chosenOutcome.outcome_key === 'break_the_tyrant') {
    await say(client, channel, `Ariakas falls. Verminaard falls. Krynn avoids a second great war. The party carries what it cost. The burden does not lift.`)
  } else if (chosenOutcome.outcome_key === 'cycle_continues') {
    await say(client, channel, `Ariakas falls. But the system he built does not. The war is in you now. You will feel it.`)
  } else if (chosenOutcome.outcome_key === 'seize_control') {
    await say(client, channel, `You take the system. The armies obey. You tell yourself it is temporary. Ariakas told himself the same thing.`)
  } else if (chosenOutcome.outcome_key === 'submit_to_order') {
    await say(client, channel, `Ariakas wins. The war ends. Krynn is unified. Peace exists. The party will have a great deal of time to think about what they chose.`)
    // ── The Smiling Tyrant ─────────────────────────────────────
  } else if (chosenOutcome.outcome_key === 'expose_the_truth') {
    await say(client, channel,
      `You told people what happened. All of it. The reaction is not gratitude — it is chaos. ` +
      `Eventually, resistance becomes possible again. The chaos you caused follows you. ` +
      `It was worth it. You carry both.`
    )
  } else if (chosenOutcome.outcome_key === 'cut_the_head') {
    await say(client, channel,
      `Iuz is defeated. The network is not. It was built to survive exactly this. ` +
      `The corruption continues in subtler forms. You won. The system outlived the tyrant.`
    )
  } else if (chosenOutcome.outcome_key === 'control_the_system') {
    await say(client, channel,
      `You take the network. Stability returns, because you are now the one managing the instability. ` +
      `You are smiling. You did not notice when that started.`
    )
  } else if (chosenOutcome.outcome_key === 'zulkirjax_failure') {
    await say(client, channel,
      `Zulkir Jax wins, which is to say Zulkir Jax continues. ` +
      `The party survives because he allows it. Witnesses are useful. ` +
      `Thay expands. The letters start arriving in other cities. ` +
      `The party knows exactly how it was built. They were there.`
    )
  } else if (chosenOutcome.outcome_key === 'break_the_tyranny') {
    await say(client, channel,
      `The system collapses. Not cleanly. The streets that were controlled are now chaotic. ` +
      `Freedom is real. It is also fragile. Some people are looking at the chaos and remembering when things worked. ` +
      `You broke it. The chaos follows you.`
    )
  } else if (chosenOutcome.outcome_key === 'controlled_order') {
    await say(client, channel,
      `Fzoul is defeated but the system survives. Partially. ` +
      `The streets are still clean. The ledgers are still running. ` +
      `The people who live here are safe, in the way that things in a cage are safe. ` +
      `The cage will be in touch.`
    )
  } else if (chosenOutcome.outcome_key === 'serve_the_tyrant') {
    await say(client, channel,
      `You take the Scepter. The system is yours now — the ledgers, the marks, the network. ` +
      `Bane's will continues through different hands. ` +
      `The ledger notes that this entry appears in every succession of power it has recorded.`
    )
  } else if (chosenOutcome.outcome_key === 'tyranny_triumphant') {
    await say(client, channel,
      `Fzoul succeeds. The system expands as designed. ` +
      `Zhentil Keep becomes a model. Other cities begin receiving advisors. ` +
      `The advisors bring ledgers. The ledgers bring marks. The marks bring order.`
    )
  // ── The Lich King of Thay ─────────────────────────────────────
  } else if (chosenOutcome.outcome_key === 'defeat_the_lich') {
  await say(client, channel,
    `The phylactery breaks. Zulkir Jax does not go quietly. ` +
    `Thay without a Zulkir is not peaceful — it is a power vacuum the size of a nation. ` +
    `The party walks out through a city that does not know yet what happened. ` +
    `The chaos follows them. It will for a while.`
  )
} else if (chosenOutcome.outcome_key === 'submit_to_zulkirjax') {
  await say(client, channel,
    `He accepts. Not magnanimously. The mark goes on. ` +
    `It is not painful. It is worse than painful — it is comfortable. ` +
    `The party serves the Lich King of Thay. He is an excellent employer ` +
    `if you do not think too hard about the broader context.`
  )
} else if (chosenOutcome.outcome_key === 'negotiate_with_zulkirjax') {
  await say(client, channel,
    `He considers for exactly three seconds. "Interesting. You came here to kill me ` +
    `and now you want a treaty. I respect the flexibility." ` +
    `The pact is real. What the fine print implies is for the party to discover.`
  )
}

  const { titleEarned, artifactName, artWinner } = await writeNamedRewards(supabase, campaignId, participants, chosenOutcome, campaignData.slug, true)

  await supabase.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', campaignId)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel, `${campaignData.name} COMPLETE! ${survivors.map(p => `@${p.username} (${getDisplayName(p.username, p)})`).join(' & ')} emerge victorious.`)
  if (titleEarned) await say(client, channel, `Title earned: [${titleEarned}] — awarded to qualifying survivors!`)
  if (artifactName && artWinner) await say(client, channel, `Artifact: ${artifactName} — claimed by @${artWinner.username} (${getDisplayName(artWinner.username, artWinner)})!`)
  await say(client, channel, `Full clear bonus applied. Check !status for updated XP and gold.`)
}

// ------------------------------------------------------------
// Entry points
// ------------------------------------------------------------

const namedPendingJoins = new Map<string, Set<string>>()

export async function handleNamedCampaignCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  slug: string
) {
  const { data: existing } = await supabase
    .from('campaigns')
    .select('id')
    .eq('initiated_by', username)
    .gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .limit(1)
    .single()

  if (existing) {
    await say(client, channel, `@${username} You've already run a campaign today. Come back tomorrow.`)
    return
  }

  const { data: initiatorChar } = await supabase
    .from('characters')
    .select('hp')
    .eq('twitch_username', username)
    .single()

  if (!initiatorChar) {
    await say(client, channel, `@${username} You need a character to run a campaign. Use !join to create one.`)
    return
  }

  if (initiatorChar.hp <= 0) {
    await say(client, channel, `@${username} Your character is dead. Use !join to start over before running a campaign.`)
    return
  }

  const { data: campaignData } = await supabase
    .from('named_campaigns')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!campaignData) {
    await say(client, channel, `@${username} Unknown campaign: "${slug}". Use !campaigns to see available campaigns.`)
    return
  }

  await ensureClearRecord(supabase, username)

  if (slug === 'the-lich-king-of-thay') {
    const ultimateUnlocked = await checkUltimateUnlock(supabase, username)
    if (!ultimateUnlocked) {
      await say(client, channel,
        `@${username} — The Lich King of Thay requires completing all 10 standard campaigns ` +
        `AND all 10 named campaigns. Zulkirjax is not a beginning. He is an ending.`
      )
      return
    }
  } else {
    const unlocked = await checkUnlock(supabase, username, campaignData.unlock_required)
    if (!unlocked) {
      await say(client, channel,
        `@${username} You haven't earned access to this campaign yet. ` +
        `Complete ${campaignData.unlock_required} standard campaigns first with !campaign.`
      )
      return
    }
  }

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
      `@${username} calls for a named campaign: ${campaignData.name} (${campaignData.setting})! ` +
      `Type !solo to run alone or !party to form a group (60 seconds to gather).`
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

    const { data: initiatorHp } = await supabase
      .from('characters')
      .select('hp, max_hp')
      .eq('twitch_username', username)
      .single()

    await supabase.from('campaign_participants').insert({
      campaign_id: campaign.id,
      username,
      hp: initiatorHp?.hp ?? 100,
      max_hp: initiatorHp?.max_hp ?? 100,
    })

    if (mode === 'solo') {
      const level = initiatorHp ? (await supabase.from('characters').select('level').eq('twitch_username', username).single()).data?.level ?? 1 : 1

      await say(client, channel,
        `${username} enters ${campaignData.setting} alone. ` +
        `${bossName} waits at the end. ⚠️ Scaled for Level ${level}.`
      )

    } else {
      const joiners = new Set<string>([username])
      namedPendingJoins.set(channel, joiners)

      await say(client, channel,
        `Party forming for ${campaignData.name}! ` +
        `Type !joincamp to join. Window closes in 60 seconds. ${username} is already in.`
      )

      await delay(JOIN_WINDOW_MS)
      namedPendingJoins.delete(channel)

      for (const joiner of joiners) {
        if (joiner !== username) {
          const { data: joinerHp } = await supabase
            .from('characters')
            .select('hp, max_hp')
            .eq('twitch_username', joiner)
            .single()

          await supabase.from('campaign_participants').insert({
            campaign_id: campaign.id,
            username: joiner,
            hp: joinerHp?.hp ?? 100,
            max_hp: joinerHp?.max_hp ?? 100,
          })
        }
      }

      const levelResults = await Promise.all(
        [...joiners].map(j =>
          supabase
            .from('characters')
            .select('level')
            .eq('twitch_username', j)
            .single()
            .then(({ data }) => data?.level ?? 1)
        )
      )
      const minLevel = Math.min(...levelResults)
      const maxLevel = Math.max(...levelResults)
      const levelRange = minLevel === maxLevel
        ? `Level ${minLevel}`
        : `Levels ${minLevel}–${maxLevel}`

      await say(client, channel,
        `The party is set: ${[...joiners].join(', ')}. Entering ${campaignData.setting}. ` +
        `${bossName} awaits. ⚠️ Scaled for ${levelRange}.`
      )
    }

    await delay(2000)

    const { data: participantsData } = await supabase
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', campaign.id)

    const participants = (participantsData ?? []) as Participant[]
    await enrichParticipantsWithNames(supabase, participants)

    await runNamedCampaign(
      client, supabase, channel,
      campaign.id, campaignData as NamedCampaign,
      stages, outcomes, participants
    )

  } catch (err) {
    console.error('[named_campaign] error:', err)
    await say(client, channel, `@${username} Something went wrong starting the campaign.`)
  }
}

export async function handleNamedJoinCamp(
  client: Client,
  channel: string,
  username: string
): Promise<boolean> {
  const joiners = namedPendingJoins.get(channel)
  if (!joiners) return false

  const { data: joinerChar } = await supabase
    .from('characters')
    .select('hp')
    .eq('twitch_username', username)
    .single()

  if (!joinerChar || joinerChar.hp <= 0) {
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

    const handler = (
      _chan: string,
      tags: Record<string, unknown>,
      message: string
    ) => {
      if (tags['username']?.toString().toLowerCase() !== username.toLowerCase()) return
      const msg = message.trim().toLowerCase()
      if (msg === '!solo' || msg === '!party') {
        clearTimeout(timeout)
        client.removeListener('message', handler)
        resolve(msg === '!solo' ? 'solo' : 'party')
      }
    }

    client.on('message', handler)
  })
}