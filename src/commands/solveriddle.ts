import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { triggerHazard } from '../lib/applyHazard'

interface PendingRiddle {
  answer: string
  expiresAt: number
  wrongAttempts: number
  timeoutHandle: ReturnType<typeof setTimeout>
}

export const pendingRiddles = new Map<string, PendingRiddle>()

export function setPendingRiddle(
  username: string,
  answer: string,
  onExpire: () => void
): void {
  const existing = pendingRiddles.get(username)
  if (existing) clearTimeout(existing.timeoutHandle)

  const timeoutHandle = setTimeout(() => {
    pendingRiddles.delete(username)
    onExpire()
  }, 60_000)

  pendingRiddles.set(username, {
    answer,
    expiresAt: Date.now() + 60_000,
    wrongAttempts: 0,
    timeoutHandle,
  })
}

export function clearPendingRiddle(username: string): void {
  const existing = pendingRiddles.get(username)
  if (existing) clearTimeout(existing.timeoutHandle)
  pendingRiddles.delete(username)
}

export const solveRiddleCommand: BotCommand = {
  name: 'solveriddle',
  aliases: ['sr'],
  cooldownSeconds: 3,
  handler: async (channel, username, args, client) => {
    const pending = pendingRiddles.get(username)

    if (!pending) {
      client.say(channel, `@${username} — there's no riddle waiting for you. Use !explore to find one.`)
      return
    }

    if (Date.now() > pending.expiresAt) {
      clearPendingRiddle(username)
      client.say(channel, `@${username} — the riddle expired. The dungeon is not impressed.`)
      await triggerHazard(client, channel, username)
      return
    }

    if (!args.length) {
      client.say(channel, `@${username} — usage: !solveriddle [answer]`)
      return
    }

    const guess = args.join(' ').toLowerCase().trim()
    const correct = pending.answer.toLowerCase().trim()

    if (guess === correct) {
      clearPendingRiddle(username)

      const { data: char } = await supabase
        .from('characters')
        .select('xp')
        .eq('twitch_username', username)
        .single()

      if (char) {
        await supabase
          .from('characters')
          .update({ xp: char.xp + 250 })
          .eq('twitch_username', username)
      }

      client.say(channel,
        `🧩 @${username} — correct! The voice in the dark seems satisfied. +250 XP.`
      )
      return
    }

    // Wrong answer
    pending.wrongAttempts++

    if (pending.wrongAttempts >= 3) {
      clearPendingRiddle(username)
      client.say(channel,
        `🧩 @${username} — wrong again. The dungeon has heard enough.`
      )
      await triggerHazard(client, channel, username)
      return
    }

    const attemptsLeft = 3 - pending.wrongAttempts
    client.say(channel,
      `🧩 @${username} — that's not it. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
    )
  }
}