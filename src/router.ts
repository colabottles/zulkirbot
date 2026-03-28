import tmi from 'tmi.js'
import { BotCommand } from './types'

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
    if (!message.startsWith('!')) return

    const [rawCmd, ...args] = message.trim().split(/\s+/)
    const cmdName = rawCmd.slice(1).toLowerCase()
    const username = tags.username ?? 'unknown'

    const cmd = commandMap.get(cmdName)
    if (!cmd) return

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