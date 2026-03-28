export interface Character {
  id: string
  twitch_username: string
  display_name: string
  class: CharacterClass
  level: number
  xp: number
  hp: number
  max_hp: number
  gold: number
  equipped_weapon: string | null
  equipped_shield: string | null
  equipped_armor: string | null
  equipped_helmet: string | null
  equipped_cloak: string | null
  equipped_neck: string | null
  equipped_eyes: string | null
  equipped_waist: string | null
  equipped_arms: string | null
  equipped_hands: string | null
  equipped_feet: string | null
  equipped_ring1: string | null
  equipped_ring2: string | null
  equipped_trinket: string | null
  created_at: string
}

export type CharacterClass =
  | 'alchemist'
  | 'artificer'
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'favored_soul'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard'
  | 'sacred_fist'
  | 'dark_apostate'
  | 'stormsinger'
  | 'blightcaster'
  | 'acolyte_of_the_skin'
  | 'dark_hunter'
  | 'dragon_lord'
  | 'wild_mage'
  | 'dragon_disciple'
  | 'arcane_trickster'

export type EquipmentSlot =
  | 'weapon'
  | 'shield'
  | 'armor'
  | 'helmet'
  | 'cloak'
  | 'neck'
  | 'eyes'
  | 'waist'
  | 'arms'
  | 'hands'
  | 'feet'
  | 'ring1'
  | 'ring2'
  | 'trinket'

export type ItemType =
  | 'weapon'
  | 'shield'
  | 'armor'
  | 'helmet'
  | 'cloak'
  | 'neck'
  | 'eyes'
  | 'waist'
  | 'arms'
  | 'hands'
  | 'feet'
  | 'ring'
  | 'trinket'
  | 'potion'
  | 'scroll'

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface Item {
  id: string
  name: string
  type: ItemType
  rarity: ItemRarity
  stat_bonus: number
  description: string
  slot?: EquipmentSlot
  is_cursed?: boolean
  curse_revealed?: boolean
}

export interface ShopItem {
  id: string
  item_name: string
  item_type: ItemType
  rarity: ItemRarity
  stat_bonus: number
  description: string
  slot: EquipmentSlot
  is_cursed: boolean
  price: number
}

export interface Monster {
  name: string
  hp: number
  attack: number
  defense: number
  xp_reward: number
  gold_reward: number
  loot_chance: number
}

export interface BotCommand {
  name: string
  aliases?: string[]
  cooldownSeconds?: number
  handler: (
    channel: string,
    username: string,
    args: string[],
    client: import('tmi.js').Client
  ) => Promise<void>
}

export interface ActiveFight {
  character_id: string
  twitch_username: string
  monster: Monster
  monster_current_hp: number
  character_current_hp: number
  last_action: number
}

export interface GraveEntry {
  id: string
  twitch_username: string
  display_name: string
  class: string
  level: number
  xp: number
  killed_by: string
  created_at: string
}