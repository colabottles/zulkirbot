import { supabase } from './supabase'
import { LOOT_TABLES } from '../game/loot'
import { ItemRarity, Item } from '../types'

const SHOP_SIZE = 10
const ALLOWED_RARITIES: ItemRarity[] = ['common', 'uncommon']

const PRICE_MAP: Record<ItemRarity, number> = {
  common: 20,
  uncommon: 60,
  rare: 0,   // not sold
  legendary: 0,   // not sold
}

export async function rotateShop(): Promise<void> {
  const eligible = LOOT_TABLES.filter(
    (i: Item) =>
      ALLOWED_RARITIES.includes(i.rarity as ItemRarity) &&
      i.type !== 'potion' &&
      !i.is_cursed
  )

  const shuffled = eligible.sort(() => Math.random() - 0.5).slice(0, SHOP_SIZE)

  await supabase.from('shop').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  for (const item of shuffled) {
    const basePrice = PRICE_MAP[item.rarity as ItemRarity]
    const price = basePrice + Math.floor(Math.random() * 10) * 5

    await supabase.from('shop').insert({
      item_name: item.name,
      item_type: item.type,
      rarity: item.rarity,
      stat_bonus: item.stat_bonus,
      description: item.description,
      is_cursed: item.is_cursed ?? false,
      price,
    })
  }

  console.log(`[Shop] Rotated at ${new Date().toISOString()}`)
}