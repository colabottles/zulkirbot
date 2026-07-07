import { CharacterClass } from '../types'

// Stronghold type by class
export type StrongholdType =
  | 'martial'
  | 'arcane'
  | 'divine'
  | 'shadow'
  | 'bardic'
  | 'artifice'

export const STRONGHOLD_TYPE_MAP: Record<string, StrongholdType> = {
  fighter: 'martial', barbarian: 'martial', paladin: 'martial',
  ranger: 'martial', monk: 'martial', sacred_fist: 'martial',
  dark_hunter: 'martial', dragon_lord: 'martial',
  wizard: 'arcane', sorcerer: 'arcane', warlock: 'arcane',
  wild_mage: 'arcane', dragon_disciple: 'arcane',
  cleric: 'divine', druid: 'divine', favored_soul: 'divine',
  dark_apostate: 'divine', blightcaster: 'divine',
  rogue: 'shadow', arcane_trickster: 'shadow',
  bard: 'bardic', stormsinger: 'bardic',
  alchemist: 'artifice', artificer: 'artifice',
}

export const STRONGHOLD_TIER_NAMES: Record<StrongholdType, string[]> = {
  martial: ['Outpost', 'Keep', 'Castle', 'Fortress', 'Citadel'],
  arcane: ['Wizard\'s Tower', 'Arcane Spire', 'Tower of Power', 'Tower of Dominion', 'Tower of Eternity'],
  divine: ['Shrine', 'Temple', 'Cathedral', 'Sanctum', 'Divine Bastion'],
  shadow: ['Hideout', 'Safehouse', 'Thieves Den', 'Shadow Guild', 'Underworld Citadel'],
  bardic: ['Waystation', 'Inn', 'Grand Hall', 'Concert Hall', 'Legendary Minstrel Hall'],
  artifice: ['Workshop', 'Laboratory', 'Grand Laboratory', 'Inventor\'s Sanctum', 'Artifice Citadel'],
}

export interface TierCost {
  gold: number
  wood: number
  stone: number
  iron: number
  bronze: number
  steel: number
}

export const TIER_COSTS: TierCost[] = [
  { gold: 500, wood: 20, stone: 10, iron: 0, bronze: 0, steel: 0 },  // Tier 1
  { gold: 2000, wood: 50, stone: 30, iron: 10, bronze: 0, steel: 0 },  // Tier 2
  { gold: 8000, wood: 100, stone: 80, iron: 40, bronze: 10, steel: 0 },  // Tier 3
  { gold: 25000, wood: 200, stone: 150, iron: 100, bronze: 30, steel: 10 }, // Tier 4
  { gold: 75000, wood: 400, stone: 300, iron: 200, bronze: 80, steel: 40 }, // Tier 5
]

export const TIER_ROOM_SLOTS = [2, 4, 6, 8, 10]

export const TIER_STATS: { hp: number; defense: number; attack: number }[] = [
  { hp: 100, defense: 5, attack: 5 },
  { hp: 250, defense: 10, attack: 10 },
  { hp: 500, defense: 20, attack: 20 },
  { hp: 1000, defense: 35, attack: 35 },
  { hp: 2000, defense: 50, attack: 50 },
]

export type Material = 'wood' | 'stone' | 'iron' | 'bronze' | 'steel' | 'mithral' | 'adamantine'

export const MATERIAL_GATHER_AMOUNTS: Record<Material, [number, number]> = {
  wood: [3, 10],
  stone: [3, 10],
  iron: [2, 8],
  bronze: [1, 6],
  steel: [1, 5],
  mithral: [1, 3],
  adamantine: [1, 2],
}

export interface RoomDefinition {
  name: string
  goldCost: number
  materials: Partial<Record<Material, number>>
  statBonus: Partial<{ hp: number; defense: number; attack: number; morale: number }>
  description: string
}

export const ROOMS: Record<string, RoomDefinition> = {
  barracks: {
    name: 'Barracks',
    goldCost: 400,
    materials: { wood: 10, stone: 5 },
    statBonus: { hp: 50 },
    description: 'Quarters for soldiers. Increases stronghold HP.',
  },
  armory: {
    name: 'Armory',
    goldCost: 500,
    materials: { wood: 5, iron: 10 },
    statBonus: { attack: 5 },
    description: 'Racks of weapons and armor. Increases stronghold ATK.',
  },
  guard_post: {
    name: 'Guard Post',
    goldCost: 300,
    materials: { wood: 5, stone: 5 },
    statBonus: { defense: 5 },
    description: 'A watchtower and guard station. Increases stronghold DEF.',
  },
  library: {
    name: 'Library',
    goldCost: 500,
    materials: { wood: 10 },
    statBonus: { morale: 5 },
    description: 'A repository of knowledge. Visitors gain +50 XP.',
  },
  smithy: {
    name: 'Smithy',
    goldCost: 500,
    materials: { stone: 5, iron: 10 },
    statBonus: { attack: 3, defense: 3 },
    description: 'A forge for weapons and armor. Boosts ATK and DEF.',
  },
  chapel: {
    name: 'Chapel',
    goldCost: 1000,
    materials: { stone: 10 },
    statBonus: { morale: 10, hp: 25 },
    description: 'A place of worship. Boosts morale and HP.',
  },
  throne_room: {
    name: 'Throne Room',
    goldCost: 2000,
    materials: { stone: 20, iron: 10 },
    statBonus: { morale: 15 },
    description: 'A seat of power. Generates passive gold income and boosts morale.',
  },
  prison_cell: {
    name: 'Prison Cell',
    goldCost: 500,
    materials: { iron: 5 },
    statBonus: { defense: 3 },
    description: 'Cells for holding captives from raids.',
  },
  magic_laboratory: {
    name: 'Magic Laboratory',
    goldCost: 500,
    materials: { wood: 10, iron: 5 },
    statBonus: { morale: 5 },
    description: 'A place for arcane research. Spell casters gain bonus spell points on visits.',
  },
  alchemical_laboratory: {
    name: 'Alchemical Laboratory',
    goldCost: 700,
    materials: { wood: 10 },
    statBonus: { morale: 5 },
    description: 'A laboratory for alchemical experiments.',
  },
  courtyard: {
    name: 'Courtyard',
    goldCost: 500,
    materials: { stone: 10 },
    statBonus: { morale: 8 },
    description: 'An open area for training and gathering. Boosts morale.',
  },
  gatehouse: {
    name: 'Gatehouse',
    goldCost: 1000,
    materials: { stone: 20, iron: 5 },
    statBonus: { defense: 8 },
    description: 'A fortified entrance. Significantly boosts DEF.',
  },
  storage: {
    name: 'Storage',
    goldCost: 250,
    materials: { wood: 10 },
    statBonus: {},
    description: 'Increases material storage capacity.',
  },
  tavern: {
    name: 'Tavern',
    goldCost: 900,
    materials: { wood: 15, stone: 5 },
    statBonus: { morale: 10 },
    description: 'A place for rest and drink. Visiting players can heal 10 HP.',
  },
}

export const GATHER_COOLDOWN_MS = 60_000
export const GATHER_MONSTER_CHANCE = 15

export const PERMADEATH_MESSAGES = [
  'While {username} fell in battle, a horde of orcs descended on their {stronghold} and burned it to the ground.',
  'With {username} slain, their {stronghold} was overrun by goblin raiders. Nothing remains.',
  'The {stronghold} of {username} stood undefended. It did not stand for long.',
  'Dark forces seized upon {username}\'s death to raze their {stronghold} to rubble.',
  'Word of {username}\'s death spread fast. Their {stronghold} was looted and destroyed before dawn.',
]