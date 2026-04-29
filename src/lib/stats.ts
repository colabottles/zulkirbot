import { supabase } from './supabase'
import { EquipmentSlot } from '../types'

export interface CharacterStats {
  attackBonus: number
  defenseBonus: number
  hpBonus: number
  damageBonus: number
}

const SLOT_COLUMNS: Record<EquipmentSlot, string> = {
  weapon: 'equipped_weapon',
  shield: 'equipped_shield',
  armor: 'equipped_armor',
  helmet: 'equipped_helmet',
  cloak: 'equipped_cloak',
  neck: 'equipped_neck',
  eyes: 'equipped_eyes',
  waist: 'equipped_waist',
  arms: 'equipped_arms',
  hands: 'equipped_hands',
  feet: 'equipped_feet',
  ring1: 'equipped_ring1',
  ring2: 'equipped_ring2',
  trinket: 'equipped_trinket',
  artifact1: 'equipped_artifact1',
  artifact2: 'equipped_artifact2',
  artifact3: 'equipped_artifact3',
  artifact4: 'equipped_artifact4',
}

const SLOT_STAT: Record<EquipmentSlot, keyof CharacterStats> = {
  weapon: 'damageBonus',
  shield: 'defenseBonus',
  armor: 'defenseBonus',
  helmet: 'defenseBonus',
  cloak: 'defenseBonus',
  neck: 'hpBonus',
  eyes: 'attackBonus',
  waist: 'hpBonus',
  arms: 'attackBonus',
  hands: 'damageBonus',
  feet: 'defenseBonus',
  ring1: 'attackBonus',
  ring2: 'damageBonus',
  trinket: 'hpBonus',
  artifact1: 'hpBonus',
  artifact2: 'hpBonus',
  artifact3: 'hpBonus',
  artifact4: 'hpBonus',
}

export async function getCharacterStats(char: any): Promise<CharacterStats> {
  const stats: CharacterStats = {
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    damageBonus: 0,
  }

  const slots = Object.keys(SLOT_COLUMNS) as EquipmentSlot[]
  const seenItemNames = new Set<string>()

  for (const slot of slots) {
    const itemId = char[SLOT_COLUMNS[slot]]
    if (!itemId) continue

    const { data: item } = await supabase
      .from('inventory')
      .select('item_name, stat_bonus, is_cursed, curse_revealed')
      .eq('id', itemId)
      .single()

    if (!item) continue

    // Skip duplicate item names — only first instance counts
    if (seenItemNames.has(item.item_name.toLowerCase())) continue
    seenItemNames.add(item.item_name.toLowerCase())

    const statKey = SLOT_STAT[slot]
    const bonus = item.is_cursed ? -Math.abs(item.stat_bonus) : item.stat_bonus
    stats[statKey] += bonus
  }

  return stats
}

export function getSlotColumn(slot: EquipmentSlot): string {
  return SLOT_COLUMNS[slot]
}

export function getSlotForItemType(itemType: string): EquipmentSlot | null {
  const map: Record<string, EquipmentSlot> = {
    weapon: 'weapon',
    shield: 'shield',
    armor: 'armor',
    helmet: 'helmet',
    cloak: 'cloak',
    neck: 'neck',
    eyes: 'eyes',
    waist: 'waist',
    arms: 'arms',
    hands: 'hands',
    feet: 'feet',
    ring: 'ring1',
    trinket: 'trinket',
    artifact: 'artifact1',
  }
  return map[itemType] ?? null
}