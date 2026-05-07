import { supabase } from '../lib/supabase'
import { getDisplayName } from '../lib/displayName'
import { d8, d20 } from './dice'
import { getCharacterStats } from '../lib/stats'
import { getBossById, InvasionBoss } from './invasionBosses'
import { shouldDropLoot, rollLoot } from './loot'
import { formatRarity } from '../lib/rarity'
import tmi from 'tmi.js'

// ── Types ────────────────────────────────────────────────────

export interface ActiveInvasion {
  boss: InvasionBoss
  current_hp: number
  max_hp: number
  phase: 'joining' | 'fighting' | 'complete'
  started_at: number
  join_deadline: number
  fight_deadline: number
  participants: Set<string>           // twitch usernames
  damage_dealt: Map<string, number>   // username → total damage
  channel: string
  client: tmi.Client
  joinTimer?: ReturnType<typeof setTimeout>
  fightTimer?: ReturnType<typeof setTimeout>
  updateInterval?: ReturnType<typeof setInterval>
}

// ── State ────────────────────────────────────────────────────

export let activeInvasion: ActiveInvasion | null = null

const JOIN_WINDOW_MS = 2 * 60 * 1000   // 2 minutes to join
const FIGHT_WINDOW_MS = 10 * 60 * 1000  // 10 minutes to kill

// ── Start ────────────────────────────────────────────────────

export async function startInvasion(
  channel: string,
  bossId: string,
  client: tmi.Client
): Promise<void> {
  if (activeInvasion) {
    client.say(channel, `⚔️ An invasion is already underway! ${activeInvasion.boss.name} is still standing!`)
    return
  }

  const boss = getBossById(bossId)
  if (!boss) {
    const ids = ['acererak', 'vecna', 'larloch', 'orcus', 'demogorgon', 'tiamat', 'yeenoghu', 'asmodeus', 'tharizdun', 'bane', 'shar']
    client.say(channel, `❌ Unknown boss. Available: ${ids.join(', ')}`)
    return
  }

  const now = Date.now()

  activeInvasion = {
    boss,
    current_hp: 0,       // set when fight begins, after we know participant count
    max_hp: 0,
    phase: 'joining',
    started_at: now,
    join_deadline: now + JOIN_WINDOW_MS,
    fight_deadline: now + JOIN_WINDOW_MS + FIGHT_WINDOW_MS,
    participants: new Set(),
    damage_dealt: new Map(),
    channel,
    client,
  }

  client.say(channel, boss.announce_text)
  client.say(channel, `📋 Type !joinevent to enlist! Join window closes in 2 minutes.`)

  activeInvasion.joinTimer = setTimeout(() => closejoinWindow(channel, client), JOIN_WINDOW_MS)
}

// ── Join ─────────────────────────────────────────────────────

export async function joinInvasion(
  channel: string,
  username: string,
  client: tmi.Client
): Promise<void> {
  if (!activeInvasion) {
    client.say(channel, `@${username} — there's no invasion underway right now.`)
    return
  }

  if (activeInvasion.phase !== 'joining') {
    client.say(channel, `@${username} — the battle has already begun! You can't join mid-fight.`)
    return
  }

  if (activeInvasion.participants.has(username)) {
    client.say(channel, `@${username} — you're already enlisted!`)
    return
  }

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) {
    client.say(channel, `@${username} — you need a character first! Use !join to create one.`)
    return
  }

  if (char.hp <= 0) {
    client.say(channel, `@${username} — you're dead! Use !join to start over before enlisting.`)
    return
  }

  activeInvasion.participants.add(username)
  activeInvasion.damage_dealt.set(username, 0)

  const displayName = getDisplayName(username, char)
  const count = activeInvasion.participants.size
  client.say(channel, `⚔️ @${username} (${displayName}) joins the battle! [${count} enlisted]`)
}

// ── Close join window & begin fight ─────────────────────────

async function closejoinWindow(channel: string, client: tmi.Client): Promise<void> {
  if (!activeInvasion) return

  const count = activeInvasion.participants.size

  if (count === 0) {
    client.say(channel, `😶 No adventurers answered the call. ${activeInvasion.boss.name} laughs and departs... for now.`)
    activeInvasion = null
    return
  }

  // Scale HP to participant count
  const hp = activeInvasion.boss.base_hp + (count * activeInvasion.boss.hp_per_player)
  activeInvasion.current_hp = hp
  activeInvasion.max_hp = hp
  activeInvasion.phase = 'fighting'

  const tierLabel = activeInvasion.boss.tier === 3 ? 'TRUE GOD' : activeInvasion.boss.tier === 2 ? 'DEMIGOD' : 'LEGENDARY'

  client.say(
    channel,
    `🔔 The join window is closed! ${count} adventurer${count === 1 ? '' : 's'} face ` +
    `${activeInvasion.boss.name}, ${activeInvasion.boss.title} [${tierLabel} | HP: ${hp}]. ` +
    `Type !joinevent to attack! You have 10 minutes!`
  )

  // Periodic HP updates every 2 minutes
  activeInvasion.updateInterval = setInterval(() => postHpUpdate(channel, client), 2 * 60 * 1000)

  // Fight deadline — if time runs out, boss wins
  activeInvasion.fightTimer = setTimeout(() => invasionDefeat(channel, client), FIGHT_WINDOW_MS)
}

// ── Attack ───────────────────────────────────────────────────

export async function attackInvasionBoss(
  channel: string,
  username: string,
  client: tmi.Client
): Promise<void> {
  if (!activeInvasion || activeInvasion.phase !== 'fighting') {
    client.say(channel, `@${username} — there's no active invasion battle right now.`)
    return
  }

  if (!activeInvasion.participants.has(username)) {
    client.say(channel, `@${username} — you didn't enlist! You can't join mid-fight.`)
    return
  }

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const displayName = getDisplayName(username, char)
  const stats = await getCharacterStats(char)

  // Attack roll
  const roll = d20()
  const hit = roll + 2 + stats.attackBonus > activeInvasion.boss.tier * 8 + 5

  if (!hit) {
    client.say(channel, `⚔️ @${username} (${displayName}) swings at ${activeInvasion.boss.name} but misses! [Boss HP: ${activeInvasion.current_hp}/${activeInvasion.max_hp}]`)
    return
  }

  const damage = Math.max(1, d8() + stats.damageBonus)
  activeInvasion.current_hp = Math.max(0, activeInvasion.current_hp - damage)
  activeInvasion.damage_dealt.set(username, (activeInvasion.damage_dealt.get(username) ?? 0) + damage)

  // Boss counterattack — periodic, 1-in-4 chance each hit
  let counterMsg = ''
  if (Math.random() < 0.25) {
    const bossDmg = activeInvasion.boss.tier * 8 + Math.floor(Math.random() * 10)
    counterMsg = ` 💢 ${activeInvasion.boss.name} retaliates! All combatants take ${bossDmg} damage this round!`
    // Apply to all participants in DB
    for (const participant of activeInvasion.participants) {
      try { await supabase.rpc('reduce_hp', { _username: participant, _amount: bossDmg }) } catch { /* non-fatal */ }
    }
  }

  client.say(
    channel,
    `💥 @${username} (${displayName}) hits ${activeInvasion.boss.name} for ${damage} damage!${counterMsg} ` +
    `[Boss HP: ${activeInvasion.current_hp}/${activeInvasion.max_hp}]`
  )

  if (activeInvasion.current_hp <= 0) {
    await invasionVictory(channel, client)
  }
}

// ── Victory ──────────────────────────────────────────────────

async function invasionVictory(channel: string, client: tmi.Client): Promise<void> {
  if (!activeInvasion) return

  clearTimers()

  const { boss, participants, damage_dealt } = activeInvasion
  activeInvasion.phase = 'complete'

  client.say(channel, `🏆 ${boss.victory_text}`)

  const participantList = [...participants]

  for (const username of participantList) {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) continue

    const displayName = getDisplayName(username, char)
    const newXp = char.xp + boss.xp_reward
    const newGold = char.gold + boss.gold_reward

    let lootMsg = ''
    if (Math.random() < boss.legendary_drop_chance) {
      const item = rollLoot()
      await supabase.from('inventory').insert({
        character_id: char.id,
        item_name: item.name,
        item_type: item.type,
        rarity: item.rarity,
        stat_bonus: item.stat_bonus,
        description: item.description,
      })
      lootMsg = ` 🎁 LEGENDARY DROP: ${formatRarity(item.rarity)} ${item.name}!`
    }

    // Grant invasion title
    await supabase.from('player_titles').upsert({
      username: username,
      title: boss.title_reward,
      created_at: new Date().toISOString(),
    }, { onConflict: 'username,title' })

    await supabase.from('characters').update({
      xp: newXp,
      gold: newGold,
    }).eq('twitch_username', username)

    const dmgDealt = damage_dealt.get(username) ?? 0

    client.say(
      channel,
      `🏅 @${username} (${displayName}) — +${boss.xp_reward} XP | +${boss.gold_reward}gp | ` +
      `Title: "${boss.title_reward}" | Damage dealt: ${dmgDealt}${lootMsg}`
    )
  }

  activeInvasion = null
}

// ── Defeat ───────────────────────────────────────────────────

async function invasionDefeat(channel: string, client: tmi.Client): Promise<void> {
  if (!activeInvasion) return

  clearTimers()

  client.say(channel, `⏰ Time has run out! ${activeInvasion.boss.defeat_text}`)

  activeInvasion = null
}

// ── Cancel ───────────────────────────────────────────────────

export function cancelInvasion(channel: string, client: tmi.Client): void {
  if (!activeInvasion) {
    client.say(channel, `There's no active invasion to cancel.`)
    return
  }

  clearTimers()
  client.say(channel, `🚫 The invasion has been called off. ${activeInvasion.boss.name} withdraws... for now.`)
  activeInvasion = null
}

// ── Status ───────────────────────────────────────────────────

export function invasionStatus(channel: string, client: tmi.Client): void {
  if (!activeInvasion) {
    client.say(channel, `No invasion is currently active.`)
    return
  }

  const { boss, phase, current_hp, max_hp, participants, join_deadline, fight_deadline } = activeInvasion
  const now = Date.now()

  if (phase === 'joining') {
    const secsLeft = Math.max(0, Math.floor((join_deadline - now) / 1000))
    client.say(channel, `📋 ${boss.name}, ${boss.title} approaches! ${participants.size} enlisted. Join window closes in ${secsLeft}s. Type !joinevent!`)
  } else if (phase === 'fighting') {
    const secsLeft = Math.max(0, Math.floor((fight_deadline - now) / 1000))
    const pct = Math.floor((current_hp / max_hp) * 100)
    client.say(channel, `⚔️ ${boss.name} — HP: ${current_hp}/${max_hp} (${pct}%) | ${participants.size} fighters | ${Math.floor(secsLeft / 60)}m ${secsLeft % 60}s remaining`)
  }
}

// ── Helpers ──────────────────────────────────────────────────

function postHpUpdate(channel: string, client: tmi.Client): void {
  if (!activeInvasion || activeInvasion.phase !== 'fighting') return
  const { boss, current_hp, max_hp, fight_deadline } = activeInvasion
  const now = Date.now()
  const secsLeft = Math.max(0, Math.floor((fight_deadline - now) / 1000))
  const pct = Math.floor((current_hp / max_hp) * 100)
  client.say(channel, `📊 ${boss.name} HP: ${current_hp}/${max_hp} (${pct}%) | ${Math.floor(secsLeft / 60)}m ${secsLeft % 60}s left — keep fighting!`)
}

function clearTimers(): void {
  if (!activeInvasion) return
  if (activeInvasion.joinTimer) clearTimeout(activeInvasion.joinTimer)
  if (activeInvasion.fightTimer) clearTimeout(activeInvasion.fightTimer)
  if (activeInvasion.updateInterval) clearInterval(activeInvasion.updateInterval)
}