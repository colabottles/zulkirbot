import { ItemRarity } from '../types'

export interface UpgradeCost {
  gold: number
  stones: number
  motes: number
  failChance: number
}

export const RARITY_ORDER: ItemRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
]

export const UPGRADE_COSTS: Record<string, UpgradeCost> = {
  'common->uncommon': { gold: 100, stones: 20, motes: 0, failChance: 0 },
  'uncommon->rare': { gold: 300, stones: 60, motes: 0, failChance: 0 },
  'rare->epic': { gold: 900, stones: 180, motes: 5, failChance: 10 },
  'epic->legendary': { gold: 2700, stones: 540, motes: 15, failChance: 25 },
  'legendary->mythic': { gold: 8100, stones: 1620, motes: 45, failChance: 40 },
}

export const SALVAGE_STONES: Record<ItemRarity, number> = {
  common: 10, uncommon: 25, rare: 75,
  epic: 200, legendary: 500, mythic: 1500,
}

export const SALVAGE_MOTES: Record<ItemRarity, number> = {
  common: 0, uncommon: 0, rare: 1,
  epic: 3, legendary: 8, mythic: 20,
}

export const STAT_BONUS_ON_UPGRADE: Record<string, number> = {
  'common->uncommon': 1,
  'uncommon->rare': 2,
  'rare->epic': 2,
  'epic->legendary': 3,
  'legendary->mythic': 4,
}

export function getNextRarity(current: ItemRarity): ItemRarity | null {
  const idx = RARITY_ORDER.indexOf(current)
  if (idx === -1 || idx === RARITY_ORDER.length - 1) return null
  return RARITY_ORDER[idx + 1]
}

export function getUpgradeCost(current: ItemRarity): UpgradeCost | null {
  const next = getNextRarity(current)
  if (!next) return null
  return UPGRADE_COSTS[`${current}->${next}`] ?? null
}

export function rollUpgradeFailure(failChance: number): 'success' | 'material_loss' | 'stat_damage' | 'destroyed' {
  const roll = Math.floor(Math.random() * 100) + 1
  if (roll > failChance) return 'success'

  // Failure consequence roll
  const consequenceRoll = Math.floor(Math.random() * 100) + 1
  if (consequenceRoll <= 60) return 'material_loss'
  if (consequenceRoll <= 85) return 'stat_damage'
  return 'destroyed'
}