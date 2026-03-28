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
]