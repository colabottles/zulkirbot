import { Client } from 'tmi.js'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getDisplayName } from '../lib/displayName'
import { campaignAttackPending } from './campaign'

const JOIN_WINDOW_MS = 180_000
const ROUND_DELAY_MS = 1_000
const WAVE_DELAY_MS = 3_000

// XP and gold per wave cleared (all survivors get this)
const WAVE_XP = [60, 100, 150, 200, 275, 350]
const WAVE_GOLD = [25, 45, 70, 100, 140, 180]

const ARENA_INTROS = [
  '🏟️ The crowd roars as the gates grind open...',
  '🏟️ A horn blast silences the crowd. The announcer screams into the void...',
  '🏟️ The sand is already stained from the last bout. The next begins now...',
  '🏟️ Torchlight blazes around the arena walls. The crowd is hungry...',
]

const WAVE_FLAVOR: Record<number, string> = {
  0: '🏟️ Wave 1 — The gates burst open and a pack of hyenas tear across the sand!',
  1: '🏟️ Wave 2 — A pair of armored gladiators stride out to thunderous applause!',
  2: '🏟️ Wave 3 — The crowd gasps as a manticore is unchained from the east gate!',
  3: '🏟️ Wave 4 — Torches are doused. Something moves in the dark...',
  4: '🏟️ Wave 5 — The arena master himself descends from the box seat, blade drawn!',
  5: '🏟️ Final Wave — The champion of champions. Undefeated. Until now.',
}

const CROWD_TAUNTS = [
  '📣 The crowd boos as blood hits the sand!',
  '📣 A cheer erupts from the upper tier!',
  '📣 Someone in the crowd throws a chicken leg. It lands near @{username}.',
  '📣 "FINISH THEM!" the crowd chants in unison.',
  '📣 The announcer is running out of adjectives.',
]

interface ArenaParticipant {
  username: string
  character_name: string | null
  hp: number
  max_hp: number
  is_alive: boolean
}

interface ArenaEnemy {
  name: string
  hp: number
  damage: [number, number]
  special?: string
  specialDamage?: number
}

// Active join window — channel → Set of usernames
const pendingArenaJoins = new Map<string, Set<string>>()

// Active arena lock — prevent multiple arenas per channel
const activeArenas = new Set<string>()

const roll = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const say = (client: Client, channel: string, msg: string) =>
  client.say(channel, msg)

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

function waveCount(participantCount: number): number {
  if (participantCount >= 5) return 6
  if (participantCount >= 3) return 5
  return 4
}

function getWaveEnemy(waveIndex: number, avgLevel: number): ArenaEnemy {
  const s = Math.max(1, Math.min(avgLevel, 10))
  const enemies: ArenaEnemy[] = [
    {
      // Wave 1 — fast, light, swarm feel
      name: 'Giant Hyena Pack',
      hp: 14 + s * 3,
      damage: [2 + s, 6 + s] as [number, number],
    },
    {
      // Wave 2 — trained human fighters
      name: 'Retiarius Gladiator',
      hp: 24 + s * 4,
      damage: [4 + s, 8 + s * 2] as [number, number],
      special: 'Net Throw',
      specialDamage: 8 + s,
    },
    {
      // Wave 3 — exotic beast
      name: 'Manticore',
      hp: 42 + s * 8,
      damage: [6 + s * 2, 11 + s * 2] as [number, number],
      special: 'Tail Spike Volley',
      specialDamage: 12 + s * 2,
    },
    {
      // Wave 4 — shadow/ambush predator, unsettling
      name: 'Darkmantle Swarm',
      hp: 50 + s * 9,
      damage: [7 + s * 2, 13 + s * 2] as [number, number],
      special: 'Darkness Pulse',
      specialDamage: 15 + s * 2,
    },
    {
      // Wave 5 — the arena master, veteran fighter
      name: 'The Arena Master',
      hp: 68 + s * 10,
      damage: [8 + s * 2, 15 + s * 2] as [number, number],
      special: 'Executioner\'s Strike',
      specialDamage: 18 + s * 2,
    },
    {
      // Final wave — legendary undefeated champion
      name: 'Valdris the Unbroken',
      hp: 95 + s * 15,
      damage: [11 + s * 2, 19 + s * 3] as [number, number],
      special: 'Wrath of the Undefeated',
      specialDamage: 22 + s * 3,
    },
  ]
  return enemies[Math.min(waveIndex, enemies.length - 1)]
}

function getPlayerDamageRange(avgLevel: number): [number, number] {
  const s = Math.max(1, Math.min(avgLevel, 10))
  return [8 + s * 2, 18 + s * 2]
}

function waitForArenaAttack(username: string, timeoutMs = 8_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      campaignAttackPending.delete(username)
      resolve()
    }, timeoutMs)

    campaignAttackPending.set(username, () => {
      clearTimeout(timer)
      campaignAttackPending.delete(username)
      resolve()
    })
  })
}

async function runWave(
  client: Client,
  channel: string,
  participants: ArenaParticipant[],
  waveIndex: number,
  avgLevel: number
): Promise<void> {
  const enemy = getWaveEnemy(waveIndex, avgLevel)
  let enemyHp = enemy.hp
  let round = 1
  let specialFired = false

  await say(client, channel, WAVE_FLAVOR[waveIndex] ?? `⚔️ Wave ${waveIndex + 1} begins!`)
  await delay(WAVE_DELAY_MS)

  while (enemyHp > 0 && participants.some(p => p.is_alive)) {
    await say(client, channel, `⚔️ Round ${round} — ${enemy.name} (${enemyHp} HP remaining)`)
    await delay(ROUND_DELAY_MS)

    // Players attack in random order
    const alive = participants.filter(p => p.is_alive).sort(() => Math.random() - 0.5)

    for (const player of alive) {
      if (enemyHp <= 0) break

      await say(client, channel,
        `@${player.username} (${getDisplayName(player.username, player)}) — type !attack to strike the ${enemy.name}!`
      )

      await waitForArenaAttack(player.username, 8_000)

      if (enemyHp <= 0) break

      const [minDmg, maxDmg] = getPlayerDamageRange(avgLevel)
      const dmg = roll(minDmg, maxDmg)
      enemyHp = Math.max(0, enemyHp - dmg)

      await say(client, channel,
        `🗡️ @${player.username} (${getDisplayName(player.username, player)}) hits ${enemy.name} for ${dmg} damage! ` +
        `(${enemyHp} HP remaining)`
      )
      await delay(ROUND_DELAY_MS)

      if (enemyHp === 0) {
        await say(client, channel, `💥 ${enemy.name} has been defeated! The crowd erupts!`)
        await delay(1_500)
      }
    }

    if (enemyHp <= 0) break

    // Enemy strikes back
    const target = pickRandom(participants.filter(p => p.is_alive))
    if (!target) break

    if (!specialFired && round === 2 && enemy.special) {
      const specialDmg = enemy.specialDamage ?? 15
      target.hp = Math.max(0, target.hp - specialDmg)
      await say(client, channel,
        `⚡ ${enemy.name} uses ${enemy.special}! ` +
        `@${target.username} (${getDisplayName(target.username, target)}) takes ${specialDmg} damage! ` +
        `(${target.hp} HP)`
      )
      specialFired = true
    } else {
      const dmg = roll(enemy.damage[0], enemy.damage[1])
      target.hp = Math.max(0, target.hp - dmg)
      await say(client, channel,
        `🩸 ${enemy.name} strikes @${target.username} (${getDisplayName(target.username, target)}) for ${dmg} damage! ` +
        `(${target.hp} HP remaining)`
      )
    }

    await delay(ROUND_DELAY_MS)

    if (target.hp <= 0) {
      target.is_alive = false
      await say(client, channel,
        `💀 @${target.username} (${getDisplayName(target.username, target)}) has fallen! ` +
        `${pickRandom(CROWD_TAUNTS).replace('{username}', target.username)}`
      )
      await delay(1_200)
    }

    // Round cap — enemy routed
    if (round >= 8) {
      enemyHp = 0
      await say(client, channel, `⚡ ${enemy.name} is overwhelmed and driven from the arena!`)
    }

    round++
    await delay(ROUND_DELAY_MS)
  }
}

async function runArena(
  client: Client,
  channel: string,
  participants: ArenaParticipant[],
  avgLevel: number
): Promise<void> {
  const totalWaves = waveCount(participants.length)
  let wavesCleared = 0

  await say(client, channel,
    `🏟️ The arena begins! ${participants.map(p => `@${p.username}`).join(', ')} — ` +
    `${totalWaves} waves stand between you and glory. Level range: ~${avgLevel}. No dying permanently. Good luck.`
  )
  await delay(2_000)

  for (let waveIndex = 0; waveIndex < totalWaves; waveIndex++) {
    const alive = participants.filter(p => p.is_alive)
    if (alive.length === 0) break

    await runWave(client, channel, participants, waveIndex, avgLevel)
    await delay(WAVE_DELAY_MS)

    const stillAlive = participants.filter(p => p.is_alive)

    if (stillAlive.length === 0) {
      await say(client, channel,
        `💀 The last gladiator falls. The crowd is silent. The arena wins today.`
      )
      break
    }

    wavesCleared++
    await say(client, channel,
      `✅ Wave ${waveIndex + 1} cleared! Still standing: ` +
      `${stillAlive.map(p => `@${p.username} (${p.hp} HP)`).join(', ')}`
    )
    await delay(2_000)
  }

  // Resolve results
  const survivors = participants.filter(p => p.is_alive)
  const fallen = participants.filter(p => !p.is_alive)

  // Set fallen players to 0 HP in DB
  for (const p of fallen) {
    await supabase
      .from('characters')
      .update({ hp: 0 })
      .eq('twitch_username', p.username)
  }

  if (wavesCleared === 0) return

  // Award XP and gold to survivors based on waves cleared
  const xpReward = WAVE_XP.slice(0, wavesCleared).reduce((a, b) => a + b, 0)
  const goldReward = WAVE_GOLD.slice(0, wavesCleared).reduce((a, b) => a + b, 0)

  for (const p of survivors) {
    const { data: char } = await supabase
      .from('characters')
      .select('xp, gold')
      .eq('twitch_username', p.username)
      .single()

    if (char) {
      await supabase
        .from('characters')
        .update({ xp: char.xp + xpReward, gold: char.gold + goldReward })
        .eq('twitch_username', p.username)
    }
  }

  if (survivors.length > 0) {
    await say(client, channel,
      `🏆 ARENA COMPLETE! ${survivors.map(p => `@${p.username}`).join(', ')} survived ${wavesCleared} wave${wavesCleared !== 1 ? 's' : ''}! ` +
      `+${xpReward} XP and +${goldReward}gp to all survivors! Use !rest to recover HP.`
    )
  }

  if (fallen.length > 0) {
    await say(client, channel,
      `🩸 ${fallen.map(p => `@${p.username}`).join(', ')} fell in the arena and are at 0 HP — use !rest to recover.`
    )
  }
}

export async function handleArenaCommand(
  client: Client,
  channel: string,
  username: string
): Promise<void> {
  if (activeArenas.has(channel)) {
    client.say(channel, `@${username} — an arena event is already active.`)
    return
  }

  activeArenas.add(channel)

  try {
    const joiners = new Set<string>()
    pendingArenaJoins.set(channel, joiners)

    await say(client, channel,
      `${pickRandom(ARENA_INTROS)} ` +
      `⚔️ GLADIATOR ARENA is open! Type !enterarena to join. ` +
      `3 minutes to enter — 6 gladiators is the ideal number for a full run. ` +
      `No permadeath — but losers leave at 0 HP.`
    )

    await delay(JOIN_WINDOW_MS)
    pendingArenaJoins.delete(channel)

    if (joiners.size === 0) {
      await say(client, channel, `🏟️ No one entered the arena. The crowd demands a refund.`)
      activeArenas.delete(channel)
      return
    }

    // Load participants from DB
    const participants: ArenaParticipant[] = []

    for (const joiner of joiners) {
      const { data: char } = await supabase
        .from('characters')
        .select('hp, max_hp, character_name')
        .eq('twitch_username', joiner)
        .single()

      if (char && char.hp > 0) {
        participants.push({
          username: joiner,
          character_name: char.character_name ?? null,
          hp: char.hp,
          max_hp: char.max_hp,
          is_alive: true,
        })
      }
    }

    if (participants.length === 0) {
      await say(client, channel, `🏟️ No valid gladiators found. Everyone who entered was dead already.`)
      activeArenas.delete(channel)
      return
    }

    // Average level for scaling
    const levelResults = await Promise.all(
      participants.map(p =>
        supabase
          .from('characters')
          .select('level')
          .eq('twitch_username', p.username)
          .single()
          .then(({ data }) => data?.level ?? 1)
      )
    )
    const avgLevel = Math.round(
      levelResults.reduce((a, b) => a + b, 0) / levelResults.length
    )

    await runArena(client, channel, participants, avgLevel)

  } catch (err) {
    console.error('[arena] error:', err)
    await say(client, channel, `Something went wrong in the arena. The dungeon master is embarrassed.`)
  } finally {
    activeArenas.delete(channel)
  }
}

export async function handleEnterArenaCommand(
  client: Client,
  channel: string,
  username: string
): Promise<void> {
  const joiners = pendingArenaJoins.get(channel)

  if (!joiners) {
    client.say(channel, `@${username} — there's no arena open right now.`)
    return
  }

  if (joiners.has(username)) {
    client.say(channel, `@${username} — you're already in the arena.`)
    return
  }

  const { data: char } = await supabase
    .from('characters')
    .select('hp')
    .eq('twitch_username', username.toLowerCase())
    .single()

  if (!char || char.hp <= 0) {
    client.say(channel, `@${username} — you need a living character to enter the arena. Use !rest or !join.`)
    return
  }

  joiners.add(username)
  await say(client, channel,
    `🗡️ @${username} steps into the arena! (${joiners.size} gladiator${joiners.size !== 1 ? 's' : ''} so far)`
  )
}