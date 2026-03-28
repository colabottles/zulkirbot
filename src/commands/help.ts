import { BotCommand } from '../types'

export const helpCommand: BotCommand = {
  name: 'help',
  aliases: ['commands', 'h'],
  cooldownSeconds: 10,
  handler: async (channel, username, _args, client) => {
    client.say(
      channel,
      `⚔️ ZulkirBot commands — ` +
      `!join [class] — create a character | ` +
      `!status — view your stats | ` +
      `!fight — start a battle | ` +
      `!attack — attack in battle | ` +
      `!flee — run away 🐔 | ` +
      `!rest — recover HP | ` +
      `!shrine — pray to remove a curse | ` +
      `!explore — search for loot & traps | ` +
      `!inventory — view your items | ` +
      `!equip [item] — equip an item | ` +
      `!unequip [slot] — unequip a slot | ` +
      `!use [item] — use a scroll or potion | ` +
      `!potion — use a potion | ` +
      `!shop — browse & buy items | ` +
      `!leaderboard — top adventurers | ` +
      `!graveyard — fallen heroes` +
      `!drop [item] — drop an item | ` +
      `!sell [item] — sell an item for gold | ` +
      `!duel @user — challenge someone to a duel | ` +
      `!accept — accept a duel challenge | ` +
      `!decline — decline a duel challenge | ` +
      `!strike — attack in a duel | ` +
      `!pvpboard — duel leaderboard | ` +
      `!daily — claim your daily gold reward | ` +
      `!weekly — claim your weekly XP reward | `
    )
  }
}