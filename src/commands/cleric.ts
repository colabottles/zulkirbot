// ============================================================
// Brother Yvannis appears once per campaign at a random stage
// (1–4) alongside the rest shrine. Players can interact with
// him once per appearance to receive healing or cleansing.
// ============================================================

import { Client } from 'tmi.js'
import { SupabaseClient } from '@supabase/supabase-js'

interface YvannisService {
  key: string
  label: string
  description: string
  costPercent: number    // percentage of current gold
  requiresFlag?: string  // flag that must be active to use
  requiresLowHp?: boolean
}

const INTERACTION_WINDOW_MS = 90_000  // 90s for players to interact

const SERVICES: YvannisService[] = [
  {
    key: 'cure_disease',
    label: 'Cure Disease',
    description: 'Cleanses an active disease afflicting you.',
    costPercent: 0.10,
    requiresFlag: 'disease',
  },
  {
    key: 'cure_blindness',
    label: 'Cure Blindness',
    description: 'Restores sight taken by undead corruption.',
    costPercent: 0.10,
    requiresFlag: 'blindness',
  },
  {
    key: 'cure_paralysis',
    label: 'Cure Paralysis',
    description: 'Breaks the grip of unnatural paralysis.',
    costPercent: 0.15,
    requiresFlag: 'paralysis',
  },
  {
    key: 'heal',
    label: 'Heal',
    description: 'Restores your HP to full.',
    costPercent: 0.20,
    requiresLowHp: true,
  },
  {
    key: 'wish',
    label: 'Wish',
    description: 'Removes the lingering corruption of the Crystal of Rafiel.',
    costPercent: 0.40,
    requiresFlag: 'corruption_stabilized',
  },
]

const APPEARANCE_LINES = [
  'Ah. Adventurers. It\'s fine. Everything is fine. Brother Yvannis is here.',
  'Don\'t mind the blood. Mine or yours, it doesn\'t matter. I can help. Probably.',
  'I\'ve seen worse. I think. It\'s fine. What do you need?',
  'The light of the divine reaches even here. Barely. It\'s fine.',
  'Brother Yvannis arrives. The situation is under control. Mostly. It\'s fine.',
]

const DEPARTURE_LINES = [
  'Go. Be well. It\'s fine. Everything is — it\'s fine.',
  'Brother Yvannis must press on. There are others. It\'s always fine in the end.',
  'May the divine watch over you. I\'ll be fine. You\'ll be fine. It\'s all fine.',
  'Right then. Off I go. Into the dark. It\'s fine.',
  'Yvannis out. Everything is fine. Don\'t look at what\'s behind me.',
]

const NOTHING_TO_DO_LINES = [
  'You seem... fine, actually. Brother Yvannis appreciates that. Move along.',
  'I\'d help but there\'s nothing to help with. Which is fine. Refreshing, even.',
  'No disease, no curse, full health. You\'re doing better than most. It\'s fine.',
  'Nothing afflicts you. Yvannis is pleased. And slightly suspicious. It\'s fine.',
]

const CANT_AFFORD_LINES = [
  'Gold. You need gold. Brother Yvannis requires gold. This is not negotiable. Sorry.',
  'I\'m a man of faith, not charity. Come back with more gold. It\'s fine.',
  'The divine has overhead costs. You can\'t afford this. It\'s... less fine.',
  'Not enough gold. Yvannis is sorry. It will be fine. Eventually.',
]

const ALREADY_SERVED_LINES = [
  'Brother Yvannis has already helped you today. Generously. It\'s fine. Move along.',
  'One miracle per customer. That\'s the rule. It\'s fine.',
  'You\'ve had your turn. Yvannis must attend to others. It\'s fine.',
]

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const say = (client: Client, channel: string, msg: string) =>
  client.say(channel, msg)

interface YvannisSession {
  campaignId: string
  stage: number
  servedPlayers: Set<string>
  participantHps: Map<string, number>    // username → current HP
  participantMaxHps: Map<string, number> // username → max HP
}

const activeSessions = new Map<string, YvannisSession>()

async function getAvailableServices(
  supabase: SupabaseClient,
  username: string,
  currentHp: number,
  maxHp: number
): Promise<YvannisService[]> {
  // Fetch all active consequence/debuff flags for player
  const { data: flags } = await supabase
    .from('player_consequence_flags')
    .select('flag_type')
    .eq('username', username)
    .eq('is_active', true)

  const activeFlags = new Set((flags ?? []).map((f: { flag_type: string }) => f.flag_type))

  return SERVICES.filter(service => {
    if (service.requiresFlag) {
      return activeFlags.has(service.requiresFlag)
    }
    if (service.requiresLowHp) {
      return currentHp < maxHp
    }
    return false
  })
}

function calculateCost(gold: number, percent: number): number {
  return Math.max(1, Math.floor(gold * percent))
}

async function applyService(
  supabase: SupabaseClient,
  username: string,
  service: YvannisService,
  session: YvannisSession
): Promise<string> {
  switch (service.key) {
    case 'cure_disease':
    case 'cure_blindness':
    case 'cure_paralysis': {
      await supabase
        .from('player_consequence_flags')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('username', username)
        .eq('flag_type', service.requiresFlag!)
        .eq('is_active', true)

      const messages: Record<string, string> = {
        cure_disease: 'The sickness leaves your body like smoke in wind.',
        cure_blindness: 'Light floods back. You can see clearly again.',
        cure_paralysis: 'The unnatural stillness breaks. Your limbs are your own again.',
      }
      return messages[service.key]
    }

    case 'heal': {
      const maxHp = session.participantMaxHps.get(username) ?? 100
      session.participantHps.set(username, maxHp)

      await supabase
        .from('campaign_participants')
        .update({ hp: maxHp })
        .eq('campaign_id', session.campaignId)
        .eq('username', username)

      // Also update characters table HP
      await supabase
        .from('characters')
        .update({ hp: maxHp })
        .eq('twitch_username', username)

      return `Your wounds close completely. HP restored to ${maxHp}/${maxHp}.`
    }

    case 'wish': {
      await supabase
        .from('player_consequence_flags')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('username', username)
        .eq('flag_type', 'corruption_stabilized')
        .eq('is_active', true)

      return 'The corruption of the Crystal lifts. Your aim is steady once more.'
    }

    default:
      return 'Something was done. It\'s fine.'
  }
}

export async function summonYvannis(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  campaignId: string,
  stage: number,
  participants: { username: string; hp: number; max_hp: number; is_alive: boolean }[]
) {
  const living = participants.filter(p => p.is_alive)
  if (living.length === 0) return

  // Build HP maps for the session
  const participantHps = new Map<string, number>()
  const participantMaxHps = new Map<string, number>()
  for (const p of living) {
    participantHps.set(p.username, p.hp)
    participantMaxHps.set(p.username, p.max_hp)
  }

  const session: YvannisSession = {
    campaignId,
    stage,
    servedPlayers: new Set(),
    participantHps,
    participantMaxHps,
  }

  activeSessions.set(channel, session)

  // Appearance
  await say(client, channel, `🕯️  ${pickRandom(APPEARANCE_LINES)}`)
  await delay(1500)
  await say(client, channel,
    `✨ Brother Yvannis offers his services to: ${living.map(p => p.username).join(', ')}. ` +
    `Type !cleric to see what he can do for you. You have 90 seconds.`
  )

  // Wait for interaction window
  await delay(INTERACTION_WINDOW_MS)

  // Departure
  activeSessions.delete(channel)
  await say(client, channel, `🚶 ${pickRandom(DEPARTURE_LINES)}`)
}

// ------------------------------------------------------------
// !cleric command handler
// Called from router when a player types !cleric
// ------------------------------------------------------------

export async function handleClericCommand(
  client: Client,
  supabase: SupabaseClient,
  channel: string,
  username: string,
  args: string[]
) {
  const session = activeSessions.get(channel)

  if (!session) {
    await say(client, channel,
      `@${username} Brother Yvannis is not here right now. ` +
      `He appears during campaigns at rest shrines. It\'s fine.`
    )
    return
  }

  // Check if player is a living participant
  if (!session.participantHps.has(username)) {
    await say(client, channel,
      `@${username} Brother Yvannis squints at you. You\'re not part of this campaign. It\'s fine. Move along.`
    )
    return
  }

  // Check if already served
  if (session.servedPlayers.has(username)) {
    await say(client, channel, `@${username} ${pickRandom(ALREADY_SERVED_LINES)}`)
    return
  }

  const currentHp = session.participantHps.get(username) ?? 100
  const maxHp = session.participantMaxHps.get(username) ?? 100

  // Get available services for this player
  const available = await getAvailableServices(supabase, username, currentHp, maxHp)

  // No argument — show menu
  const choiceArg = args[0]

  if (!choiceArg) {
    if (available.length === 0) {
      await say(client, channel,
        `@${username} ${pickRandom(NOTHING_TO_DO_LINES)}`
      )
      session.servedPlayers.add(username)
      return
    }

    // Fetch current gold for cost display
    const { data: char } = await supabase
      .from('characters')
      .select('gold')
      .eq('twitch_username', username)
      .single()

    const gold = char?.gold ?? 0

    const menu = available
      .map((s, i) => {
        const cost = calculateCost(gold, s.costPercent)
        return `${i + 1}) ${s.label} — ${cost}g`
      })
      .join(' | ')

    await say(client, channel,
      `@${username} Brother Yvannis tilts his head. "What ails you?" ` +
      `Your options: ${menu}. Type !cleric <number> to choose.`
    )
    return
  }

  // Player chose a number
  const choiceNum = parseInt(choiceArg, 10)
  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > available.length) {
    await say(client, channel,
      `@${username} That\'s not a valid choice. Type !cleric to see your options.`
    )
    return
  }

  const chosen = available[choiceNum - 1]

  // Fetch gold
  const { data: char } = await supabase
    .from('characters')
    .select('gold')
    .eq('twitch_username', username)
    .single()

  if (!char) {
    await say(client, channel,
      `@${username} Brother Yvannis can\'t find your record. It\'s fine. Probably.`
    )
    return
  }

  const cost = calculateCost(char.gold, chosen.costPercent)

  // Can't afford
  if (char.gold < cost) {
    await say(client, channel,
      `@${username} ${pickRandom(CANT_AFFORD_LINES)} ` +
      `${chosen.label} costs ${cost}g. You have ${char.gold}g.`
    )
    return
  }

  // Deduct gold
  await supabase
    .from('characters')
    .update({ gold: char.gold - cost })
    .eq('twitch_username', username)

  // Apply effect
  const resultMsg = await applyService(supabase, username, chosen, session)

  // Mark as served
  session.servedPlayers.add(username)

  await say(client, channel,
    `✨ @${username} — Brother Yvannis performs ${chosen.label}. ` +
    `${resultMsg} (-${cost}g)`
  )
  await delay(800)
  await say(client, channel,
    `🙏 "It\'s fine. You\'re going to be fine. Probably." — Brother Yvannis`
  )
}

export function rollYvannisStage(): number {
  // Random stage between 1 and 4
  return Math.floor(Math.random() * 4) + 1
}

export function isYvannisPresent(channel: string): boolean {
  return activeSessions.has(channel)
}