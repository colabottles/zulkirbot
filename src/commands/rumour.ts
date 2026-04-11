import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { hasTavernVisit } from '../lib/tavernSession'

const RUMOURS: string[] = [
  // Flavour
  `🗣️ "They say the catacombs beneath the city run deeper than any map shows..."`,
  `🗣️ "A traveller came in last night, white as a sheet. Wouldn't say what he saw in the forest."`,
  `🗣️ "Old Marta swears she saw a dragon circling the eastern peaks. I think she's had too much ale."`,
  `🗣️ "There's a merchant named Strimtom who pays good coin for cursed items. Don't ask me where he sells them."`,
  `🗣️ "The graveyard's been restless lately. Folks hear things at night they can't explain."`,
  `🗣️ "Some adventurer came through last week, said they found a room full of gold and couldn't carry it all. Haven't seen them since."`,
  `🗣️ "Word is the thieves' guild is recruiting. Quietly, of course."`,
  `🗣️ "Strange lights over the ruins again last night. Third time this week."`,
  `🗣️ "They say if you whisper Vooduspyce's name into the shrine at midnight, something answers."`,
  `🗣️ "A hooded figure's been asking about adventurers in town. Paying well for information."`,
  // Gameplay hints
  `🗣️ "Smart fighters visit the !shrine before heading into a dungeon. Just saying."`,
  `🗣️ "I heard legendary items can fetch double the price if the gods are smiling on you. Try !sell."`,
  `🗣️ "A rested warrior fights better. Don't forget to !rest after a tough battle."`,
  `🗣️ "The !shop rotates its stock every hour. Come back often — you never know what turns up."`,
  `🗣️ "Some say the best loot comes from !explore, not just fighting. Worth a look."`,
  `🗣️ "Wise adventurers keep their valuables in the !bank. You never know when death comes knocking."`,
  `🗣️ "A duel lost isn't the end. Use !rest and come back stronger."`,
  `🗣️ "Cursed items can't be sold. Find a !shrine to lift the curse first."`,
  `🗣️ "The !leaderboard shows who the true champions are. Are you on it?"`,
  `🗣️ "Don't forget to check !inventory before heading into battle. A well-equipped fighter is a live fighter."`,
]

export const rumourCommand: BotCommand = {
  name: 'rumour',
  cooldownSeconds: 30,
  handler: async (channel, username, _args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('id')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    if (!hasTavernVisit(username)) {
      client.say(channel, `@${username} — buy a drink or meal at the !tavern first. The barkeep doesn't share rumours with strangers.`)
      return
    }

    const rumour = RUMOURS[Math.floor(Math.random() * RUMOURS.length)]
    client.say(channel, `@${username} leans in and listens... ${rumour}`)
  }
}