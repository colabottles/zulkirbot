import tmi from 'tmi.js'
import { supabase } from './lib/supabase'
import { BotCommand } from './types'
import { isGamePaused } from './lib/giveaway'
import { isManuallyPaused } from './lib/gamePause'
import { handleCampaignCommand, handleJoinCampCommand } from './commands/campaign'

const EXEMPT_COMMANDS = new Set([
  'so', 'uptime', 'help', 'status',
  'start', 'stop', 'setcode', 'ddo', 'draw',
  'pause', 'resume'
])

const cooldowns = new Map<string, Map<string, number>>()

const GIVEAWAY_COMMANDS = new Set([
  'start', 'stop', 'setcode', 'ddo', 'draw'
])

export function registerCommands(
  client: tmi.Client,
  commands: BotCommand[]
) {
  const commandMap = new Map<string, BotCommand>()
  for (const cmd of commands) {
    commandMap.set(cmd.name, cmd)
    for (const alias of cmd.aliases ?? []) {
      commandMap.set(alias, cmd)
    }
  }

  client.on('message', async (channel, tags, message, self) => {
    if (self) return
    if (!message.startsWith('!')) return

    const [rawCmd, ...args] = message.trim().split(/\s+/)
    const cmdName = rawCmd.slice(1).toLowerCase()
    const username = tags.username ?? 'unknown'

    // --- Campaign commands (handled outside normal command map) ---
    if (cmdName === 'campaign') {
      await handleCampaignCommand(client, supabase, channel, username)
      return
    }
    if (cmdName === 'joincamp') {
      await handleJoinCampCommand(client, channel, username)
      return
    }
    // --- End campaign commands ---

    const cmd = commandMap.get(cmdName)
    if (!cmd) return

    // Block game commands during a giveaway
    // Block game commands during a giveaway or manual pause
    if ((isGamePaused() || isManuallyPaused()) && !EXEMPT_COMMANDS.has(cmd.name)) {
      if (isManuallyPaused()) {
        client.say(channel, `@${username} — the game is paused right now for this stream.`)
      } else {
        client.say(channel, `@${username} — the game is paused while a giveaway is in progress! 🎉`)
      }
      return
    }

    if (cmd.cooldownSeconds) {
      const now = Date.now()
      if (!cooldowns.has(cmd.name)) cooldowns.set(cmd.name, new Map())
      const userCooldowns = cooldowns.get(cmd.name)!
      const lastUsed = userCooldowns.get(username) ?? 0
      if (now - lastUsed < cmd.cooldownSeconds * 1000) {
        const remaining = Math.ceil(
          (cmd.cooldownSeconds * 1000 - (now - lastUsed)) / 1000
        )
        client.say(channel, `@${username} — wait ${remaining}s before using !${cmd.name} again.`)
        return
      }
      userCooldowns.set(username, now)
    }

    try {
      await cmd.handler(channel, username, args, client)
    } catch (err) {
      console.error(`Error in !${cmd.name}:`, err)
      client.say(channel, `@${username} — something went wrong. ZulkirBot has failed you.`)
    }
  })
}