import tmi from 'tmi.js'
import { supabase } from './lib/supabase'
import { BotCommand } from './types'
import { isGamePaused } from './lib/giveaway'
import { isManuallyPaused } from './lib/gamePause'
import { handleCampaignCommand, handleJoinCampCommand } from './commands/campaign'
import { handleNamedCampaignCommand, handleNamedJoinCamp, checkConsequences } from './commands/named_campaign'
import { handleGreyhawkCampaignCommand, checkGreyhawkConsequences, handleGreyhawkJoinCamp } from './commands/greyhawk_campaign'
import { handleClericCommand, isYvannisPresent } from './commands/cleric'
import { isFeebleminded, isPolymorphed, isTashaed, getTashaMessage } from './commands/new_commands'
import { handlePollVote } from './commands/poll'
import { isZulkirjaxPresent, summonZulkirjax, handleZulkirjaxAttack } from './lib/zulkirjax'
import { isCampaignActive } from './lib/campaignState'

const EXEMPT_COMMANDS = new Set([
  'help', 'status', 'start', 'stop', 'setcode', 'ddo', 'draw',
  'pause', 'resume', 'poll', 'endauction'
])

const warnedUsers = new Set<string>()
const cooldowns = new Map<string, Map<string, number>>()
// 1% chance to summon Zulkirjax during regular play
let zulkirjaxSummoning = false

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

  const GREYHAWK_SLUGS = new Set([
    'village-of-hommlet',
    'temple-of-elemental-evil',
    'scourge-of-the-slave-lords',
    'against-the-giants',
    'queen-of-the-spiders',
  ])

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

    // Zulkirjax intercept — if present and player attacks, he dodges and leaves
    if (cmdName === 'attack' && isZulkirjaxPresent()) {
      await handleZulkirjaxAttack(client, channel, username)
      return
    }

    // In the summon check:
    if (!isZulkirjaxPresent() && !zulkirjaxSummoning && !isCampaignActive() && Math.random() < 0.01) {
      const { data: charCheck } = await supabase
        .from('characters')
        .select('id')
        .eq('twitch_username', username)
        .single()
      if (charCheck) {
        zulkirjaxSummoning = true
        summonZulkirjax(client, channel, username).finally(() => {
          zulkirjaxSummoning = false
        })
      }
    }

    // Consequence check fires on every command before routing
    await checkConsequences(client, supabase, channel, username)
    await checkGreyhawkConsequences(client, supabase, channel, username)

    // --- Campaign commands (handled outside normal command map) ---

    if (cmdName === 'campaigns') {
      await client.say(channel,
        `📜 Named campaigns: !campaign mystara | !campaign alqadim | !campaign spelljammer | ` +
        `!campaign planescape | !campaign ravenloft | !campaign darksun | !campaign eberron | ` +
        `!campaign dragonlance | !campaign greyhawk | !campaign forgotten-realms | ` +
        `!campaign the-lich-king-of-thay | ` +
        `Greyhawk Arc: !campaign village-of-hommlet (start here, requires 3 standard clears)`
      )
      return
    }

    if (cmdName === 'campaign') {
      const slug = args[0]?.toLowerCase()
      if (slug && GREYHAWK_SLUGS.has(slug)) {
        await handleGreyhawkCampaignCommand(client, supabase, channel, username, slug)
      } else if (slug && slug !== 'solo' && slug !== 'party') {
        await handleNamedCampaignCommand(client, supabase, channel, username, slug)
      } else {
        await handleCampaignCommand(client, supabase, channel, username)
      }
      return
    }

    if (cmdName === 'joincamp') {
      const handledByGreyhawk = await handleGreyhawkJoinCamp(client, channel, username)
      if (!handledByGreyhawk) {
        const handledByNamed = await handleNamedJoinCamp(client, channel, username)
        if (!handledByNamed) {
          await handleJoinCampCommand(client, channel, username)
        }
      }
      return
    }

    // --- Normal command routing ---
    const cmd = commandMap.get(cmdName)
    if (!cmd) {
      const SILENT_COMMANDS = new Set(['donate', 'vso', 'so', 'followage', 'uptime'])
      if (SILENT_COMMANDS.has(cmdName)) return
      const UNKNOWN_CMD_RESPONSES = [
        `@${username} — "!${cmdName}"? Bold strategy, Cotton. The dungeon remains unimpressed. Let’s see if it pays off for them.`,
        `@${username} — the ancient Netherese scrolls contain no record of "!${cmdName}". Your character weeps softly.`,
        `@${username} — a ${username}-shaped hole has appeared in the wall where that command should have been.`,
        `@${username} — "!${cmdName}" has been added to the list of things that don't work. Right next to your last battle plan.`,
        `@${username} — the tavern goes quiet. Someone coughs. "!${cmdName}" echoes into the void and dies there.`,
        `@${username} — ZulkirBot has consulted the oracle. The oracle says no. The oracle is laughing.`,
        `@${username} — "!${cmdName}"? Your character looks confused. The monster looks confused. Everyone is confused.`,
        `@${username} — that command doesn't exist. Much like your character's survival instincts.`,
        `@${username} — the dungeon master looked up "!${cmdName}" in the rulebook. It's not there. Neither is your dignity.`,
        `@${username} — a goblin nearby heard "!${cmdName}" and felt secondhand embarrassment for you.`,
        `@${username} — "!${cmdName}" has been filed under "things that sound confident but aren't." Right next to your last !fight attempt.`,
        `@${username} — error 404: command not found. Much like your character's common sense.`,
        `@${username} — the bard in the corner is already writing a ballad about "!${cmdName}". It's a tragedy.`,
        `@${username} — "!${cmdName}"? The skeleton you just failed to kill is shaking its head. Skeletons don't have heads. It found one just for this.`,
        `@${username} — ZulkirBot has no record of "!${cmdName}". ZulkirBot does have a record of every time you've died though. It's a long record.`,
        `@${username} — "!${cmdName}" is not a command. A group of drunk pixies exclaim, "Booooo! Boo that adventurer! Booooo!`,
        `@${username} — the dungeon walls absorbed "!${cmdName}" and gave nothing back. Like a certain adventurer we know.`,
        `@${username} — a passing kobold overheard "!${cmdName}" and accelerated his pace noticeably.`,
        `@${username} — "!${cmdName}" activated nothing. Much like your equipped gear, statistically speaking.`,
        `@${username} — the command "!${cmdName}" does not exist. Your character does, unfortunately for the monsters. And for you.`,
        `@${username} — somewhere in the Nine Hells, a devil is updating the ledger. "!${cmdName}" goes under 'unforced errors.'`,
        `@${username} — "!${cmdName}"? The hireling you can't afford gave you a look. Even they knew better.`,
        `@${username} — ZulkirBot searched high and low for "!${cmdName}". It found your graveyard entry instead. Again.`,
        `@${username} — that's not a command. That's a cry for help. Try !help and watch those traps!`,
        `@${username} — "!${cmdName}" has been rejected by the dungeon, the tavern, and three different gods. Try !help instead.`,
        `@${username} — What you've just said is one of the most insanely idiotic things I have ever heard. At no point in your rambling, incoherent chanting were you even close to anything that could be considered a rational thought. Everyone in this dungeon is now dumber for having listened to it.`,
        `@${username} — the echo of "!${cmdName}" bounced around the dungeon and came back as a whisper: "."`,
        `@${username} — You are in a glass case of emotion right now, ${username}. Try to contain yourself. And maybe try a real command while you're at it.`,
        `@${username} — Well you can't expect to wield supreme executive power
       just 'cause some watery tart threw a sword or a command in chat at you!`,
        `@${username} — "!${cmdName}"?! I don't want to talk to you no more, you empty headed animal
       food trough whopper!  I fart in your general direction!  You mother
       was a hamster and your father smelt of elderberries.`,
      ]
      const msg = UNKNOWN_CMD_RESPONSES[Math.floor(Math.random() * UNKNOWN_CMD_RESPONSES.length)]
      client.say(channel, msg)
      return
    }

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
        return
      }
      userCooldowns.set(username, now)
    }

    // After the feeblemind/polymorph check, before cmd.handler()
    const CHAR_EXEMPT = new Set([
      'join', 'help', 'graveyard', 'leaderboard', 'whois',
      'campaigns', 'status', 'shop', 'listings', 'xptable',
      'pause', 'resume', 'kill', 'revive', 'poll', 'setcode',
      'startgiveaway', 'stopgiveaway', 'ddo', 'draw', 'addentry',
      'lag', 'hairdye'
    ])

    if (!CHAR_EXEMPT.has(cmd.name)) {
      const { data: charCheck } = await supabase
        .from('characters')
        .select('id')
        .eq('twitch_username', username)
        .single()

      if (!charCheck) return // silent fail — no character
    }

    // Inside the message handler, before cmd.handler():
    if (isFeebleminded(username) || isPolymorphed(username)) return
    if (isTashaed(username)) {
      client.say(channel, getTashaMessage(username))
      return
    }

    // First command mute warning
    if (!warnedUsers.has(username)) {
      warnedUsers.add(username)
      client.say(channel,
        `⚠️ HEADS UP @${username} — Twitch will temporarily mute you if you send too many commands too fast. Pace yourself! This is called the Ysukai Directive. ⚠️`
      )
    }

    try {
      await cmd.handler(channel, username, args, client)
    } catch (err) {
      console.error(`Error in !${cmd.name}:`, err)
      client.say(channel, `@${username} — something went wrong. ZulkirBot has failed you.`)
    }
  })
}