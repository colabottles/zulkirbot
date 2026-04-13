import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { hasTavernVisit } from '../lib/tavernSession'

const BARKEEP_NAMES = [
  'DilemmaEnder',
  'Tavern Tails',
  'JackDrag0n',
  'Ysukai',
  'NeutralAgent',
  'Brakkart',
  'Tuf_RPG',
  'codiene42',
  'guppyczar',
  'Noobahlolic',
  'Nachowench',
  'Bobhorn Leghorn',
  'NomadDog',
  'ARTofPAW',
  'UngermaxTV',
  'KingKozma',
]

const BARKEEP_LINES: string[] = [
  // Flavour
  `"Another round? You look like you've seen better days, friend."`,
  `"I've seen a hundred adventurers walk through that door. Half of them walked back out."`,
  `"Keep your voice down. The walls have ears in this town."`,
  `"Pay your tab before you head out. I'm not running a charity."`,
  `"You want trouble? Go find it somewhere else. This is a respectable establishment."`,
  `"Sit down, rest your bones. The dungeon will still be there tomorrow."`,
  `"I don't ask where the gold comes from. Neither should you."`,
  `"First drink's almost the cheapest. Almost."`,
  `"Had a bard in here last week. Lovely voice. Terrible tipper."`,
  `"You remind me of someone who used to come in here. They're in the graveyard now. Good luck."`,
  `"Dragon_Lore may change his name again to something else. Be mindful."`,
  // Tips
  `"Word of advice — check the !shop every hour. Stock changes and the good stuff goes fast."`,
  `"The !shrine's kept more than one poor soul from permadeath. Don't skip it."`,
  `"!rest up between fights. A tired fighter is a dead fighter."`,
  `"You can store up to 50 items in the !bank. Don't lose your best gear to permadeath."`,
  `"!explore when you're not fighting. You'd be surprised what turns up."`,
  `"Selling rare or legendary gear? Roll the dice — you might get double with !sell."`,
  `"The !leaderboard doesn't lie. Might be time to step your game up."`,
  `"!duel someone close to your level. Big level gaps aren't allowed for a reason."`,
  `"Stock up on potions before a big fight. !shop should have some."`,
  `"Cursed gear will get you killed. Visit the !shrine before it's too late."`,
]

export const barkeepCommand: BotCommand = {
  name: 'barkeep',
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
      client.say(channel, `@${username} — order something first. The barkeep's too busy for idle chatter.`)
      return
    }

    const name = BARKEEP_NAMES[Math.floor(Math.random() * BARKEEP_NAMES.length)]
    const line = BARKEEP_LINES[Math.floor(Math.random() * BARKEEP_LINES.length)]

    client.say(channel, `🍺 ${name} says: ${line}`)
  }
}