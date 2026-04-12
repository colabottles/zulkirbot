import { BotCommand } from '../types'
import { soCommand } from './so'
import { uptimeCommand } from './uptime'
import { joinCommand } from './join'
import { statusCommand } from './status'
import { fightCommand } from './fight'
import { attackCommand } from './attack'
import { fleeCommand } from './flee'
import { graveyardCommand } from './graveyard'
import { exploreCommand } from './explore'
import { restCommand } from './rest'
import { shrineCommand } from './shrine'
import { inventoryCommand } from './inventory'
import { potionCommand } from './potion'
import { leaderboardCommand } from './leaderboard'
import { helpCommand } from './help'
import { equipCommand } from './equip'
import { unequipCommand } from './unequip'
import { useCommand } from './use'
import { shopCommand } from './shop'
import { spawnCommand } from './spawn'
import { givegoldCommand } from './givegold'
import { killCommand } from './kill'
import { reviveCommand } from './revive'
import { dropCommand } from './drop'
import { sellCommand } from './sell'
import { duelCommand } from './duel'
import { acceptCommand } from './accept'
import { declineCommand } from './decline'
import { strikeCommand } from './strike'
import { pvpboardCommand } from './pvpboard'
import { dailyCommand } from './daily'
import { weeklyCommand } from './weekly'
import { titlesCommand } from './titles'
import { titleCommand } from './title'
import { tavernCommand } from './tavern'
import { gambleCommand } from './gamble'
import { partyCommand } from './party'
import { startGiveawayCommand } from './startgiveaway'
import { stopGiveawayCommand } from './stopgiveaway'
import { setcodeCommand } from './setcode'
import { ddoCommand } from './ddo'
import { drawCommand } from './draw'
import { bankCommand } from './bank'
import { rumourCommand } from './rumour'
import { barkeepCommand } from './barkeep'
import { drinksCommand } from './drinks'
import { mealsCommand } from './meals'
import { brawlCommand } from './brawl'

export const allCommands: BotCommand[] = [
  soCommand,
  uptimeCommand,
  joinCommand,
  statusCommand,
  fightCommand,
  attackCommand,
  fleeCommand,
  graveyardCommand,
  exploreCommand,
  restCommand,
  shrineCommand,
  inventoryCommand,
  potionCommand,
  leaderboardCommand,
  helpCommand,
  equipCommand,
  unequipCommand,
  useCommand,
  shopCommand,
  spawnCommand,
  givegoldCommand,
  killCommand,
  reviveCommand,
  dropCommand,
  sellCommand,
  duelCommand,
  acceptCommand,
  declineCommand,
  strikeCommand,
  pvpboardCommand,
  dailyCommand,
  weeklyCommand,
  titlesCommand,
  titleCommand,
  tavernCommand,
  gambleCommand,
  partyCommand,
  startGiveawayCommand,
  stopGiveawayCommand,
  setcodeCommand,
  ddoCommand,
  drawCommand,
  bankCommand,
  rumourCommand,
  barkeepCommand,
  drinksCommand,
  mealsCommand,
  brawlCommand,
]