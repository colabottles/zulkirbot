import tmi from 'tmi.js'
import { getBrawlState, startJoinWindow, resetBrawl, addParticipant } from './tavernBrawl'

const tavernVisitors = new Set<string>()

export function markTavernVisit(username: string): void {
  tavernVisitors.add(username)
}

export function hasTavernVisit(username: string): boolean {
  return tavernVisitors.has(username)
}

export function clearTavernVisitors(): void {
  tavernVisitors.clear()
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
      client.say(
        channel,
        `🍺👊 TAVERN BRAWL BEGINS! ${brawl.participants.length} fighters enter the fray! ` +
        `Fists fly, chairs break, and someone's getting thrown through a window...`
      )
      runBrawl(channel, client)
    },
    () => {
      clearTavernVisitors()
      client.say(
        channel,
        `🍺 The brawl fizzled out — not enough fighters showed up. Cowards.`
      )
    }
  )

  addParticipant(username)

  client.say(
    channel,
    `🍺👊 A TAVERN BRAWL has broken out! @${username} threw the first punch! ` +
    `Type !brawl to join the fight! You have 30 seconds!`
  )
}

export async function runBrawl(channel: string, client: tmi.Client): Promise<void> {
  const brawl = getBrawlState()

  while (brawl.participants.length > 1) {
    const roundResults: string[] = []
    const toEliminate: string[] = []

    const hpMap = new Map<string, number>()
    for (const p of brawl.participants) {
      hpMap.set(p, 10)
    }

    for (let round = 0; round < 3; round++) {
      for (const attacker of [...brawl.participants]) {
        const opponents = brawl.participants.filter(p => p !== attacker)
        if (opponents.length === 0) break
        const target = opponents[Math.floor(Math.random() * opponents.length)]
        const damage = Math.floor(Math.random() * 4) + 1
        hpMap.set(target, (hpMap.get(target) ?? 0) - damage)
      }
    }

    for (const [player, hp] of hpMap.entries()) {
      if (hp <= 0) toEliminate.push(player)
    }

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

    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  const winner = brawl.participants[0]
  const numFighters = brawl.eliminated.length + 1
  const goldReward = numFighters * 15
  const xpReward = numFighters * 10

  if (winner) {
    const { supabase } = await import('../lib/supabase')

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', winner)
      .single()

    if (char) {
      await supabase
        .from('characters')
        .update({ gold: char.gold + goldReward, xp: char.xp + xpReward })
        .eq('twitch_username', winner)
    }

    for (const loser of brawl.eliminated) {
      await supabase
        .from('characters')
        .update({ hp: 0 })
        .eq('twitch_username', loser)
    }

    client.say(
      channel,
      `🏆 @${winner} is the last one standing in the tavern brawl! ` +
      `+${goldReward}gp +${xpReward} XP! ` +
      `Everyone else is face-down on the floor. Use !rest to recover.`
    )
  }

  resetBrawl()
  clearTavernVisitors()
}

function eliminateFromBrawl(username: string): void {
  const brawl = getBrawlState()
  brawl.participants = brawl.participants.filter(p => p !== username)
  brawl.eliminated.push(username)
}