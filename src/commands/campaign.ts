// ============================================================
// ZulkirBot: !campaign Command Handler
// ============================================================
// Handles the full campaign lifecycle:
//   initiation → solo/party prompt → join window →
//   stage loop → rest shrine → boss fight → rewards
// ============================================================

import { Client } from 'tmi.js'
import { supabase } from './../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js'
import { summonYvannis, rollYvannisStage } from './cleric'

export const campaignAttackPending = new Map<string, () => void>()

interface Participant {
  username: string
  hp: number
  max_hp: number
  is_alive: boolean
  stage_reached: number
}

interface Campaign {
  id: string
  channel: string
  initiated_by: string
  mode: 'solo' | 'party'
  status: 'pending' | 'joining' | 'active' | 'completed' | 'failed'
  stage: number
  boss_name: string
  boss_special: string
  started_at: string | null
  completed_at: string | null
  yvannis_stage: number | null
}

interface BossPoolEntry {
  boss_name: string
  special_move: string
  flavor_intro: string
}

interface StageEnemy {
  name: string
  hp: number
  damage: [number, number]   // [min, max]
  special?: string           // stage 4 only
  specialDamage?: number
}

const JOIN_WINDOW_MS = 60_000   // 60s party join window
const SHRINE_HEAL_HP = 20       // flat HP restored at rest shrine
const CHANNEL = '#yourchannel' // replace with your channel

// XP and gold per stage (index 0 = stage 1)
const STAGE_XP = [50, 100, 150, 200, 300]
const STAGE_GOLD = [20, 40, 60, 80, 120]
const CLEAR_BONUS_XP = 250
const CLEAR_BONUS_GOLD = 100

// Stage 4 elite power names (random pick)
const ELITE_POWERS = [
  'Iron Bulwark',      // damage reduction
  'Warlord\'s Fury',   // bonus damage
  'Cursed Ground',     // all party takes chip damage
  'Battle Trance',     // elite attacks twice
]

// Stage enemies by stage index (0-based)
// Boss at stage 4 is drawn from campaign_boss_pool
const STAGE_ENEMIES: Record<number, StageEnemy | StageEnemy[]> = {
  0: { name: 'Goblin Skirmisher', hp: 40, damage: [5, 12] },
  1: [
    { name: 'Hobgoblin Scout', hp: 55, damage: [7, 14] },
    { name: 'Hobgoblin Archer', hp: 45, damage: [6, 12] },
  ],
  2: {
    name: 'Orc Patrol Captain', hp: 90, damage: [10, 18],
    special: 'Shield Bash', specialDamage: 20
  },
  3: {
    name: 'Elite Shadowguard', hp: 130, damage: [14, 24],
    special: '',  // filled at runtime from ELITE_POWERS
    specialDamage: 30
  },
}

const STAGE_FLAVOR: Record<number, string> = {
  0: '⚔️  A rabble of goblins blocks the road ahead, emboldened by darkness.',
  1: '🏹 You round a bend and walk straight into a hobgoblin ambush!',
  2: '🛡️  A heavily armed orc patrol bars the passage, their captain sneering.',
  3: '💀 An Elite Shadowguard steps from the darkness. This one is different.',
  4: '',  // filled at runtime with boss flavor_intro
}

const SHRINE_FLAVOR = [
  '🕯️  A crumbling rest shrine glows softly in the dark. You press on, wounds closing slightly.',
  '🕯️  Ancient stonework pulses with faint warmth. The shrine grants you a moment\'s reprieve.',
  '🕯️  A forgotten altar still holds power. You rest a moment and feel the ache lessen.',
  '🕯️  The shrine\'s flame flickers as you approach, steadying as if in recognition.',
]

const roll = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const say = (client: Client, channel: string, msg: string) =>
  client.say(channel, msg)

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

const ATTACK_TIMEOUT_MS = 2 * 60 * 1000

function waitForAttack(
  channel: string,
  username: string,
  client: Client
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      campaignAttackPending.delete(username)
      await say(client, channel,
        `⏰ ${username} hesitates too long — auto-attacking!`
      )
      resolve()
    }, ATTACK_TIMEOUT_MS)

    campaignAttackPending.set(username, () => {
      clearTimeout(timer)
      campaignAttackPending.delete(username)
      resolve()
    })
  })
}

async function getTodaysCampaign(supabase: SupabaseClient, channel: string) {
  const { data } = await supabase
    .from('campaign_today')
    .select('*')
    .eq('channel', channel)
    .limit(1)
    .single()
  return data
}

async function drawBoss(supabase: SupabaseClient): Promise<BossPoolEntry> {
  const { data } = await supabase
    .from('campaign_boss_pool')
    .select('*')
  const pool = data as BossPoolEntry[]
  return pickRandom(pool)
}

async function drawArtifact(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('campaign_artifact_pool')
    .select('artifact_name')
  const pool = data as { artifact_name: string }[]
  return pickRandom(pool).artifact_name
}

async function drawTitle(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('campaign_title_pool')
    .select('title')
  const pool = data as { title: string }[]
  return pickRandom(pool).title
}

async function createCampaign(
  supabase: SupabaseClient,
  channel: string,
  initiatedBy: string,
  mode: 'solo' | 'party',
  boss: BossPoolEntry
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      channel,
      initiated_by: initiatedBy,
      mode,
      status: mode === 'party' ? 'joining' : 'active',
      stage: 1,
      boss_name: boss.boss_name,
      boss_special: boss.special_move,
      started_at: new Date().toISOString(),
      yvannis_stage: rollYvannisStage(),   // <-- add this line
    })
    .select()
    .single()
  if (error) throw error
  return data as Campaign
}

async function addParticipant(
  supabase: SupabaseClient,
  campaignId: string,
  username: string,
  maxHp = 100
) {
  await supabase
    .from('campaign_participants')
    .insert({ campaign_id: campaignId, username, hp: maxHp, max_hp: maxHp })
}

async function getParticipants(
  supabase: SupabaseClient,
  campaignId: string
): Promise<Participant[]> {
  const { data } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
  return (data ?? []) as Participant[]
}

async function updateParticipant(
  supabase: SupabaseClient,
  campaignId: string,
  username: string,
  updates: Partial<Participant>
) {
  await supabase
    .from('campaign_participants')
    .update(updates)
    .eq('campaign_id', campaignId)
    .eq('username', username)
}

async function updateCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  updates: Partial<Campaign>
) {
  await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
}

async function logStage(
  supabase: SupabaseClient,
  campaignId: string,
  stage: number,
  enemyName: string,
  outcome: 'victory' | 'defeat' | 'partial',
  flavorText: string
) {
  await supabase
    .from('campaign_stage_log')
    .insert({ campaign_id: campaignId, stage, enemy_name: enemyName, outcome, flavor_text: flavorText })
}

async function writeRewards(
  supabase: SupabaseClient,
  campaignId: string,
  participants: Participant[],
  fullClear: boolean,
  titleEarned: string | null,
  artifactWinner: string | null,
  artifactName: string | null
) {
  for (const p of participants) {
    let xp = STAGE_XP.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)
    let gold = STAGE_GOLD.slice(0, p.stage_reached).reduce((a, b) => a + b, 0)

    if (fullClear && p.is_alive) {
      xp += CLEAR_BONUS_XP
      gold += CLEAR_BONUS_GOLD
    }

    // Write to campaign_rewards table
    await supabase.from('campaign_rewards').insert({
      campaign_id: campaignId,
      username: p.username,
      xp_earned: xp,
      gold_earned: gold,
      title_earned: fullClear && p.is_alive ? titleEarned : null,
      artifact_earned: p.username === artifactWinner ? artifactName : null,
    })

    // Write XP and gold directly to characters table
    const { data: char } = await supabase
      .from('characters')
      .select('xp, gold')
      .eq('twitch_username', p.username)
      .single()

    if (char) {
      await supabase
        .from('characters')
        .update({
          xp: char.xp + xp,
          gold: char.gold + gold,
        })
        .eq('twitch_username', p.username)
    }
    if (fullClear && p.is_alive) {
      await supabase.rpc('increment_standard_clears', { p_username: p.username })
    }
  }
}

interface CombatResult {
  survivors: Participant[]
  defeated: Participant[]
  enemyName: string
}

async function runCombat(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaign: Campaign,
  participants: Participant[],
  enemies: StageEnemy | StageEnemy[],
  stageIndex: number
): Promise<CombatResult> {
  const enemyList = Array.isArray(enemies) ? enemies : [enemies]
  const alive = participants.filter(p => p.is_alive)
  const enemyNames = enemyList.map(e => e.name).join(' & ')

  await say(client, channel, STAGE_FLAVOR[stageIndex].replace('{enemy}', enemyNames))
  await delay(2000)

  const enemyHPs = enemyList.map(e => e.hp)
  let round = 1
  let specialFired = false

  while (enemyHPs.some(hp => hp > 0) && alive.some(p => p.is_alive)) {
    await say(client, channel, `⚔️  — Round ${round} —`)
    await delay(1000)

    // Each alive player takes their turn
    for (const player of alive.filter(p => p.is_alive)) {
      if (!enemyHPs.some(hp => hp > 0)) break

      await say(client, channel,
        `@${player.username} — type !attack to strike the ${enemyList.find((_, i) => enemyHPs[i] > 0)?.name}! (2 min to act)`
      )

      // Wait for player to !attack or timeout
      await waitForAttack(channel, player.username, client)

      if (!enemyHPs.some(hp => hp > 0)) break

      const targetIdx = enemyHPs.findIndex(hp => hp > 0)
      const dmg = roll(10, 25)
      enemyHPs[targetIdx] = Math.max(0, enemyHPs[targetIdx] - dmg)

      await say(client, channel,
        `🗡️  ${player.username} hits ${enemyList[targetIdx].name} for ${dmg} damage! ` +
        `(${enemyHPs[targetIdx]} HP remaining)`
      )
      await delay(1000)

      if (enemyHPs[targetIdx] === 0) {
        await say(client, channel, `💥 ${enemyList[targetIdx].name} has fallen!`)
        await delay(800)
      }
    }

    // Enemies attack back
    for (let i = 0; i < enemyList.length; i++) {
      if (enemyHPs[i] <= 0) continue

      const enemy = enemyList[i]
      const target = pickRandom(alive.filter(p => p.is_alive))
      if (!target) break

      if (!specialFired && round === 2 && enemy.special) {
        const specialDmg = enemy.specialDamage ?? 20
        target.hp = Math.max(0, target.hp - specialDmg)
        await say(client, channel,
          `⚡ ${enemy.name} uses ${enemy.special}! ` +
          `${target.username} takes ${specialDmg} damage! (${target.hp} HP)`
        )
        specialFired = true
        await delay(1200)
      } else {
        const dmg = roll(enemy.damage[0], enemy.damage[1])
        target.hp = Math.max(0, target.hp - dmg)
        await say(client, channel,
          `🩸 ${enemy.name} strikes ${target.username} for ${dmg} damage! ` +
          `(${target.hp} HP remaining)`
        )
        await delay(1000)
      }

      if (target.hp <= 0) {
        target.is_alive = false
        target.stage_reached = stageIndex + 1
        await updateParticipant(supabase, campaign.id, target.username, {
          hp: 0,
          is_alive: false,
          stage_reached: stageIndex + 1,
        })
        await say(client, channel,
          `💀 ${target.username} has fallen in battle!`
        )
        await delay(1200)
      }
    }

    round++
    if (round > 8) {
      for (let i = 0; i < enemyHPs.length; i++) enemyHPs[i] = 0
      await say(client, channel, `⚡ The enemies are overwhelmed and routed!`)
    }

    await delay(1000)
  }

  const survivors = alive.filter(p => p.is_alive)
  const defeated = alive.filter(p => !p.is_alive)
  return { survivors, defeated, enemyName: enemyNames }
}

async function restShrine(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaign: Campaign,
  participants: Participant[]
) {
  await say(client, channel, pickRandom(SHRINE_FLAVOR))
  await delay(2000)

  for (const p of participants.filter(p => p.is_alive)) {
    const healed = Math.min(SHRINE_HEAL_HP, p.max_hp - p.hp)
    p.hp += healed

    await updateParticipant(supabase, campaign.id, p.username, { hp: p.hp })

    await say(client, channel,
      `💚 ${p.username} recovers ${healed} HP at the shrine. (${p.hp}/${p.max_hp} HP)`
    )
    await delay(800)
  }
}

// Boss fight (Stage 5)

async function runBossFight(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaign: Campaign,
  participants: Participant[]
): Promise<CombatResult> {
  const bossEnemy: StageEnemy = {
    name: campaign.boss_name,
    hp: 200,
    damage: [18, 30],
    special: campaign.boss_special,
    specialDamage: 35,
  }

  return runCombat(
    client, supabase, channel, campaign, participants, bossEnemy, 4
  )
}

async function runCampaign(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaign: Campaign,
  participants: Participant[]
) {
  await updateCampaign(supabase, campaign.id, { status: 'active' })

  for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
    const stageNum = stageIndex + 1
    const alive = participants.filter(p => p.is_alive)

    if (alive.length === 0) break

    // Rest shrine before stages 2–5
    if (stageIndex > 0) {
      await delay(3000)
      await restShrine(client, supabase, channel, campaign, participants)
      await delay(2000)

      // Summon Yvannis if this is his stage
      // campaign.yvannis_stage is 1-indexed, stageNum is 1-indexed
      if (stageNum === campaign.yvannis_stage) {
        await summonYvannis(
          client, supabase, channel,
          campaign.id, stageNum,
          participants
        )
        await delay(1500)
      }
    }

    await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    await say(client, channel, `📜 Stage ${stageNum}/5 begins!`)
    await delay(1500)

    await updateCampaign(supabase, campaign.id, { stage: stageNum })

    let result: CombatResult

    if (stageIndex === 4) {
      // Boss fight
      result = await runBossFight(client, supabase, channel, campaign, participants)
    } else {
      // Build stage 3/4 enemies with runtime data
      let enemies = STAGE_ENEMIES[stageIndex]
      if (stageIndex === 3 && !Array.isArray(enemies)) {
        enemies = { ...enemies, special: pickRandom(ELITE_POWERS) }
      }
      result = await runCombat(
        client, supabase, channel, campaign, participants, enemies, stageIndex
      )
    }

    // Update stage_reached for survivors after this stage
    for (const p of result.survivors) {
      p.stage_reached = stageNum
      await updateParticipant(supabase, campaign.id, p.username, {
        hp: p.hp,
        stage_reached: stageNum,
      })
    }

    const outcome = result.survivors.length === 0
      ? 'defeat'
      : result.defeated.length > 0 ? 'partial' : 'victory'

    await logStage(
      supabase, campaign.id, stageNum,
      result.enemyName, outcome,
      STAGE_FLAVOR[stageIndex]
    )

    if (result.survivors.length === 0) {
      await say(client, channel,
        `💀 All adventurers have fallen. The campaign ends in defeat. The channel cooldown is spent for today.`
      )
      await updateCampaign(supabase, campaign.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      return
    }

    await say(client, channel,
      `✅ Stage ${stageNum} cleared! Survivors: ${result.survivors.map(p => p.username).join(', ')}`
    )
    await delay(2000)
  }

  // Full clear!
  const survivors = participants.filter(p => p.is_alive)
  const fullClear = true
  const title = await drawTitle(supabase)
  const artifact = await drawArtifact(supabase)
  const artWinner = pickRandom(survivors)

  await updateCampaign(supabase, campaign.id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  await writeRewards(
    supabase, campaign.id, participants,
    fullClear, title, artWinner.username, artifact
  )

  await say(client, channel, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await say(client, channel,
    `🏆 CAMPAIGN COMPLETE! ${survivors.map(p => p.username).join(' & ')} defeated ${campaign.boss_name}!`
  )
  await say(client, channel,
    `🎖️  Title earned: [${title}] — awarded to all survivors!`
  )
  await say(client, channel,
    `🏺 Artifact drop: ${artifact} — claimed by ${artWinner.username}!`
  )
  await say(client, channel,
    `✨ Full clear bonus: +${CLEAR_BONUS_XP} XP and +${CLEAR_BONUS_GOLD} gold for all survivors!`
  )
}

// !campaign entry point
// Track pending party join windows: channel → Set of usernames
const pendingJoins = new Map<string, Set<string>>()
const campaignLock = new Map<string, boolean>()

export async function handleCampaignCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string
) {
  // Prevent concurrent initiations
  if (campaignLock.get(channel)) {
    await say(client, channel,
      `@${username} A campaign is already being set up. Hang tight!`
    )
    return
  }

  // Check daily cooldown via campaign_today view
  const existing = await getTodaysCampaign(supabase, channel)
  if (existing) {
    await say(client, channel,
      `@${username} The channel has already run a campaign today. ` +
      `The next campaign can begin tomorrow. The fallen rest — for now.`
    )
    return
  }

  // Check initiator has a living character
  const { data: initiatorChar } = await supabase
    .from('characters')
    .select('hp, is_dead')
    .eq('twitch_username', username.toLowerCase())
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

  campaignLock.set(channel, true)

  try {
    // Draw boss up front so it's ready
    const boss = await drawBoss(supabase)

    await say(client, channel,
      `⚔️  @${username} calls for a campaign! ` +
      `Type !solo to run alone or !joincamp to form a party (60 seconds to gather).`
    )

    // Wait for mode choice from initiator
    const mode = await waitForModeChoice(client, channel, username)

    if (mode === 'solo') {
      const campaign = await createCampaign(supabase, channel, username, 'solo', boss)
      await addParticipant(supabase, campaign.id, username)
      const participants = await getParticipants(supabase, campaign.id)

      await say(client, channel,
        `🗡️  ${username} enters the Shadowdale Gauntlet alone. ` +
        `Five stages await. The ${boss.boss_name} waits at the end.`
      )
      await delay(2000)

      await runCampaign(client, supabase, channel, campaign, participants)

    } else {
      // Party mode — open join window
      const campaign = await createCampaign(supabase, channel, username, 'party', boss)
      await addParticipant(supabase, campaign.id, username)

      const joiners = new Set<string>([username])
      pendingJoins.set(channel, joiners)

      await say(client, channel,
        `🛡️  Party forming! Type !joincamp to join the campaign. ` +
        `Window closes in 60 seconds. ` +
        `${username} is already in.`
      )

      await delay(JOIN_WINDOW_MS)
      pendingJoins.delete(channel)

      // Add all joiners to DB
      for (const joiner of joiners) {
        if (joiner !== username) {
          await addParticipant(supabase, campaign.id, joiner)
        }
      }

      const participants = await getParticipants(supabase, campaign.id)

      await say(client, channel,
        `⚔️  The party is set: ${[...joiners].join(', ')}. ` +
        `The Shadowdale Gauntlet begins. ${boss.boss_name} awaits at the end.`
      )
      await delay(2000)

      await runCampaign(client, supabase, channel, campaign, participants)
    }

  } finally {
    campaignLock.delete(channel)
  }
}

// !joincamp entry point
export async function handleJoinCampCommand(
  client: Client,
  channel: string,
  username: string
) {
  const joiners = pendingJoins.get(channel)
  if (!joiners) {
    await say(client, channel,
      `@${username} There's no campaign forming right now.`
    )
    return
  }

  const { data: joinerChar } = await supabase
    .from('characters')
    .select('hp, is_dead')
    .eq('twitch_username', username.toLowerCase())
    .single()

  if (!joinerChar || joinerChar.hp <= 0 || joinerChar.is_dead) {
    await say(client, channel,
      `@${username} You need a living character to join a campaign. Use !join to create one.`
    )
    return
  }

  if (joiners.has(username)) {
    await say(client, channel, `@${username} You're already in the party!`)
    return
  }

  joiners.add(username)
  await say(client, channel,
    `🛡️  ${username} joins the party! (${joiners.size} adventurers so far)`
  )
}

function waitForModeChoice(
  client: Client,
  channel: string,
  username: string
): Promise<'solo' | 'party'> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.removeListener('message', handler)
      // Default to solo after timeout
      resolve('solo')
    }, 30_000)

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