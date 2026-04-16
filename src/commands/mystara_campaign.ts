// ============================================================
// ZulkirBot: Named Campaign Handler — Mystara/Hollow World
// ============================================================
// Handles named campaign lifecycle:
//   unlock check → initiation → solo/party prompt →
//   join window → stage loop → rest shrine → boss fight →
//   ending vote → consequence writes → reward distribution
// ============================================================

import { Client } from 'tmi.js'
import { SupabaseClient } from '@supabase/supabase-js'
import { summonYvannis, rollYvannisStage } from './cleric'

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

const JOIN_WINDOW_MS = 60_000   // 60s party join window
const MODE_CHOICE_MS = 30_000   // 30s to pick solo/party
const VOTE_WINDOW_MS = 180_000  // 3 min vote window
const TIEBREAK_WINDOW_MS = 180_000  // 3 min tiebreak window
const SHRINE_HEAL_HP = 20
const NAMED_STAGE_XP = [75, 150, 200, 275, 400]   // harder = more XP
const NAMED_STAGE_GOLD = [30, 60, 80, 110, 160]
const CLEAR_BONUS_XP = 350
const CLEAR_BONUS_GOLD = 150

const roll = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const say = (client: Client, channel: string, msg: string) =>
  client.say(channel, msg)

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

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

async function ensureClearRecord(
  supabase: SupabaseClient,
  username: string
) {
  await supabase
    .from('player_campaign_clears')
    .upsert({ username }, { onConflict: 'username', ignoreDuplicates: true })
}

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

    // --- Stabilize: -20% hit penalty (passive, no trigger needed) ---
    // Applied in combat engine when flag is active. No message needed here.

    // --- Shadow Marked: assassin trigger ---
    if (flag.flag_type === 'shadow_marked' && flag.trigger_ready) {
      await say(client, channel,
        `🗡️  @${username} — A figure dressed in Shadow Elf grey steps from the dark. ` +
        `No words. No warning. The blade finds its mark before you can react. ` +
        `${username} has been killed by an assassin of the Shadow Elf god. ` +
        `Their story ends here.`
      )

      // Permadeath — reset character
      await supabase
        .from('characters')
        .update({ hp: 0, is_dead: true })
        .eq('twitch_username', username)

      // Mark flag resolved
      await supabase
        .from('player_consequence_flags')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('id', flag.id)

      return  // No further processing for this player this session
    }

    // --- Crystal Control: madness trigger ---
    if (flag.flag_type === 'crystal_control' && flag.trigger_ready && !flag.madness_triggered) {
      const madnessChance = Math.random()
      if (madnessChance <= 0.40) {
        await triggerMadness(client, supabase, channel, username, flag.id)
      }
    }
  }
}

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
    `🌀 THE CRYSTAL STIRS — @${username}''s mind fractures! ${description}`
  )

  // Apply mechanical effect
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
          `💔 ${target.item_name} crumbles to dust in @${username}''s hands.`
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
      // Mark dead if in an active campaign — handled in campaign stage loop
      await say(client, channel,
        `🏃 @${username} flees into the dark. They do not return.`
      )
      break
    }

    // attack_party, spawn_enemy, hostile_turn are handled mid-combat in the stage loop
    // They fire here as a warning; the combat engine checks the flag and applies the effect
    default:
      break
  }

  // Mark madness as triggered on flag
  await supabase
    .from('player_consequence_flags')
    .update({ madness_triggered: true })
    .eq('id', flagId)
}

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

  // Apply difficulty modifier to enemy stats
  const enemyMaxHp = Math.ceil(stage.enemy_hp * diffMod.hpMod)
  const dmgMin = Math.ceil(stage.enemy_damage_min * diffMod.dmgMod)
  const dmgMax = Math.ceil(stage.enemy_damage_max * diffMod.dmgMod)

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `📜 Stage ${stage.stage}/5 — ${stage.stage_name}`
  )
  await delay(1500)
  await say(client, channel, stage.flavor_intro)
  await delay(2500)

  // Track enemy HP (one pool per enemy_count)
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

      // Check stabilize hit penalty
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
          `🌫️  @${player.username}''s attack wavers — the corruption interferes! Miss!`
        )
        await delay(1200)
        continue
      }

      const dmg = roll(12, 28)
      enemyHPs[targetIdx] = Math.max(0, enemyHPs[targetIdx] - dmg)

      await say(client, channel,
        `🗡️  ${player.username} hits ${stage.enemy_name} for ${dmg} damage! ` +
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

      // Special ability fires at round 2
      if (!specialFired && round === 2 && stage.special_name) {
        if (stage.special_type === 'all') {
          const specialDmg = Math.ceil((stage.special_damage ?? 20) * diffMod.dmgMod)
          await say(client, channel,
            `⚡ ${stage.enemy_name} uses ${stage.special_name}! ` +
            `All party members take ${specialDmg} damage!`
          )
          for (const p of alive.filter(p => p.is_alive)) {
            p.hp = Math.max(0, p.hp - specialDmg)
            await say(client, channel,
              `🩸 ${p.username} — ${p.hp} HP remaining.`
            )
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
          // Null Field — skip one random player's next attack (tracked via flag)
          const target = pickRandom(alive.filter(p => p.is_alive))
          if (target) {
            await say(client, channel,
              `⚡ ${stage.enemy_name} uses ${stage.special_name}! ` +
              `${target.username}''s next attack is suppressed!`
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
        // Normal attack
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

async function runEndingVote(
  client: Client,
  channel: string,
  participants: Participant[],
  outcomes: NamedCampaignOutcome[]
): Promise<NamedCampaignOutcome> {
  const participantNames = new Set(participants.map(p => p.username.toLowerCase()))
  const votes = new Map<string, string>()  // username → outcome_key

  // Build vote menu
  const voteMenu = outcomes
    .map((o, i) => `${i + 1}) ${o.outcome_label}`)
    .join(' | ')

  await say(client, channel,
    `🗳️  THE CHAMBER AWAITS YOUR DECISION. Participants vote now! ` +
    `Type the number of your choice. 3 minutes. | ${voteMenu}`
  )

  // Collect participant votes
  await collectVotes(client, channel, participantNames, outcomes, votes, VOTE_WINDOW_MS)

  // Tally
  let result = tallyVotes(votes, outcomes)

  if (result === null) {
    // Tie — open to all of chat
    await say(client, channel,
      `⚖️  The vote is tied! The decision opens to ALL of chat for 3 more minutes! ` +
      `Type the number of your choice. | ${voteMenu}`
    )

    const allChat = new Map<string, string>()
    await collectVotes(client, channel, null, outcomes, allChat, TIEBREAK_WINDOW_MS)

    // Merge: participant votes take priority, chat fills gaps
    const combined = new Map([...allChat, ...votes])
    result = tallyVotes(combined, outcomes)

    if (result === null) {
      // Still tied — random pick
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
  allowedUsers: Set<string> | null,  // null = all chat
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

      const trimmed = message.trim()
      const num = parseInt(trimmed, 10)
      if (isNaN(num) || num < 1 || num > outcomes.length) return

      const outcome = outcomes[num - 1]
      votes.set(username, outcome.outcome_key)
    }

    client.on('message', handler)

    // Clear timeout if all allowed users have voted
    if (allowedUsers) {
      const interval = setInterval(() => {
        const allVoted = [...allowedUsers].every(u => votes.has(u))
        if (allVoted) {
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

  if (winners.length === 1) return winners[0]
  return null  // tie
}

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
    // shadow_marked applies to everyone regardless of survival

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
    }

    await supabase
      .from('player_consequence_flags')
      .upsert(base, { onConflict: 'username,flag_type,is_active', ignoreDuplicates: false })
  }

  // Channel-wide flag for Let It Spread
  if (outcome.consequence_key === 'shadow_marked') {
    // Note: shadow_marked is player-level. The difficulty bump is separate.
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

async function writeNamedRewards(
  supabase: SupabaseClient,
  campaignId: string,
  participants: Participant[],
  outcome: NamedCampaignOutcome,
  campaignSlug: string,
  fullClear: boolean
) {
  // Draw title and artifact
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

    // Apply outcome reward modifier
    xp = Math.floor(xp * outcome.reward_modifier)
    gold = Math.floor(gold * outcome.reward_modifier)

    // Full clear bonus for survivors
    if (fullClear && p.is_alive) {
      xp += Math.floor(CLEAR_BONUS_XP * outcome.reward_modifier) + outcome.bonus_xp
      gold += Math.floor(CLEAR_BONUS_GOLD * outcome.reward_modifier)
    }

    // Write to campaign_rewards
    await supabase.from('campaign_rewards').insert({
      campaign_id: campaignId,
      username: p.username,
      xp_earned: xp,
      gold_earned: gold,
      title_earned: fullClear && p.is_alive ? titleEarned : null,
      artifact_earned: p.username === artWinner?.username ? artifactName : null,
    })

    // Write to characters table
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

    // Increment campaign clear counters for consequence tracking
    await supabase.rpc('increment_campaign_counters', { p_username: p.username })
  }

  // Increment standard clear count for full survivors
  if (fullClear) {
    for (const p of survivors) {
      await supabase
        .from('player_campaign_clears')
        .upsert({
          username: p.username,
          named_unlocked: true,
        }, { onConflict: 'username' })

      // Increment named clears for this slug
      await supabase.rpc('increment_named_clears', {
        p_username: p.username,
        p_slug: campaignSlug,
      })
    }
  }

  return { titleEarned, artifactName, artWinner }
}

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

  // Update campaign status to active
  await supabase
    .from('campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', campaignId)

  for (const stage of stages.sort((a, b) => a.stage - b.stage)) {
    const alive = participants.filter(p => p.is_alive)
    if (alive.length === 0) break

    // Rest shrine before stages 2–5
    if (stage.stage > 1) {
      await delay(3000)
      await restShrine(client, supabase, channel, campaignId, stage, participants)
      await delay(2000)

      if (stage.stage === campaignData.yvannis_stage) {
        await summonYvannis(
          client, supabase, channel,
          campaignId, stage.stage,
          participants
        )
        await delay(1500)
      }
    }

    // Update current stage
    await supabase
      .from('campaigns')
      .update({ stage: stage.stage })
      .eq('id', campaignId)

    const result = await runNamedStage(
      client, supabase, channel, campaignId, stage, participants, diffMod
    )

    // Update stage_reached for survivors
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
        `💀 All adventurers have fallen in ${campaignData.name}. ` +
        `The corruption spreads unchecked. The daily cooldown is spent.`
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

  // All 5 stages cleared — run ending vote
  const survivors = participants.filter(p => p.is_alive)

  await say(client, channel,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  )
  await say(client, channel,
    `🏛️  The Chamber of the Spheres stands before you. ` +
    `The Crystal of Rafiel pulses with fractured light. ` +
    `The Echo of Atzanteotl is silent. What do you do?`
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

  // Write consequences
  await writeConsequences(supabase, campaignId, participants, chosenOutcome, campaignData.slug)
  if (chosenOutcome.outcome_key === 'spread') {
    await writeSpreadDifficulty(supabase, channel, campaignId)
    await say(client, channel,
      `⚠️  The corruption spreads. Future campaigns will be harder. ` +
      `All participants have been marked by a Shadow Elf god.`
    )
  } else if (chosenOutcome.outcome_key === 'stabilize') {
    await say(client, channel,
      `⚠️  The Crystal is stabilized — but something lingers. ` +
      `All participants suffer a -20% to hit chance until cleansed by a cleric. Use !cleric to seek aid.`
    )
  } else if (chosenOutcome.outcome_key === 'take_control') {
    await say(client, channel,
      `✨ The Crystal yields to your will. A title is yours. ` +
      `But something watches. Something waits.`
    )
  }

  // Write rewards
  const { titleEarned, artifactName, artWinner } = await writeNamedRewards(
    supabase, campaignId, participants, chosenOutcome, campaignData.slug, true
  )

  await supabase
    .from('campaigns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', campaignId)

  // Announce rewards
  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `🏆 ${campaignData.name} COMPLETE! ` +
    `${survivors.map(p => p.username).join(' & ')} emerge from the Hollow World.`
  )
  if (titleEarned) {
    await say(client, channel,
      `🎖️  Title earned: [${titleEarned}] — awarded to all survivors!`
    )
  }
  if (artifactName && artWinner) {
    await say(client, channel,
      `🏺 Artifact: ${artifactName} — claimed by ${artWinner.username}!`
    )
  }
  await say(client, channel,
    `✨ Full clear bonus applied. Check !status for updated XP and gold.`
  )
}

// !campaign <slug> entry point
const namedCampaignLock = new Map<string, boolean>()
const namedPendingJoins = new Map<string, Set<string>>()

export async function handleNamedCampaignCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  slug: string
) {
  // Check lock
  if (namedCampaignLock.get(channel)) {
    await say(client, channel,
      `@${username} A campaign is already being set up. Hang tight!`
    )
    return
  }

  // Check daily cooldown (shared with standard campaigns)
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

  // Load named campaign data
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

  // Check unlock
  await ensureClearRecord(supabase, username)
  const unlocked = await checkUnlock(supabase, username, campaignData.unlock_required)

  if (!unlocked) {
    await say(client, channel,
      `@${username} You haven't earned access to named campaigns yet. ` +
      `Complete ${campaignData.unlock_required} standard campaign(s) first with !campaign.`
    )
    return
  }

  namedCampaignLock.set(channel, true)

  try {
    // Load stages and outcomes
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

    // Draw boss from named campaign stage 5 data
    const bossStage = stages.find(s => s.stage === 5)
    const bossName = bossStage?.enemy_name ?? 'Unknown'

    // Create campaign record (reuses base campaigns table)
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
        yvannis_stage: rollYvannisStage()
      })
      .select()
      .single()

    if (error || !campaign) throw error

    // Add initiator
    await supabase.from('campaign_participants').insert({
      campaign_id: campaign.id,
      username,
      hp: 100,
      max_hp: 100,
    })

    if (mode === 'solo') {
      await say(client, channel,
        `🗡️  ${username} descends alone into ${campaignData.setting}. ` +
        `${bossName} waits at the end.`
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

    // Load final participant list
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

// !joincamp handler for named campaigns (same export as standard)
export async function handleNamedJoinCamp(
  client: Client,
  channel: string,
  username: string
) {
  const joiners = namedPendingJoins.get(channel)
  if (!joiners) return false  // not a named campaign join window

  if (joiners.has(username)) {
    await say(client, channel, `@${username} You're already in the party!`)
    return true
  }

  joiners.add(username)
  await say(client, channel,
    `🛡️  ${username} joins the party! (${joiners.size} adventurers so far)`
  )
  return true
}

// ------------------------------------------------------------
// Mode choice listener
// ------------------------------------------------------------

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