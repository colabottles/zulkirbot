// ============================================================
// ZulkirBot: Named Campaign Handler
// ============================================================
// Handles named campaign lifecycle:
//   unlock check → initiation → solo/party prompt →
//   join window → stage loop → rest shrine → boss fight →
//   ending vote → consequence writes → reward distribution
//
// Campaigns housed in this file:
//   - Mystara (original)
//   - Al-Qadim (original)
//   - Ashes of Xaryxis (Spelljammer)
//   - Embers of the Second War (Planescape)
//   - The Shattered Memory of Darkon (Ravenloft)
// ============================================================

import { Client } from 'tmi.js'
import { supabase } from './../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js'
import { summonYvannis, rollYvannisStage } from './cleric'

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

// Darkon Mist spawn pool (mist_marked consequence)
export const MIST_SPAWN_POOL: ElementalSpawn[] = [
  { name: 'Mist Wraith', hp: 55, damage_min: 10, damage_max: 18 },
  { name: 'Memory Shade', hp: 60, damage_min: 11, damage_max: 17 },
  { name: 'Darkon Phantom', hp: 50, damage_min: 12, damage_max: 19 },
  { name: 'Lost Soul of Darkon', hp: 65, damage_min: 9, damage_max: 16 },
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

    // Stabilize: passive hit penalty, no trigger message needed

    // Shadow Marked: assassin
    if (flag.flag_type === 'shadow_marked' && flag.trigger_ready) {
      await say(client, channel,
        `🗡️  @${username} — A figure dressed in Shadow Elf grey steps from the dark. ` +
        `No words. No warning. The blade finds its mark before you can react. ` +
        `${username} has been killed by an assassin of the Shadow Elf god. ` +
        `Their story ends here.`
      )
      await supabase
        .from('characters')
        .update({ hp: 0, is_dead: true })
        .eq('twitch_username', username)
      await supabase
        .from('player_consequence_flags')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('id', flag.id)
      return
    }

    // Crystal Control: madness
    if (flag.flag_type === 'crystal_control' && flag.trigger_ready && !flag.madness_triggered) {
      if (Math.random() <= 0.40) {
        await triggerMadness(client, supabase, channel, username, flag.id)
      }
    }

    // Seal Bound: gold drain
    if (flag.flag_type === 'seal_bound' && flag.trigger_ready && !flag.seal_triggered) {
      const { data: char } = await supabase
        .from('characters')
        .select('gold')
        .eq('twitch_username', username)
        .single()

      if (char && char.gold > 0) {
        const drain = Math.floor(char.gold * 0.30)
        await supabase
          .from('characters')
          .update({ gold: char.gold - drain })
          .eq('twitch_username', username)
        await say(client, channel,
          `🔥 @${username} — The Seal tightens its hold. ` +
          `The binding scripts burn beneath your skin and ${drain}g slips from your purse ` +
          `into nothing. The Seal takes what it is owed.`
        )
        await supabase
          .from('player_consequence_flags')
          .update({ seal_triggered: true })
          .eq('id', flag.id)
      }
    }

    // Genie Debt: noble demand
    if (flag.flag_type === 'genie_debt' && flag.trigger_ready && !flag.debt_triggered) {
      const { data: char } = await supabase
        .from('characters')
        .select('gold, hp, max_hp')
        .eq('twitch_username', username)
        .single()

      if (char) {
        const goldCost = Math.floor(char.gold * 0.25)
        const hpCost = Math.floor(char.max_hp * 0.20)

        if (char.gold >= goldCost && goldCost > 0) {
          await supabase
            .from('characters')
            .update({ gold: char.gold - goldCost })
            .eq('twitch_username', username)
          await say(client, channel,
            `🌪️  @${username} — A figure of smoke and amber light steps from the shadows. ` +
            `"The genie courts remember the debt." ` +
            `${goldCost}g lifts from your purse and dissolves into the air. ` +
            `The figure bows once and is gone.`
          )
        } else {
          const newHp = Math.max(1, char.hp - hpCost)
          await supabase
            .from('characters')
            .update({ hp: newHp, max_hp: char.max_hp - hpCost })
            .eq('twitch_username', username)
          await say(client, channel,
            `🌪️  @${username} — A figure of smoke and amber light steps from the shadows. ` +
            `"The genie courts remember the debt. Gold you do not have." ` +
            `It reaches through you instead. Your max HP is reduced by ${hpCost}. ` +
            `Pay the debt in a future Al-Qadim campaign to restore what was taken.`
          )
        }

        await supabase
          .from('player_consequence_flags')
          .update({ debt_triggered: true })
          .eq('id', flag.id)
      }
    }

    // Mandate Restored: celestial auditor
    if (flag.flag_type === 'mandate_restored' && flag.trigger_ready && !flag.mandate_triggered) {
      await triggerCelestialAudit(client, supabase, channel, username, flag.id)
    }

    // Mandate Reforged: boon or burden
    if (flag.flag_type === 'mandate_reforged' && flag.trigger_ready && !flag.mandate_triggered) {
      await triggerMandateReforged(
        client, supabase, channel, username, flag.id,
        flag.mandate_boon ?? true
      )
    }

    // Celestial Debt: court calls in favor
    if (flag.flag_type === 'celestial_debt' && flag.trigger_ready && !flag.celestial_triggered) {
      await triggerCelestialDebt(client, supabase, channel, username, flag.id)
    }

    // ── Ashes of Xaryxis ─────────────────────────────────────

    if (flag.flag_type === 'starfire_marked' && flag.trigger_ready && !flag.starfire_triggered) {
      await triggerStarfireMark(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'cycle_bound' && flag.trigger_ready && !flag.cycle_triggered) {
      await triggerCycleBound(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'engine_forged' && flag.trigger_ready && !flag.engine_triggered) {
      await triggerEngineForged(client, supabase, channel, username, flag.id)
    }

    // ── Embers of the Second War ──────────────────────────────

    if (flag.flag_type === 'infernal_marked' && flag.trigger_ready && !flag.infernal_triggered) {
      await triggerInfernalMarked(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'abyssal_touched' && flag.trigger_ready && !flag.abyssal_triggered) {
      await triggerAbyssalTouched(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'planar_witness' && flag.trigger_ready && !flag.witness_triggered) {
      await triggerPlanarWitness(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'gem_bound' && flag.trigger_ready && !flag.gem_triggered) {
      await triggerGemBound(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'iron_manacles_blight' && flag.trigger_ready && !flag.blight_triggered) {
      await triggerManaclesBlight(client, supabase, channel, username, flag.id)
    }

    // ── The Shattered Memory of Darkon ────────────────────────

    if (flag.flag_type === 'domain_bound' && flag.trigger_ready && !flag.domain_triggered) {
      await triggerDomainBound(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'curse_shattered' && flag.trigger_ready && !flag.shatter_triggered) {
      await triggerCurseShattered(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'mist_marked' && flag.trigger_ready && !flag.mist_triggered) {
      await triggerMistMarked(client, supabase, channel, username, flag.id)
    }

    if (flag.flag_type === 'darklord_echo' && flag.trigger_ready && !flag.darklord_triggered) {
      await triggerDarklordEcho(client, supabase, channel, username, flag.id)
    }
  }
}

// ------------------------------------------------------------
// Convergence / spirit / mist spawn checks
// ------------------------------------------------------------

export async function checkConvergenceSpawn(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { data: flag } = await supabase
    .from('player_consequence_flags')
    .select('id')
    .eq('username', username)
    .eq('flag_type', 'convergence_marked')
    .eq('is_active', true)
    .single()

  if (!flag) return false
  return Math.random() < 0.20
}

export async function checkSpiritSpawn(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { data: flag } = await supabase
    .from('player_consequence_flags')
    .select('id')
    .eq('username', username)
    .eq('flag_type', 'mandate_shattered')
    .eq('is_active', true)
    .single()

  if (!flag) return false
  return Math.random() < 0.15
}

export async function checkMistSpawn(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { data: flag } = await supabase
    .from('player_consequence_flags')
    .select('id')
    .eq('username', username)
    .eq('flag_type', 'mist_marked')
    .eq('is_active', true)
    .single()

  if (!flag) return false
  return Math.random() < 0.20
}

// ------------------------------------------------------------
// Madness trigger (Mystara / crystal_control)
// ------------------------------------------------------------

async function triggerMadness(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const madnessRoll = roll(1, 6)

  const { data: outcome } = await supabase
    .from('madness_outcomes')
    .select('*')
    .eq('roll', madnessRoll)
    .single()

  if (!outcome) return

  const description = outcome.description.replace('{username}', `@${username}`)
  await say(client, channel,
    `🌀 THE CRYSTAL STIRS — @${username}'s mind fractures! ${description}`
  )

  switch (outcome.effect_type) {
    case 'destroy_item': {
      const { data: items } = await supabase
        .from('inventory')
        .select('id, item_name')
        .eq('twitch_username', username)
        .limit(20)
      if (items && items.length > 0) {
        const target = pickRandom(items)
        await supabase.from('inventory').delete().eq('id', target.id)
        await say(client, channel,
          `💔 ${target.item_name} crumbles to dust in @${username}'s hands.`
        )
      }
      break
    }
    case 'drop_gold': {
      const { data: char } = await supabase
        .from('characters')
        .select('gold')
        .eq('twitch_username', username)
        .single()
      if (char && char.gold > 0) {
        await supabase
          .from('characters')
          .update({ gold: 0 })
          .eq('twitch_username', username)
        await say(client, channel,
          `💸 @${username} has lost all ${char.gold}g to the madness.`
        )
      }
      break
    }
    case 'flee': {
      await say(client, channel,
        `🏃 @${username} flees into the dark. They do not return.`
      )
      break
    }
    default:
      break
  }

  await supabase
    .from('player_consequence_flags')
    .update({ madness_triggered: true })
    .eq('id', flagId)
}

// ------------------------------------------------------------
// Celestial audit trigger (Al-Qadim / mandate_restored)
// ------------------------------------------------------------

export async function triggerCelestialAudit(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('gold, hp, max_hp, kill_count')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  if ((char.kill_count ?? 0) < 50) {
    await supabase
      .from('player_consequence_flags')
      .update({ mandate_triggered: true })
      .eq('id', flagId)
    return
  }

  const baseFine = Math.floor(char.gold * 0.35)
  const harshFine = Math.floor(char.gold * 0.50)
  const lenientFine = Math.floor(char.gold * 0.40)
  const hpCost = Math.floor(char.max_hp * 0.20)

  await client.say(channel,
    `📜 @${username} — A figure in formal grey robes steps from nowhere. ` +
    `It unrolls a scroll. The scroll is very long. ` +
    `"The Court has reviewed your record. ${char.kill_count} registered actions of terminal force. " ` +
    `"The balance tax is assessed at ${baseFine}g. " ` +
    `"Type !pay to settle or !dispute to contest. You have 60 seconds."`
  )

  const response = await waitForAuditResponse(client, channel, username, 60_000)

  if (response === 'pay') {
    if (char.gold >= baseFine && baseFine > 0) {
      await supabase
        .from('characters')
        .update({ gold: char.gold - baseFine })
        .eq('twitch_username', username)
      await client.say(channel,
        `📜 @${username} — The figure makes a note. "Payment received. The Court is satisfied." ` +
        `The scroll rolls itself back up. ${baseFine}g deducted. Balance: ${char.gold - baseFine}g.`
      )
    } else {
      const newHp = Math.max(1, char.hp - hpCost)
      await supabase
        .from('characters')
        .update({ hp: newHp, max_hp: char.max_hp - hpCost })
        .eq('twitch_username', username)
      await client.say(channel,
        `📜 @${username} — "Insufficient funds. The Court accepts an alternative settlement." ` +
        `Your max HP is reduced by ${hpCost}. The figure makes a note and departs.`
      )
    }

  } else if (response === 'dispute') {
    const ruling = Math.random() < 0.50

    if (ruling) {
      await client.say(channel,
        `📜 @${username} — The figure pauses. Consults a second scroll. ` +
        `"The Court finds merit in the objection. Fine waived — this cycle." ` +
        `"Note added to record. Future assessments will reflect this appeal." ` +
        `The fine is waived. Future audits will cost ${lenientFine}g instead of ${baseFine}g — ` +
        `but they will come.`
      )
      await supabase
        .from('player_consequence_flags')
        .update({ mandate_triggered: false })
        .eq('id', flagId)
      return

    } else {
      const actualFine = char.gold >= harshFine ? harshFine : char.gold
      await supabase
        .from('characters')
        .update({ gold: char.gold - actualFine })
        .eq('twitch_username', username)
      await client.say(channel,
        `📜 @${username} — The figure does not look up from the scroll. ` +
        `"Objection noted. Objection overruled. Fine increased for procedural waste." ` +
        `${harshFine}g deducted. The Court's patience is not infinite.`
      )
    }

  } else {
    const contemptFine = Math.floor(char.gold * 0.45)
    const actualFine = char.gold >= contemptFine ? contemptFine : char.gold
    await supabase
      .from('characters')
      .update({ gold: char.gold - actualFine })
      .eq('twitch_username', username)
    await client.say(channel,
      `📜 @${username} — Silence. The figure makes a note without looking up. ` +
      `"Non-responsive. Contempt assessed." ` +
      `${contemptFine}g deducted automatically. The Court does not wait.`
    )
  }

  await supabase
    .from('player_consequence_flags')
    .update({ mandate_triggered: true })
    .eq('id', flagId)
}

function waitForAuditResponse(
  client: Client,
  channel: string,
  username: string,
  windowMs: number
): Promise<'pay' | 'dispute' | 'none'> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.removeListener('message', handler)
      resolve('none')
    }, windowMs)

    const handler = (
      _chan: string,
      tags: Record<string, unknown>,
      message: string
    ) => {
      if (tags['display-name']?.toString().toLowerCase() !== username.toLowerCase()) return
      const msg = message.trim().toLowerCase()
      if (msg === '!pay' || msg === '!dispute') {
        clearTimeout(timeout)
        client.removeListener('message', handler)
        resolve(msg === '!pay' ? 'pay' : 'dispute')
      }
    }

    client.on('message', handler)
  })
}

async function triggerMandateReforged(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string,
  isBoon: boolean
) {
  const { data: char } = await supabase
    .from('characters')
    .select('hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  if (isBoon) {
    await supabase
      .from('characters')
      .update({ max_hp: char.max_hp + 20, hp: char.hp + 20 })
      .eq('twitch_username', username)
    await client.say(channel,
      `✨ @${username} — The reforged Mandate stirs. Something in the new order ` +
      `recognizes what you did. Your max HP is permanently increased by 20.`
    )
  } else {
    const newHp = Math.max(1, char.hp - 20)
    await supabase
      .from('characters')
      .update({ max_hp: char.max_hp - 20, hp: newHp })
      .eq('twitch_username', username)
    await client.say(channel,
      `🌀 @${username} — The reforged Mandate stirs. The new order is still finding ` +
      `its shape. Some of the cost falls on those who made it. ` +
      `Your max HP is permanently reduced by 20.`
    )
  }

  await supabase
    .from('player_consequence_flags')
    .update({ mandate_triggered: true })
    .eq('id', flagId)
}

async function triggerCelestialDebt(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  const { data: char } = await supabase
    .from('characters')
    .select('gold, hp, max_hp')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const tithe = Math.floor(char.gold * 0.20)
  const hpCost = Math.floor(char.max_hp * 0.20)

  await client.say(channel,
    `🌟 @${username} — A column of pale light opens. A voice — formal, unhurried, enormous — speaks. ` +
    `"The Court calls in its debt. A tithe of ${tithe}g is requested in acknowledgment of services rendered." ` +
    `Type !pay to comply willingly (gain +10% XP for 5 campaigns) or ignore to have the tithe taken automatically.`
  )

  const response = await waitForAuditResponse(client, channel, username, 60_000)

  if (response === 'pay' && char.gold >= tithe) {
    await supabase
      .from('characters')
      .update({ gold: char.gold - tithe })
      .eq('twitch_username', username)
    await client.say(channel,
      `🌟 @${username} — "Compliance noted. The Court is pleased." ` +
      `${tithe}g tithed. The Court grants a blessing: +10% XP on your next 5 campaigns.`
    )
  } else {
    if (char.gold >= tithe && tithe > 0) {
      await supabase
        .from('characters')
        .update({ gold: char.gold - tithe })
        .eq('twitch_username', username)
      await client.say(channel,
        `🌟 @${username} — The light dims. "The tithe is collected." ` +
        `${tithe}g removed. No blessing is granted for reluctant payment.`
      )
    } else {
      const newHp = Math.max(1, char.hp - hpCost)
      await supabase
        .from('characters')
        .update({ hp: newHp, max_hp: char.max_hp - hpCost })
        .eq('twitch_username', username)
      await client.say(channel,
        `🌟 @${username} — "Insufficient funds. The Court accepts vitality in lieu of gold." ` +
        `Your max HP is reduced by ${hpCost}.`
      )
    }
  }

  await supabase
    .from('player_consequence_flags')
    .update({ celestial_triggered: true })
    .eq('id', flagId)
}

// ------------------------------------------------------------
// Ashes of Xaryxis consequence triggers
// ------------------------------------------------------------

async function triggerStarfireMark(
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

  const drain = Math.floor(char.max_hp * 0.12)
  const newHp = Math.max(1, char.hp - drain)

  await supabase
    .from('characters')
    .update({ hp: newHp })
    .eq('twitch_username', username)

  await say(client, channel,
    `⭐ @${username} — Xaryxis is still dying. You can feel it from here. ` +
    `The starfire mark burns cold beneath your skin and takes ${drain} HP. ` +
    `(${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ starfire_triggered: true })
    .eq('id', flagId)
}

async function triggerCycleBound(
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
      `⚙️  @${username} — The Engine's ledger updates itself. ` +
      `Somewhere in Wildspace, a world dims a little more. ` +
      `Your share of the cost: ${tithe}g. (${char.gold - tithe}g remaining)`
    )
  } else {
    const hpCost = Math.floor(char.max_hp * 0.10)
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `⚙️  @${username} — The Engine's ledger updates itself. ` +
      `You have no gold to give. It takes vitality instead. ` +
      `-${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase
    .from('player_consequence_flags')
    .update({ cycle_triggered: true })
    .eq('id', flagId)
}

async function triggerEngineForged(
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
    const bonus = roll(10, 25)
    const newHp = Math.min(char.max_hp, char.hp + bonus)
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `🔧 @${username} — The Engine hums somewhere in Wildspace. ` +
      `Whatever you changed, it's holding — for now. ` +
      `Something feeds back through the connection: +${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const debtType = Math.random() < 0.50 ? 'hp' : 'gold'
    if (debtType === 'hp') {
      const drain = roll(8, 20)
      const newHp = Math.max(1, char.hp - drain)
      await supabase
        .from('characters')
        .update({ hp: newHp })
        .eq('twitch_username', username)
      await say(client, channel,
        `🔧 @${username} — The Engine hums somewhere in Wildspace. ` +
        `Something in what you rewrote is pulling back. ` +
        `The architecture is unstable. -${drain} HP. (${newHp}/${char.max_hp})`
      )
    } else {
      const drain = Math.floor(char.gold * 0.12)
      if (drain > 0) {
        await supabase
          .from('characters')
          .update({ gold: char.gold - drain })
          .eq('twitch_username', username)
        await say(client, channel,
          `🔧 @${username} — The Engine hums somewhere in Wildspace. ` +
          `The rewrite is still settling. Something slips through the cracks: ` +
          `-${drain}g. (${char.gold - drain}g remaining)`
        )
      }
    }
  }

  await supabase
    .from('player_consequence_flags')
    .update({ engine_triggered: true, engine_boon: isBoon })
    .eq('id', flagId)
}

// ------------------------------------------------------------
// Ashes of Xaryxis stage milestone titles
// ------------------------------------------------------------

const XARYXIS_STAGE_TITLES: Record<number, string> = {
  2: 'Witness to the Dying',
  3: 'Wildspace Wanderer',
  4: 'Touched by the Engine',
  5: 'Who Stood Before the Star',
}

async function awardXaryxisStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = XARYXIS_STAGE_TITLES[stageReached]
  if (!title) return

  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'ashes-of-xaryxis' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// Embers of the Second War consequence triggers
// ------------------------------------------------------------

async function triggerInfernalMarked(
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
      `⛓️  @${username} — The ledger of Dis updates without warning. ` +
      `The Iron City remembers what you did for it. It collects. ` +
      `${tithe}g vanishes from your purse. (${char.gold - tithe}g remaining)`
    )
  } else {
    const hpCost = Math.floor(char.max_hp * 0.08)
    const newHp = Math.max(1, char.hp - hpCost)
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `⛓️  @${username} — The ledger of Dis updates without warning. ` +
      `You have no gold. The Iron City takes something else. ` +
      `-${hpCost} HP. (${newHp}/${char.max_hp} HP remaining)`
    )
  }

  await supabase
    .from('player_consequence_flags')
    .update({ infernal_triggered: true })
    .eq('id', flagId)
}

async function triggerAbyssalTouched(
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

  await supabase
    .from('characters')
    .update({ hp: newHp })
    .eq('twitch_username', username)

  await say(client, channel,
    `💀 @${username} — The Abyss does not forget the one who cracked it open. ` +
    `Something bleeds through the wound you made. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ abyssal_triggered: true })
    .eq('id', flagId)
}

async function triggerPlanarWitness(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  await say(client, channel,
    `⚖️  @${username} — The neutral powers of the planes acknowledge what you did. ` +
    `You held the line without taking a side. That is rarer than it sounds. ` +
    `+10% XP this campaign.`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ witness_triggered: true })
    .eq('id', flagId)
}

async function triggerGemBound(
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
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `💎 @${username} — The Gem of Stygian Accord pulses somewhere in your possession. ` +
      `The power is real today. +${bonus} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const debtType = Math.random() < 0.50 ? 'hp' : 'gold'
    if (debtType === 'hp') {
      const drain = roll(10, 25)
      const newHp = Math.max(1, char.hp - drain)
      await supabase
        .from('characters')
        .update({ hp: newHp })
        .eq('twitch_username', username)
      await say(client, channel,
        `💎 @${username} — The Gem of Stygian Accord pulses somewhere in your possession. ` +
        `Both sides are still looking for it. The pressure costs you. ` +
        `-${drain} HP. (${newHp}/${char.max_hp})`
      )
    } else {
      const drain = Math.floor(char.gold * 0.15)
      if (drain > 0) {
        await supabase
          .from('characters')
          .update({ gold: char.gold - drain })
          .eq('twitch_username', username)
        await say(client, channel,
          `💎 @${username} — The Gem of Stygian Accord pulses somewhere in your possession. ` +
          `Keeping it hidden has costs. -${drain}g. (${char.gold - drain}g remaining)`
        )
      }
    }
  }

  await supabase
    .from('player_consequence_flags')
    .update({ gem_triggered: true, gem_boon: isBoon })
    .eq('id', flagId)
}

async function triggerManaclesBlight(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  if (Math.random() > 0.25) return

  await say(client, channel,
    `🔥 @${username} — The Iron Manacles of Dis tighten. ` +
    `Dispater's mark burns through the metal and into your mind — ` +
    `a psionic fire that scatters thought and numbs the sword arm. ` +
    `Pain. Agony. The iron is in your skull now. ` +
    `-3 to all attacks this campaign. The manacles remember who made them.`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ blight_triggered: true, blight_attack_penalty: 3 })
    .eq('id', flagId)
}

export async function applyIronManaclesBlight(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string
) {
  await supabase
    .from('player_consequence_flags')
    .upsert({
      username,
      flag_type: 'iron_manacles_blight',
      is_active: true,
      source_campaign_slug: 'embers-of-the-second-war',
      blight_attack_penalty: 3,
      blight_triggered: false,
    }, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })

  await say(client, channel,
    `🔥 @${username} equips the Iron Manacles of Dis. ` +
    `The metal closes. Dispater's mark seals into your wrists. ` +
    `Power flows through you — and behind it, pain. ` +
    `A psionic blight settles into your mind. -3 to all attacks while equipped. ` +
    `The +5 damage bonus is real. So is the cost.`
  )
}

export async function removeIronManaclesBlight(
  supabase: SupabaseClient,
  username: string
) {
  await supabase
    .from('player_consequence_flags')
    .update({ is_active: false, resolved_at: new Date().toISOString() })
    .eq('username', username)
    .eq('flag_type', 'iron_manacles_blight')
    .eq('is_active', true)
}

// ------------------------------------------------------------
// Embers of the Second War stage milestone titles
// ------------------------------------------------------------

const EMBERS_STAGE_TITLES: Record<number, string> = {
  2: 'Walked the Iron Streets',
  3: 'Vault Breaker',
  4: 'Caught Between Hells',
  5: 'Stood in the Infernal Crucible',
}

async function awardEmbersStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = EMBERS_STAGE_TITLES[stageReached]
  if (!title) return

  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'embers-of-the-second-war' },
      { onConflict: 'username,title', ignoreDuplicates: true }
    )
}

// ------------------------------------------------------------
// Shattered Memory of Darkon consequence triggers
// ------------------------------------------------------------

// domain_bound — Darkon's memory tether (Restore Azalin)
// 35% chance per campaign entry — HP drain, the domain pulls at you
async function triggerDomainBound(
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
    `🌫️  @${username} — Darkon remembers you. You stabilized it. ` +
    `Now it holds onto you like a drowning thing holds onto whatever is close. ` +
    `A memory drains from you — not a thought, but something physical. ` +
    `-${drain} HP. (${newHp}/${char.max_hp} HP remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ domain_triggered: true })
    .eq('id', flagId)
}

// curse_shattered — backlash from the broken curse (Destroy Azalin)
// Always fires — random debuff, the curse does not end cleanly
async function triggerCurseShattered(
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

  const debtType = Math.random() < 0.50 ? 'hp' : 'gold'

  if (debtType === 'hp') {
    const drain = roll(8, 22)
    const newHp = Math.max(1, char.hp - drain)
    await supabase
      .from('characters')
      .update({ hp: newHp })
      .eq('twitch_username', username)
    await say(client, channel,
      `💥 @${username} — The curse broke. It did not break cleanly. ` +
      `Fragments of Azalin's unraveling still cling to those who were there. ` +
      `Something tears through you today. -${drain} HP. (${newHp}/${char.max_hp})`
    )
  } else {
    const drain = Math.floor(char.gold * 0.12)
    if (drain > 0) {
      await supabase
        .from('characters')
        .update({ gold: char.gold - drain })
        .eq('twitch_username', username)
      await say(client, channel,
        `💥 @${username} — The curse broke. It did not break cleanly. ` +
        `Darkon's collapse took things with it — some of them yours. ` +
        `-${drain}g lost in the unraveling. (${char.gold - drain}g remaining)`
      )
    }
  }

  await supabase
    .from('player_consequence_flags')
    .update({ shatter_triggered: true })
    .eq('id', flagId)
}

// mist_marked — the Mists remember (Exploit the Curse)
// 20% chance per stage of a Mist spawn — handled in runNamedCampaign
// This trigger fires at campaign entry as a reminder/warning
async function triggerMistMarked(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  flagId: string
) {
  await say(client, channel,
    `🌫️  @${username} — The Mists remember the crack you slipped through. ` +
    `They are looking for it again. They are looking for you. ` +
    `Something from Darkon may find you before this campaign is over.`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ mist_triggered: true })
    .eq('id', flagId)
}

// darklord_echo — the domain's hunger (Replace the Darklord)
// Always fires — heavy gold and HP toll, the domain feeds through the echo
async function triggerDarklordEcho(
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

  await supabase
    .from('characters')
    .update({ hp: newHp, gold: newGold })
    .eq('twitch_username', username)

  await say(client, channel,
    `🌑 @${username} — The domain feeds. ` +
    `Darkon does not have a Darklord anymore — but the echo of what you left behind does. ` +
    `It reaches across the planes and takes what it needs to keep existing. ` +
    `-${hpDrain} HP, -${goldDrain}g. (${newHp}/${char.max_hp} HP | ${newGold}g remaining)`
  )

  await supabase
    .from('player_consequence_flags')
    .update({ darklord_triggered: true })
    .eq('id', flagId)
}

// ------------------------------------------------------------
// Shattered Memory of Darkon stage milestone titles
// ------------------------------------------------------------

const DARKON_STAGE_TITLES: Record<number, string> = {
  2: 'Touched by the Mists',
  3: 'Who Knew the Broken King',
  4: 'Witness to Unraveling',
  5: 'Stood Before Azalin Ascendant',
}

async function awardDarkonStageMilestone(
  supabase: SupabaseClient,
  username: string,
  stageReached: number
) {
  const title = DARKON_STAGE_TITLES[stageReached]
  if (!title) return

  await supabase
    .from('player_titles')
    .upsert(
      { username, title, source: 'shattered-memory-of-darkon' },
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
  await say(client, channel, `📜 Stage ${stage.stage}/5 — ${stage.stage_name}`)
  await delay(1500)
  await say(client, channel, stage.flavor_intro)
  await delay(2500)

  const enemyHPs = Array(stage.enemy_count).fill(enemyMaxHp)
  let specialFired = false
  let round = 1

  while (enemyHPs.some(hp => hp > 0) && alive.some(p => p.is_alive)) {
    await say(client, channel, `⚔️  — Round ${round} —`)
    await delay(1500)

    // Players attack
    for (const player of alive.filter(p => p.is_alive)) {
      const targetIdx = enemyHPs.findIndex(hp => hp > 0)
      if (targetIdx === -1) break

      // Check corruption_stabilized hit penalty
      let hitPenaltyActive = false
      const { data: stabilizeFlag } = await supabase
        .from('player_consequence_flags')
        .select('hit_penalty')
        .eq('username', player.username)
        .eq('flag_type', 'corruption_stabilized')
        .eq('is_active', true)
        .single()

      if (stabilizeFlag) {
        hitPenaltyActive = Math.random() < (stabilizeFlag.hit_penalty ?? 0.20)
      }

      if (hitPenaltyActive) {
        await say(client, channel,
          `🌫️  @${player.username}'s attack wavers — the corruption interferes! Miss!`
        )
        await delay(1200)
        continue
      }

      // Check iron_manacles_blight attack penalty (-3 to damage)
      let manaclesPenalty = 0
      const { data: blightFlag } = await supabase
        .from('player_consequence_flags')
        .select('blight_attack_penalty')
        .eq('username', player.username)
        .eq('flag_type', 'iron_manacles_blight')
        .eq('is_active', true)
        .single()

      if (blightFlag) {
        manaclesPenalty = blightFlag.blight_attack_penalty ?? 3
      }

      const rawDmg = roll(12, 28)
      const dmg = Math.max(1, rawDmg - manaclesPenalty)
      enemyHPs[targetIdx] = Math.max(0, enemyHPs[targetIdx] - dmg)

      const penaltyNote = manaclesPenalty > 0
        ? ` (−${manaclesPenalty} from psionic blight)`
        : ''

      await say(client, channel,
        `🗡️  ${player.username} hits ${stage.enemy_name} for ${dmg} damage!${penaltyNote} ` +
        `(${Math.max(0, enemyHPs[targetIdx])} HP remaining)`
      )
      await delay(1200)

      if (enemyHPs[targetIdx] === 0) {
        await say(client, channel, `💥 ${stage.enemy_name} has fallen!`)
        await delay(1000)
      }
    }

    // Enemies attack back
    for (let i = 0; i < stage.enemy_count; i++) {
      if (enemyHPs[i] <= 0) continue

      if (!specialFired && round === 2 && stage.special_name) {
        if (stage.special_type === 'all') {
          const specialDmg = Math.ceil((stage.special_damage ?? 20) * diffMod.dmgMod)
          await say(client, channel,
            `⚡ ${stage.enemy_name} uses ${stage.special_name}! All party members take ${specialDmg} damage!`
          )
          for (const p of alive.filter(p => p.is_alive)) {
            p.hp = Math.max(0, p.hp - specialDmg)
            await say(client, channel, `🩸 ${p.username} — ${p.hp} HP remaining.`)
            if (p.hp <= 0) {
              p.is_alive = false
              await handleDeath(supabase, campaignId, p, stage.stage)
              await say(client, channel,
                `💀 ${p.username} has fallen! Permadeath — they are out of the campaign.`
              )
            }
          }
          specialFired = true
          await delay(2000)

        } else if (stage.special_type === 'debuff') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            await say(client, channel,
              `⚡ ${stage.enemy_name} uses ${stage.special_name}! ` +
              `${target.username}'s next attack is suppressed!`
            )
          }
          specialFired = true
          await delay(1500)

        } else if (stage.special_type === 'single') {
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            const specialDmg = Math.ceil((stage.special_damage ?? 25) * diffMod.dmgMod)
            target.hp = Math.max(0, target.hp - specialDmg)
            await say(client, channel,
              `⚡ ${stage.enemy_name} uses ${stage.special_name} on ${target.username} ` +
              `for ${specialDmg} damage! (${target.hp} HP remaining)`
            )
            if (target.hp <= 0) {
              target.is_alive = false
              await handleDeath(supabase, campaignId, target, stage.stage)
              await say(client, channel,
                `💀 ${target.username} has fallen! Permadeath — they are out of the campaign.`
              )
            }
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
          `🩸 ${stage.enemy_name} strikes ${target.username} for ${dmg} damage! ` +
          `(${target.hp} HP remaining)`
        )
        await delay(1200)

        if (target.hp <= 0) {
          target.is_alive = false
          await handleDeath(supabase, campaignId, target, stage.stage)
          await say(client, channel,
            `💀 ${target.username} has fallen! Permadeath — they are out of the campaign.`
          )
          await delay(1000)
        }
      }
    }

    round++
    if (round > 8) {
      for (let i = 0; i < enemyHPs.length; i++) enemyHPs[i] = 0
      await say(client, channel, `⚡ The enemy is overwhelmed and routed!`)
    }
    await delay(1500)
  }

  return {
    survivors: alive.filter(p => p.is_alive),
    defeated: alive.filter(p => !p.is_alive),
  }
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

  await say(client, channel, `🕯️  ${stage.shrine_flavor}`)
  await delay(2000)

  for (const p of participants.filter(p => p.is_alive)) {
    const healed = Math.min(SHRINE_HEAL_HP, p.max_hp - p.hp)
    p.hp += healed
    await supabase
      .from('campaign_participants')
      .update({ hp: p.hp })
      .eq('campaign_id', campaignId)
      .eq('username', p.username)
    await say(client, channel,
      `💚 ${p.username} recovers ${healed} HP at the shrine. (${p.hp}/${p.max_hp} HP)`
    )
    await delay(800)
  }
}

// ------------------------------------------------------------
// Elemental / spirit / mist spawn combat
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
  const prefix = flavorPrefix ??
    `🌪️  The elemental planes bleed through! A ${spawnEnemy.name} manifests — drawn by ${markedUsername}'s mark from Zakhara!`

  await say(client, channel, prefix)
  await delay(1500)

  const spawnHp = [spawnEnemy.hp]
  let spawnRound = 1

  while (spawnHp[0] > 0 && participants.some(p => p.is_alive)) {
    for (const player of participants.filter(p => p.is_alive)) {
      const dmg = roll(10, 22)
      spawnHp[0] = Math.max(0, spawnHp[0] - dmg)
      await say(client, channel,
        `🗡️  ${player.username} strikes the ${spawnEnemy.name} for ${dmg} damage! ` +
        `(${spawnHp[0]} HP remaining)`
      )
      await delay(1000)
      if (spawnHp[0] <= 0) break
    }

    if (spawnHp[0] > 0) {
      const target = pickRandom(participants.filter(p => p.is_alive))
      if (target) {
        const dmg = roll(spawnEnemy.damage_min, spawnEnemy.damage_max)
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel,
          `🩸 The ${spawnEnemy.name} strikes ${target.username} for ${dmg} damage! ` +
          `(${target.hp} HP remaining)`
        )
        if (target.hp <= 0) {
          target.is_alive = false
          await handleDeath(supabase, campaignId, target, 0)
          await say(client, channel,
            `💀 ${target.username} has fallen to the spawn! Permadeath.`
          )
        }
        await delay(1000)
      }
    }

    spawnRound++
    if (spawnRound > 5) spawnHp[0] = 0
  }

  if (spawnHp[0] <= 0) {
    await say(client, channel, `💥 The ${spawnEnemy.name} is defeated!`)
  }
  await delay(1500)
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

  const voteMenu = outcomes
    .map((o, i) => `${i + 1}) ${o.outcome_label}`)
    .join(' | ')

  await say(client, channel,
    `🗳️  THE DECISION AWAITS. Participants vote now! ` +
    `Type the number of your choice. 3 minutes. | ${voteMenu}`
  )

  await collectVotes(client, channel, participantNames, outcomes, votes, VOTE_WINDOW_MS)

  let result = tallyVotes(votes, outcomes)

  if (result === null) {
    await say(client, channel,
      `⚖️  The vote is tied! The decision opens to ALL of chat for 3 more minutes! ` +
      `Type the number of your choice. | ${voteMenu}`
    )
    const allChat = new Map<string, string>()
    await collectVotes(client, channel, null, outcomes, allChat, TIEBREAK_WINDOW_MS)
    const combined = new Map([...allChat, ...votes])
    result = tallyVotes(combined, outcomes)

    if (result === null) {
      result = pickRandom(outcomes)
      await say(client, channel,
        `⚖️  Still tied. Fate decides. The answer is: ${result.outcome_label}`
      )
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

    const handler = (
      _chan: string,
      tags: Record<string, unknown>,
      message: string
    ) => {
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
  for (const key of votes.values()) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

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
    if (!p.is_alive && outcome.consequence_key !== 'shadow_marked') continue

    const base: Record<string, unknown> = {
      username: p.username,
      flag_type: outcome.consequence_key,
      is_active: true,
      source_campaign_slug: campaignSlug,
      source_campaign_id: campaignId,
    }

    switch (outcome.consequence_key) {
      case 'corruption_stabilized':
        base.hit_penalty = 0.20
        break
      case 'crystal_control':
        base.madness_trigger_at = roll(2, 4)
        base.madness_campaign_counter = 0
        break
      case 'shadow_marked':
        base.assassin_trigger_at = roll(5, 7)
        base.assassin_campaign_counter = 0
        break
      case 'seal_bound':
        base.seal_trigger_at = roll(3, 5)
        base.seal_campaign_counter = 0
        break
      case 'convergence_marked':
        break
      case 'genie_debt':
        base.debt_trigger_at = roll(2, 3)
        base.debt_campaign_counter = 0
        break
      case 'mandate_restored':
        base.mandate_trigger_at = roll(2, 4)
        base.mandate_campaign_counter = 0
        break
      case 'mandate_shattered':
        base.spirit_spawn_active = true
        break
      case 'mandate_reforged':
        base.mandate_trigger_at = roll(3, 5)
        base.mandate_campaign_counter = 0
        base.mandate_boon = Math.random() < 0.50
        break
      case 'celestial_debt':
        base.celestial_trigger_at = roll(2, 3)
        base.celestial_campaign_counter = 0
        break
      // ── Ashes of Xaryxis ──────────────────────────────────
      case 'starfire_marked':
        base.starfire_trigger_at = roll(1, 3)
        base.starfire_campaign_counter = 0
        break
      case 'cycle_bound':
        base.cycle_trigger_at = roll(2, 4)
        base.cycle_campaign_counter = 0
        break
      case 'engine_forged':
        base.engine_trigger_at = 1
        base.engine_campaign_counter = 0
        break
      // ── Embers of the Second War ───────────────────────────
      case 'infernal_marked':
        base.infernal_trigger_at = roll(2, 4)
        base.infernal_campaign_counter = 0
        break
      case 'abyssal_touched':
        base.abyssal_trigger_at = roll(1, 3)
        base.abyssal_campaign_counter = 0
        break
      case 'planar_witness':
        base.witness_trigger_at = 1
        base.witness_campaign_counter = 0
        break
      case 'gem_bound':
        base.gem_trigger_at = 1
        base.gem_campaign_counter = 0
        break
      // ── Shattered Memory of Darkon ─────────────────────────
      case 'domain_bound':
        base.domain_trigger_at = roll(2, 4)
        base.domain_campaign_counter = 0
        break
      case 'curse_shattered':
        base.shatter_trigger_at = 1
        base.shatter_campaign_counter = 0
        break
      case 'mist_marked':
        base.mist_trigger_at = 1
        base.mist_campaign_counter = 0
        break
      case 'darklord_echo':
        base.darklord_trigger_at = 1
        base.darklord_campaign_counter = 0
        break
    }

    await supabase
      .from('player_consequence_flags')
      .upsert(base, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
  }
}

async function writeSpreadDifficulty(
  supabase: SupabaseClient,
  channel: string,
  campaignId: string
) {
  await supabase
    .from('channel_consequence_flags')
    .upsert({
      channel,
      flag_type: 'spread_difficulty_active',
      is_active: true,
      difficulty_hp_mod: 1.25,
      difficulty_dmg_mod: 1.25,
      source_campaign_id: campaignId,
    }, { onConflict: 'channel,flag_type,is_active', ignoreDuplicates: false })
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

  // Embers: Iron City Survivor only on balance_preserved and power_seized
  const EMBERS_TITLE_OUTCOMES = ['balance_preserved', 'power_seized']
  const titleEarned = titlePool.length > 0 &&
    (campaignSlug !== 'embers-of-the-second-war' || EMBERS_TITLE_OUTCOMES.includes(outcome.outcome_key))
    ? pickRandom(titlePool).title
    : null

  const artifactName = artifactPool.length > 0 ? pickRandom(artifactPool).artifact_name : null
  const survivors = participants.filter(p => p.is_alive)
  const artWinner = survivors.length > 0 ? pickRandom(survivors) : null

  for (const p of participants) {
    let xp = NAMED_STAGE_XP.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    let gold = NAMED_STAGE_GOLD.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)

    xp = Math.floor(xp * outcome.reward_modifier)
    gold = Math.floor(gold * outcome.reward_modifier)

    // planar_witness XP bonus (+10%)
    if (outcome.consequence_key === 'planar_witness' && p.is_alive) {
      xp = Math.floor(xp * 1.10)
    }

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

    // Award artifact stat bonus (Iron Manacles of Dis only)
    if (p.username === artWinner?.username && artifactName === 'Iron Manacles of Dis') {
      await supabase
        .from('inventory')
        .update({ stat_bonus: 5 })
        .eq('twitch_username', p.username)
        .eq('item_name', 'Iron Manacles of Dis')
    }

    // Stage milestone titles
    if (campaignSlug === 'ashes-of-xaryxis' && p.stage_reached >= 2) {
      await awardXaryxisStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'embers-of-the-second-war' && p.stage_reached >= 2) {
      await awardEmbersStageMilestone(supabase, p.username, p.stage_reached)
    }
    if (campaignSlug === 'shattered-memory-of-darkon' && p.stage_reached >= 2) {
      await awardDarkonStageMilestone(supabase, p.username, p.stage_reached)
    }
  }

  if (fullClear) {
    for (const p of survivors) {
      await supabase
        .from('player_campaign_clears')
        .upsert({ username: p.username, named_unlocked: true }, { onConflict: 'username' })

      await supabase.rpc('increment_named_clears', {
        p_username: p.username,
        p_slug: campaignSlug,
      })
    }
  }

  return { titleEarned, artifactName, artWinner }
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

    await supabase
      .from('campaigns')
      .update({ stage: stage.stage })
      .eq('id', campaignId)

    // Convergence spawn (Al-Qadim / convergence_marked)
    let convergenceSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!convergenceSpawned && await checkConvergenceSpawn(supabase, p.username)) {
        convergenceSpawned = true
        await runElementalSpawn(
          client, supabase, channel, campaignId, p.username, participants
        )
        break
      }
    }

    // Spirit spawn (Al-Qadim / mandate_shattered)
    let spiritSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!spiritSpawned && await checkSpiritSpawn(supabase, p.username)) {
        spiritSpawned = true
        await runElementalSpawn(
          client, supabase, channel, campaignId, p.username,
          participants, SPIRIT_SPAWN_POOL
        )
        break
      }
    }

    // Mist spawn (Darkon / mist_marked)
    let mistSpawned = false
    for (const p of participants.filter(p => p.is_alive)) {
      if (!mistSpawned && await checkMistSpawn(supabase, p.username)) {
        mistSpawned = true
        await runElementalSpawn(
          client, supabase, channel, campaignId, p.username,
          participants, MIST_SPAWN_POOL,
          `🌫️  The Mists tear open. Something from Darkon has followed ${p.username} through the crack.`
        )
        break
      }
    }

    const result = await runNamedStage(
      client, supabase, channel, campaignId, stage, participants, diffMod
    )

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
        `💀 All adventurers have fallen in ${campaignData.name}. The daily cooldown is spent.`
      )
      await supabase
        .from('campaigns')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', campaignId)
      return
    }

    await say(client, channel,
      `✅ Stage ${stage.stage} — ${stage.stage_name} — cleared! ` +
      `Survivors: ${result.survivors.map(p => p.username).join(', ')}`
    )
    await delay(2000)
  }

  const survivors = participants.filter(p => p.is_alive)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `🏛️  The final chamber stands before you. The moment of decision has arrived.`
  )
  await delay(3000)

  const chosenOutcome = await runEndingVote(client, channel, survivors, outcomes)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `📖 ${survivors.map(p => p.username).join(', ')} chose: ${chosenOutcome.outcome_label}`
  )
  await delay(1500)
  await say(client, channel, chosenOutcome.flavor_text)
  await delay(3000)

  await writeConsequences(supabase, campaignId, participants, chosenOutcome, campaignData.slug)

  // Outcome-specific announcements
  if (chosenOutcome.outcome_key === 'spread') {
    await writeSpreadDifficulty(supabase, channel, campaignId)
    await say(client, channel,
      `⚠️  The corruption spreads. Future campaigns will be harder. All participants have been marked.`
    )
  } else if (chosenOutcome.outcome_key === 'stabilize') {
    await say(client, channel,
      `⚠️  The Crystal is stabilized — but something lingers. ` +
      `All participants suffer a -20% to hit chance until cleansed. Use !cleric to seek aid.`
    )
  } else if (chosenOutcome.outcome_key === 'take_control') {
    await say(client, channel,
      `✨ Power yields to your will. A title is yours. But something watches. Something waits.`
    )
  } else if (chosenOutcome.outcome_key === 'use_seal') {
    await say(client, channel,
      `🔥 The Seal is yours. The power is real. So is the cost.`
    )
  } else if (chosenOutcome.outcome_key === 'destroy_seal') {
    await say(client, channel,
      `💥 The Seal is destroyed. Something old exhales. The elemental planes remember.`
    )
  } else if (chosenOutcome.outcome_key === 'return_seal') {
    await say(client, channel,
      `🌪️  The Seal is returned. The genie courts remember your name.`
    )
    // ── Ashes of Xaryxis ──────────────────────────────────────
  } else if (chosenOutcome.outcome_key === 'sacrifice_empire') {
    await say(client, channel,
      `⭐ The Engine is gone. Xaryxis dims. Your world lives. ` +
      `The cost will follow you — the starfire mark burns in all who made this choice.`
    )
  } else if (chosenOutcome.outcome_key === 'continue_cycle') {
    await say(client, channel,
      `⚙️  The Engine runs on. Another world pays the price. ` +
      `The cycle continues — and so do you, as part of it. The machine remembers its servants.`
    )
  } else if (chosenOutcome.outcome_key === 'rewrite_system') {
    await say(client, channel,
      `🔧 The Engine is different now. Whether that is enough, time will tell. ` +
      `Those who reached into the machine carry its mark — unstable, uncertain, yours.`
    )
    // ── Embers of the Second War ───────────────────────────────
  } else if (chosenOutcome.outcome_key === 'devil_victory') {
    await say(client, channel,
      `⛓️  The Gem passes to infernal hands. The devils tighten their grip on the war. ` +
      `Order returns to the planes — Dis's order. The Iron City's ledger now includes your name.`
    )
  } else if (chosenOutcome.outcome_key === 'demonic_chaos') {
    await say(client, channel,
      `💥 The Gem is gone. The Blood War tears wider than it has in centuries. ` +
      `You stopped the devils from winning. The Abyss does not forget who opened the door.`
    )
  } else if (chosenOutcome.outcome_key === 'balance_preserved') {
    await say(client, channel,
      `⚖️  The Gem is hidden. Neither side gains the fulcrum. The war continues — contained. ` +
      `It is not a victory. It is the prevention of something worse. The planes take note.`
    )
  } else if (chosenOutcome.outcome_key === 'power_seized') {
    await say(client, channel,
      `💎 You kept it. The power is yours. So is the target on your back. ` +
      `Both devils and demons now know your name. The Gem hums in your possession. Good luck.`
    )
    // ── Shattered Memory of Darkon ─────────────────────────────
  } else if (chosenOutcome.outcome_key === 'restore_azalin') {
    await say(client, channel,
      `👑 Azalin is whole again. Darkon stabilizes. The Mists thicken at the borders. ` +
      `He looks at you the way a collector looks at something rare. You saved the domain. ` +
      `Whether you are free to leave it is another question entirely.`
    )
  } else if (chosenOutcome.outcome_key === 'destroy_azalin') {
    await say(client, channel,
      `💥 The phylactery breaks. Azalin ends — not with fury, but with something like relief. ` +
      `Darkon tears at the seams. You find a way through the collapse. ` +
      `It is not clean. Nothing about this was clean.`
    )
  } else if (chosenOutcome.outcome_key === 'exploit_curse') {
    await say(client, channel,
      `🌫️  You used the fracture and slipped through. You are out. ` +
      `Darkon is still there — broken, leaking, worse than when you arrived. ` +
      `The Mists remember the crack you used. They are already looking for you again.`
    )
  } else if (chosenOutcome.outcome_key === 'replace_darklord') {
    await say(client, channel,
      `🌑 Someone stepped into the space Azalin left. The domain has an anchor again. ` +
      `The others may escape. The one who stayed becomes what Azalin was. ` +
      `The cycle does not end. It just has a new name.`
    )
  }

  const { titleEarned, artifactName, artWinner } = await writeNamedRewards(
    supabase, campaignId, participants, chosenOutcome, campaignData.slug, true
  )

  await supabase
    .from('campaigns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', campaignId)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `🏆 ${campaignData.name} COMPLETE! ` +
    `${survivors.map(p => p.username).join(' & ')} emerge victorious.`
  )
  if (titleEarned) {
    await say(client, channel, `🎖️  Title earned: [${titleEarned}] — awarded to qualifying survivors!`)
  }
  if (artifactName && artWinner) {
    await say(client, channel, `🏺 Artifact: ${artifactName} — claimed by ${artWinner.username}!`)
  }
  await say(client, channel, `✨ Full clear bonus applied. Check !status for updated XP and gold.`)
}

// ------------------------------------------------------------
// Entry points
// ------------------------------------------------------------

const namedCampaignLock = new Map<string, boolean>()
const namedPendingJoins = new Map<string, Set<string>>()

export async function handleNamedCampaignCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  slug: string
) {
  if (namedCampaignLock.get(channel)) {
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
    await say(client, channel,
      `@${username} You need a character to run a campaign. Use !join to create one.`
    )
    return
  }

  if (initiatorChar.hp <= 0 || initiatorChar.is_dead) {
    await say(client, channel,
      `@${username} Your character is dead. Use !join to start over before running a campaign.`
    )
    return
  }

  const { data: campaignData } = await supabase
    .from('named_campaigns')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!campaignData) {
    await say(client, channel,
      `@${username} Unknown campaign: "${slug}". Use !campaigns to see available campaigns.`
    )
    return
  }

  await ensureClearRecord(supabase, username)
  const unlocked = await checkUnlock(supabase, username, campaignData.unlock_required)

  if (!unlocked) {
    await say(client, channel,
      `@${username} You haven't earned access to named campaigns yet. ` +
      `Complete ${campaignData.unlock_required} standard campaigns first with !campaign.`
    )
    return
  }

  namedCampaignLock.set(channel, true)

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
      `⚔️  @${username} calls for a named campaign: ${campaignData.name} (${campaignData.setting})! ` +
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

    await supabase.from('campaign_participants').insert({
      campaign_id: campaign.id,
      username,
      hp: 100,
      max_hp: 100,
    })

    if (mode === 'solo') {
      await say(client, channel,
        `🗡️  ${username} enters ${campaignData.setting} alone. ${bossName} waits at the end.`
      )
    } else {
      const joiners = new Set<string>([username])
      namedPendingJoins.set(channel, joiners)

      await say(client, channel,
        `🛡️  Party forming for ${campaignData.name}! ` +
        `Type !joincamp to join. Window closes in 60 seconds. ${username} is already in.`
      )

      await delay(JOIN_WINDOW_MS)
      namedPendingJoins.delete(channel)

      for (const joiner of joiners) {
        if (joiner !== username) {
          await supabase.from('campaign_participants').insert({
            campaign_id: campaign.id,
            username: joiner,
            hp: 100,
            max_hp: 100,
          })
        }
      }

      await say(client, channel,
        `⚔️  The party is set: ${[...joiners].join(', ')}. ` +
        `Entering ${campaignData.setting}. ${bossName} awaits.`
      )
    }

    await delay(2000)

    const { data: participantsData } = await supabase
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', campaign.id)

    const participants = (participantsData ?? []) as Participant[]

    await runNamedCampaign(
      client, supabase, channel,
      campaign.id, campaignData as NamedCampaign,
      stages, outcomes, participants
    )

  } finally {
    namedCampaignLock.delete(channel)
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
  await say(client, channel, `🛡️  ${username} joins the party! (${joiners.size} adventurers so far)`)
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