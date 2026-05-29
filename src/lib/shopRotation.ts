import { supabase } from './supabase'
import { LOOT_TABLES } from '../game/loot'
import { ItemRarity, Item } from '../types'

const SHOP_SIZE = 10
const ALLOWED_RARITIES: ItemRarity[] = ['common', 'uncommon']
const PRICE_MAP: Record<ItemRarity, number> = {
  common: 20,
  uncommon: 60,
  rare: 0,
  epic: 0,
  legendary: 0,
  mythic: 0,
}

let nextRotationAt: number | null = null
let alertTimeout: ReturnType<typeof setTimeout> | null = null
let shopClient: import('tmi.js').Client | null = null
let shopChannel: string | null = null

export function setShopClient(client: import('tmi.js').Client, channel: string): void {
  shopClient = client
  shopChannel = channel
}

export function getNextRotationAt(): number | null {
  return nextRotationAt
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

  // Track next rotation and schedule 3-minute warning
  nextRotationAt = Date.now() + 60 * 60 * 1000

  if (alertTimeout) clearTimeout(alertTimeout)
  alertTimeout = setTimeout(() => {
    if (shopClient && shopChannel) {
      shopClient.say(shopChannel, `🛒 The shop refreshes in 3 minutes! Browse with !shop before the stock changes.`)
    }
  }, 57 * 60 * 1000)

  console.log(`[Shop] Rotated at ${new Date().toISOString()}`)
}