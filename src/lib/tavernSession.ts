import tmi from 'tmi.js'
import { getBrawlState, startJoinWindow, resetBrawl } from './tavernBrawl'

const tavernVisitors = new Set<string>()

export function markTavernVisit(username: string): void {
  tavernVisitors.add(username)
}

export function hasTavernVisit(username: string): boolean {
  return tavernVisitors.has(username)
}

const BRAWL_CHANCE = 0.15

export function maybeStartBrawl(
  channel: string,
  username: string,
  client: tmi.Client
): void {
  const brawl = getBrawlState()
  if (brawl.active || brawl.joining) return
  if (Math.random() > BRAWL_CHANCE) return

  startJoinWindow(
    channel,
    () => {
      // Brawl starts
      client.say(
        channel,
        `🍺👊 TAVERN BRAWL BEGINS! ${brawl.participants.length} fighters enter the fray! ` +
        `Fists fly, chairs break, and someone's getting thrown through a window...`
      )
      runBrawl(channel, client)
    },
    () => {
      client.say(
        channel,
        `🍺 The brawl fizzled out — not enough fighters showed up. Cowards.`
      )
    }
  )

  // Add triggering player automatically
  const brawlState = getBrawlState()
  brawlState.participants.push(username)

  client.say(
    channel,
    `🍺👊 A TAVERN BRAWL has broken out! @${username} threw the first punch! ` +
    `Type !brawl to join the fight! You have 30 seconds!`
  )
}

export async function runBrawl(channel: string, client: tmi.Client): Promise<void> {
  const brawl = getBrawlState()

  // Simulate rounds until one player remains
  while (brawl.participants.length > 1) {
    // Each participant attacks a random opponent
    const roundResults: string[] = []
    const toEliminate: string[] = []

    // Simple damage model — each player rolls against a random opponent
    const hpMap = new Map<string, number>()
    for (const p of brawl.participants) {
      hpMap.set(p, 10)
    }

    // Run 3 rounds of combat
    for (let round = 0; round < 3; round++) {
      for (const attacker of [...brawl.participants]) {
        const opponents = brawl.participants.filter(p => p !== attacker)
        if (opponents.length === 0) break
        const target = opponents[Math.floor(Math.random() * opponents.length)]
        const damage = Math.floor(Math.random() * 4) + 1
        hpMap.set(target, (hpMap.get(target) ?? 0) - damage)
      }
    }

    // Eliminate anyone at 0 or below
    for (const [player, hp] of hpMap.entries()) {
      if (hp <= 0) toEliminate.push(player)
    }

    // Make sure at least one person gets eliminated per loop to avoid infinite loop
    if (toEliminate.length === 0) {
      const lowestHp = [...hpMap.entries()].sort((a, b) => a[1] - b[1])[0]
      toEliminate.push(lowestHp[0])
    }

    for (const p of toEliminate) {
      eliminateFromBrawl(p)
      roundResults.push(`@${p} goes down!`)
    }

    if (roundResults.length > 0) {
      client.say(channel, `👊 ${roundResults.join(' ')} ${brawl.participants.length} still standing!`)
    }

    // Small delay between rounds
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  // Declare winner
  const winner = brawl.participants[0]
  const numFighters = brawl.eliminated.length + 1
  const goldReward = numFighters * 15
  const xpReward = numFighters * 10

  if (winner) {
    const { data: char } = await (await import('../lib/supabase')).supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', winner)
      .single()

    if (char) {
      await (await import('../lib/supabase')).supabase
        .from('characters')
        .update({ gold: char.gold + goldReward, xp: char.xp + xpReward })
        .eq('twitch_username', winner)
    }

    // Set losers to 0 HP
    for (const loser of brawl.eliminated) {
      await (await import('../lib/supabase')).supabase
        .from('characters')
        .update({ hp: 0 })
        .eq('twitch_username', loser)
    }

    client.say(
      channel,
      `🏆 @${winner} is the last one standing in the tavern brawl! ` +
      `+${goldReward}g +${xpReward} XP! ` +
      `Everyone else is face-down on the floor. Use !rest to recover.`
    )
  }

  resetBrawl()
}

function eliminateFromBrawl(username: string): void {
  const brawl = getBrawlState()
  brawl.participants = brawl.participants.filter(p => p !== username)
  brawl.eliminated.push(username)
}