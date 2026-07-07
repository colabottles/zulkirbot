import { BotCommand } from '../types'

// ── Core ─────────────────────────────────────────────────────
import { joinCommand } from './join'
import { statusCommand } from './status'
import { helpCommand } from './help'
import { pauseCommand } from './pause'
import { resumeCommand } from './resume'

// ── Combat ───────────────────────────────────────────────────
import { fightCommand } from './fight'
import { attackCommand } from './attack'
import { fleeCommand } from './flee'
import { spawnCommand } from './spawn'
import { rageCommand } from './rage'
import { turnundeadCommand } from './turnundead'
import { hirelingCommand } from './hireling'

// ── Exploration ──────────────────────────────────────────────
import { exploreCommand } from './explore'
import { restCommand } from './rest'
import { shrineCommand } from './shrine'
import { graveyardCommand } from './graveyard'
import { picklockCommand, disabletrapCommand, findtrapsCommand, searchdoorCommand, opendoorCommand } from './rogue_commands'
import { solveRiddleCommand } from './solveriddle'

// ── Items & Economy ──────────────────────────────────────────
import { inventoryCommand } from './inventory'
import { equipCommand } from './equip'
import { unequipCommand } from './unequip'
import { useCommand } from './use'
import { potionCommand } from './potion'
import { dropCommand } from './drop'
import { sellCommand } from './sell'
import { shopCommand } from './shop'
import { bankCommand } from './bank'
import { givegoldCommand } from './givegold'
import { listsaleitemCommand } from './listsaleitem'
import { pbuyCommand } from './pbuy'
import { removelistingCommand } from './removelisting'
import { listingsCommand } from './listings'
import { listauctionCommand } from './listauction'
import { bidCommand } from './bid'
import { endauctionCommand } from './endauction'
import { auctionsCommand } from './auctions'

// ── Tavern ───────────────────────────────────────────────────
import { tavernCommand } from './tavern'
import { gambleCommand } from './gamble'
import { rumourCommand } from './rumour'
import { barkeepCommand } from './barkeep'
import { drinksCommand } from './drinks'
import { mealsCommand } from './meals'
import { brawlCommand } from './brawl'

// ── Spells ─────────────────────────────────────────────
import { spellsCommand, castCommand, learnspellCommand, prayforspellsCommand, scribescrollCommand } from './spells'

// ── Social & PvP ─────────────────────────────────────────────
import { duelCommand } from './duel'
import { acceptCommand } from './accept'
import { declineCommand } from './decline'
import { pvpboardCommand } from './pvpboard'
import { partyCommand } from './party'
import { leaderboardCommand } from './leaderboard'
import { whoisCommand } from './whois'

// ── Progression ──────────────────────────────────────────────
import { dailyCommand } from './daily'
import { weeklyCommand } from './weekly'
import { prestigeCommand } from './prestige'
import { titlesCommand } from './titles'
import { titleCommand } from './title'
import { xptableCommand } from './xptable'
import { killcountCommand } from './killcount'

// ── Giveaway ─────────────────────────────────────────────────
import { startGiveawayCommand } from './startgiveaway'
import { stopGiveawayCommand } from './stopgiveaway'
import { setcodeCommand } from './setcode'
import { ddoCommand } from './ddo'
import { drawCommand } from './draw'
import { addentryCommand } from './addentry'
import { linkDdoCommand } from './linkddo'

// ── Broadcaster / Special ────────────────────────────────────
import { killCommand } from './kill'
import { reviveCommand } from './revive'
import { lagCommand } from './lag'
import { hairdyeCommand } from './hairdye'
import { pollCommand } from './poll'
import { handlePollVote } from './poll'
import { stevefrenchCommand } from './stevefrench'
import { burgerCommand } from './burger'
import {
  layonhandsCommand, inspirationCommand, feeblemindCommand, polymorphCommand,
  tashaCommand, scryCommand, deathwardCommand, heroesfeastCommand, criticalCommand,
  fumbleCommand, advantageCommand, disadvantageCommand, identifyCommand,
  beholderCommand, deckofmanyCommand, tarokkaCommand,
} from './new_commands'

export const allCommands: BotCommand[] = [
  // Core
  joinCommand,
  statusCommand,
  helpCommand,
  pauseCommand,
  resumeCommand,

  // Combat
  fightCommand,
  attackCommand,
  fleeCommand,
  spawnCommand,
  rageCommand,
  turnundeadCommand,
  hirelingCommand,

  // Exploration
  exploreCommand,
  restCommand,
  shrineCommand,
  graveyardCommand,
  picklockCommand,
  disabletrapCommand,
  findtrapsCommand,
  searchdoorCommand,
  opendoorCommand,
  solveRiddleCommand,

  // Items & Economy
  inventoryCommand,
  equipCommand,
  unequipCommand,
  useCommand,
  potionCommand,
  dropCommand,
  sellCommand,
  shopCommand,
  bankCommand,
  givegoldCommand,
  listsaleitemCommand,
  pbuyCommand,
  removelistingCommand,
  listingsCommand,
  listauctionCommand,
  bidCommand,
  endauctionCommand,
  auctionsCommand,

  // Tavern
  tavernCommand,
  gambleCommand,
  rumourCommand,
  barkeepCommand,
  drinksCommand,
  mealsCommand,
  brawlCommand,

  // Spells
  spellsCommand,
  castCommand,
  learnspellCommand,
  prayforspellsCommand,
  scribescrollCommand,

  // Social & PvP
  duelCommand,
  acceptCommand,
  declineCommand,
  pvpboardCommand,
  partyCommand,
  leaderboardCommand,
  whoisCommand,

  // Progression
  dailyCommand,
  weeklyCommand,
  prestigeCommand,
  titlesCommand,
  titleCommand,
  xptableCommand,
  killcountCommand,

  // Giveaway
  startGiveawayCommand,
  stopGiveawayCommand,
  setcodeCommand,
  ddoCommand,
  drawCommand,
  addentryCommand,
  linkDdoCommand,

  // Broadcaster / Special
  killCommand,
  reviveCommand,
  lagCommand,
  hairdyeCommand,
  layonhandsCommand,
  inspirationCommand,
  feeblemindCommand,
  polymorphCommand,
  tashaCommand,
  scryCommand,
  deathwardCommand,
  heroesfeastCommand,
  criticalCommand,
  fumbleCommand,
  advantageCommand,
  disadvantageCommand,
  identifyCommand,
  beholderCommand,
  deckofmanyCommand,
  tarokkaCommand,
  pollCommand,
  stevefrenchCommand,
  burgerCommand,
]