import tmi from 'tmi.js'
import { supabase } from './lib/supabase'
import { BotCommand } from './types'
import { isGamePaused } from './lib/giveaway'
import { isManuallyPaused } from './lib/gamePause'
import { handleCampaignCommand, handleJoinCampCommand } from './commands/campaign'
import { handleNamedCampaignCommand, handleNamedJoinCamp, checkConsequences } from './commands/named_campaign'
import { handleClericCommand, isYvannisPresent } from './commands/cleric'
import { isFeebleminded, isPolymorphed, isTashaed, getTashaMessage } from './commands/new_commands'
import { handlePollVote } from './commands/poll'

const EXEMPT_COMMANDS = new Set([
  'so', 'uptime', 'help', 'status',
  'start', 'stop', 'setcode', 'ddo', 'draw',
  'pause', 'resume', 'poll'
])

const cooldowns = new Map<string, Map<string, number>>()

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

    handlePollVote(channel, tags.username ?? 'unknown', message)

    if (!message.startsWith('!')) return

    const [rawCmd, ...args] = message.trim().split(/\s+/)
    const cmdName = rawCmd.slice(1).toLowerCase()
    const username = tags.username ?? 'unknown'

    if (cmdName === 'cleric') {
      await handleClericCommand(client, supabase, channel, username, args)
      return
    }

    // Consequence check fires on every command before routing
    await checkConsequences(client, supabase, channel, username)

    // --- Campaign commands (handled outside normal command map) ---

    if (cmdName === 'campaigns') {
      await client.say(channel,
        `📜 Available campaigns: !campaign mystara (The Crystal of Rafiel — Mystara/Hollow World). ` +
        `More coming soon. Requires 1 standard campaign clear to unlock.`
      )
      return
    }

    if (cmdName === 'campaign') {
      const slug = args[0]?.toLowerCase()
      if (slug && slug !== 'solo' && slug !== 'party') {
        await handleNamedCampaignCommand(client, supabase, channel, username, slug)
      } else {
        await handleCampaignCommand(client, supabase, channel, username)
      }
      return
    }

    if (cmdName === 'joincamp') {
      const handledByNamed = await handleNamedJoinCamp(client, channel, username)
      if (!handledByNamed) {
        await handleJoinCampCommand(client, channel, username)
      }
      return
    }

    // --- Normal command routing ---

    const cmd = commandMap.get(cmdName)
    if (!cmd) return

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

    // Inside the message handler, before cmd.handler():
    if (isFeebleminded(username) || isPolymorphed(username)) return
    if (isTashaed(username)) {
      client.say(channel, getTashaMessage(username))
      return
    }

    try {
      await cmd.handler(channel, username, args, client)
    } catch (err) {
      console.error(`Error in !${cmd.name}:`, err)
      client.say(channel, `@${username} — something went wrong. ZulkirBot has failed you.`)
    }
  })
}