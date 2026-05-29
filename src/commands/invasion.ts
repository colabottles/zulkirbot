import { BotCommand } from '../types'
import {
  startInvasion,
  joinInvasion,
  attackInvasionBoss,
  cancelInvasion,
  invasionStatus,
  activeInvasion,
} from '../game/invasion'

// ── !invasion [boss] / !invasion cancel / !invasion status ──
// Broadcaster only for start/cancel; anyone for status

export const invasionCommand: BotCommand = {
  name: 'invasion',
  aliases: ['iv', 'raid'],
  cooldownSeconds: 0,
  handler: async (channel, username, args, client) => {
    const isBroadcaster =
      username.toLowerCase() === channel.replace('#', '').toLowerCase()

    const sub = args[0]?.toLowerCase()

    if (sub === 'cancel') {
      if (!isBroadcaster) {
        client.say(channel, `@${username} — only the broadcaster can cancel an invasion.`)
        return
      }
      cancelInvasion(channel, client)
      return
    }

    if (sub === 'status' || sub === 'info') {
      invasionStatus(channel, client)
      return
    }

    // !invasion [bossId] — broadcaster only
    if (!isBroadcaster) {
      client.say(channel, `@${username} — only the broadcaster can start an invasion.`)
      return
    }

    if (!sub) {
      client.say(channel, `Usage: !invasion [boss_id] | !invasion status | !invasion cancel`)
      return
    }

    await startInvasion(channel, sub, client)
  },
}

// ── !joinevent ───────────────────────────────────────────────
// Dual-purpose: join during join window, attack during fight phase

export const joinEventCommand: BotCommand = {
  name: 'joinevent',
  aliases: [],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    if (!activeInvasion) {
      client.say(channel, `@${username} — there's no invasion active right now.`)
      return
    }

    if (activeInvasion.phase === 'joining') {
      await joinInvasion(channel, username, client)
      return
    }

    if (activeInvasion.phase === 'fighting') {
      await attackInvasionBoss(channel, username, client)
      return
    }
  },
}