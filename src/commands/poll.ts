// ============================================================
// ZulkirBot: !poll Command
// ============================================================
// !poll "Question" Option1 | Option2 | Option3 — start a poll
// !poll stop                                    — end poll early
// Viewers type 1–5 to vote. One vote per viewer, changeable.
// 5 minute timer. Broadcaster only.
// ============================================================

import { BotCommand } from '../types'

const POLL_DURATION_MS = 5 * 60 * 1000

interface Poll {
  question: string
  options: string[]
  votes: Map<string, number> // username → option index (0-based)
  timer: ReturnType<typeof setTimeout>
  startedAt: number
}

const activePolls = new Map<string, Poll>()

function tallyResults(poll: Poll): { counts: number[]; total: number; winner: number | null } {
  const counts = poll.options.map(() => 0)
  for (const vote of poll.votes.values()) {
    counts[vote]++
  }
  const total = counts.reduce((a, b) => a + b, 0)
  const max = Math.max(...counts)
  const winners = counts.reduce<number[]>((acc, c, i) => c === max ? [...acc, i] : acc, [])
  const winner = winners.length === 1 ? winners[0] : null
  return { counts, total, winner }
}

function announcePollOpen(channel: string, poll: Poll, client: any) {
  const optionList = poll.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')
  client.say(channel,
    `📊 POLL: ${poll.question} | ${optionList} | Type the number to vote! Closes in 5 minutes.`
  )
}

function announcePollResults(channel: string, poll: Poll, client: any) {
  const { counts, total, winner } = tallyResults(poll)
  const results = poll.options
    .map((o, i) => {
      const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0
      return `${i + 1}) ${o} — ${counts[i]} vote${counts[i] !== 1 ? 's' : ''} (${pct}%)`
    })
    .join(' | ')

  client.say(channel, `📊 POLL CLOSED: ${poll.question} | ${results}`)

  if (total === 0) {
    client.say(channel, `No votes were cast.`)
  } else if (winner === null) {
    client.say(channel, `It's a tie!`)
  } else {
    client.say(channel, `🏆 Winner: ${poll.options[winner]}`)
  }
}

export const pollCommand: BotCommand = {
  name: 'poll',
  cooldownSeconds: 0,
  handler: async (channel, username, args, client) => {
    const isBroadcaster =
      username.toLowerCase() === channel.replace('#', '').toLowerCase()

    if (!isBroadcaster) {
      client.say(channel, `@${username} — only the broadcaster can run polls.`)
      return
    }

    // !poll stop
    if (args[0]?.toLowerCase() === 'stop') {
      const poll = activePolls.get(channel)
      if (!poll) {
        client.say(channel, `@${username} — there is no active poll to stop.`)
        return
      }
      clearTimeout(poll.timer)
      activePolls.delete(channel)
      announcePollResults(channel, poll, client)
      return
    }

    // Already running
    if (activePolls.has(channel)) {
      client.say(channel, `@${username} — a poll is already running. Use !poll stop to end it first.`)
      return
    }

    // Parse: !poll "Question" Option1 | Option2 | ...
    const raw = args.join(' ')
    const questionMatch = raw.match(/^"([^"]+)"\s+(.+)$/)

    if (!questionMatch) {
      client.say(channel,
        `@${username} — usage: !poll "Question" Option1 | Option2 | Option3`
      )
      return
    }

    const question = questionMatch[1].trim()
    const options = questionMatch[2]
      .split('|')
      .map(o => o.trim())
      .filter(o => o.length > 0)

    if (options.length < 2) {
      client.say(channel, `@${username} — polls need at least 2 options.`)
      return
    }

    if (options.length > 5) {
      client.say(channel, `@${username} — polls can have at most 5 options.`)
      return
    }

    const poll: Poll = {
      question,
      options,
      votes: new Map(),
      startedAt: Date.now(),
      timer: setTimeout(() => {
        activePolls.delete(channel)
        announcePollResults(channel, poll, client)
      }, POLL_DURATION_MS),
    }

    activePolls.set(channel, poll)
    announcePollOpen(channel, poll, client)

    // Reminder at 1 minute remaining
    setTimeout(() => {
      if (activePolls.has(channel)) {
        const optionList = poll.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')
        client.say(channel, `📊 POLL: 1 minute remaining! ${poll.question} | ${optionList}`)
      }
    }, POLL_DURATION_MS - 60_000)
  }
}

// Called from router.ts on every chat message to capture votes
export function handlePollVote(channel: string, username: string, message: string): void {
  const poll = activePolls.get(channel)
  if (!poll) return

  const trimmed = message.trim()
  const num = parseInt(trimmed, 10)
  if (isNaN(num) || num < 1 || num > poll.options.length) return
  if (trimmed !== String(num)) return // reject "1abc" etc

  poll.votes.set(username.toLowerCase(), num - 1)
}