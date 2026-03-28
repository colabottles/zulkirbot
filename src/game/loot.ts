import { Item } from '../types'
import { d100 } from './dice'

export const LOOT_TABLES: Item[] = [
  // Helmets
  { id: '53', name: 'Leather Cap', type: 'helmet', rarity: 'common', stat_bonus: 1, description: 'Keeps your head mostly intact.' },
  { id: '54', name: 'Iron Helm', type: 'helmet', rarity: 'uncommon', stat_bonus: 2, description: 'Heavy but protective.' },
  { id: '55', name: 'Helm of Brilliance', type: 'helmet', rarity: 'rare', stat_bonus: 4, description: 'Glitters with inner light.' },
  // Cloaks
  { id: '56', name: 'Tattered Cloak', type: 'cloak', rarity: 'common', stat_bonus: 1, description: 'Barely holds together.' },
  { id: '57', name: 'Cloak of Elvenkind', type: 'cloak', rarity: 'uncommon', stat_bonus: 2, description: 'Hard to spot in the shadows.' },
  { id: '58', name: 'Cloak of the Bat', type: 'cloak', rarity: 'rare', stat_bonus: 4, description: 'Smells faintly of caves.' },
  // Neck
  { id: '59', name: 'Copper Pendant', type: 'neck', rarity: 'common', stat_bonus: 1, description: 'A simple charm.' },
  { id: '60', name: 'Necklace of Fireballs', type: 'neck', rarity: 'uncommon', stat_bonus: 3, description: 'Handle with care.' },
  { id: '61', name: 'Periapt of Wound Closure', type: 'neck', rarity: 'rare', stat_bonus: 5, description: 'Wounds close faster.' },
  // Eyes
  { id: '62', name: 'Smoked Goggles', type: 'eyes', rarity: 'common', stat_bonus: 1, description: 'Protects against bright light.' },
  { id: '63', name: 'Goggles of Night', type: 'eyes', rarity: 'uncommon', stat_bonus: 2, description: 'See in the dark.' },
  { id: '64', name: 'Eyes of the Eagle', type: 'eyes', rarity: 'rare', stat_bonus: 4, description: 'Spot a coin at 100 yards.' },
  // Waist
  { id: '65', name: 'Leather Belt', type: 'waist', rarity: 'common', stat_bonus: 1, description: 'Holds your pants up.' },
  { id: '66', name: 'Belt of Giant Strength', type: 'waist', rarity: 'rare', stat_bonus: 5, description: 'You feel impossibly strong.' },
  { id: '67', name: 'Cord of Direction', type: 'waist', rarity: 'uncommon', stat_bonus: 2, description: 'Always points the way.' },
  // Arms
  { id: '68', name: 'Leather Bracers', type: 'arms', rarity: 'common', stat_bonus: 1, description: 'Basic wrist protection.' },
  { id: '69', name: 'Bracers of Archery', type: 'arms', rarity: 'uncommon', stat_bonus: 3, description: 'Your aim improves.' },
  { id: '70', name: 'Bracers of Defense', type: 'arms', rarity: 'rare', stat_bonus: 5, description: 'Hard as adamantine.' },
  // Hands
  { id: '71', name: 'Worn Gloves', type: 'hands', rarity: 'common', stat_bonus: 1, description: 'Better than bare hands.' },
  { id: '72', name: 'Gloves of Thievery', type: 'hands', rarity: 'uncommon', stat_bonus: 2, description: 'Nimble fingers.' },
  { id: '73', name: 'Gauntlets of Ogre Power', type: 'hands', rarity: 'rare', stat_bonus: 4, description: 'Crush anything.' },
  // Feet
  { id: '74', name: 'Worn Boots', type: 'feet', rarity: 'common', stat_bonus: 1, description: 'Keep your feet dry. Mostly.' },
  { id: '75', name: 'Boots of Elvenkind', type: 'feet', rarity: 'uncommon', stat_bonus: 2, description: 'Silent as a whisper.' },
  { id: '76', name: 'Boots of Speed', type: 'feet', rarity: 'rare', stat_bonus: 4, description: 'Strike first, strike fast.' },
  // Rings
  { id: '77', name: 'Copper Ring', type: 'ring', rarity: 'common', stat_bonus: 1, description: 'A plain copper band.' },
  { id: '78', name: 'Ring of Feather Falling', type: 'ring', rarity: 'uncommon', stat_bonus: 2, description: 'Slow as a feather.' },
  { id: '79', name: 'Ring of Spell Storing', type: 'ring', rarity: 'rare', stat_bonus: 4, description: 'Holds a spell in reserve.' },
  // Shields
  { id: '80', name: 'Wooden Shield', type: 'shield', rarity: 'common', stat_bonus: 1, description: 'Better than nothing.' },
  { id: '81', name: 'Steel Shield', type: 'shield', rarity: 'uncommon', stat_bonus: 3, description: 'Solid protection.' },
  { id: '82', name: 'Shield of Missile Attraction', type: 'shield', rarity: 'rare', stat_bonus: 4, description: 'Draws fire away from allies.' },
  // Offensive scrolls
  { id: '83', name: 'Scroll of Magic Missile', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Three darts of magical force.' },
  { id: '84', name: 'Scroll of Acid Arrow', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'A green bolt of acid.' },
  { id: '85', name: 'Scroll of Fireball', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'A roiling ball of fire.' },
  { id: '86', name: 'Scroll of Lightning Bolt', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'A stroke of lightning.' },
  { id: '87', name: 'Scroll of Ice Storm', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Pelts foes with ice.' },
  { id: '88', name: 'Scroll of Chain Lightning', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Leaps between enemies.' },
  { id: '89', name: 'Scroll of Cone of Cold', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'A blast of freezing air.' },
  { id: '90', name: 'Scroll of Flame Strike', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Divine fire from above.' },
  { id: '91', name: 'Scroll of Disintegrate', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Reduces a target to dust.' },
  { id: '92', name: 'Scroll of Finger of Death', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'A dark ray of necrotic energy.' },
  // Healing scrolls
  { id: '93', name: 'Scroll of Cure Light Wounds', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Heals minor wounds.' },
  { id: '94', name: 'Scroll of Cure Minor Wounds', type: 'scroll', rarity: 'common', stat_bonus: 0, description: 'Closes small cuts.' },
  { id: '95', name: 'Scroll of Cure Moderate Wounds', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Heals moderate injuries.' },
  { id: '96', name: 'Scroll of Cure Serious Wounds', type: 'scroll', rarity: 'uncommon', stat_bonus: 0, description: 'Heals serious injuries.' },
  { id: '97', name: 'Scroll of Cure Critical Wounds', type: 'scroll', rarity: 'rare', stat_bonus: 0, description: 'Heals critical injuries.' },
  // Cursed items
  { id: '98', name: 'Sword of Berserking', type: 'weapon', rarity: 'uncommon', stat_bonus: 3, description: 'Rage fills your mind.', is_cursed: true },
  { id: '99', name: 'Armor of Arrow Attraction', type: 'armor', rarity: 'uncommon', stat_bonus: 2, description: 'Something feels wrong.', is_cursed: true },
  { id: '100', name: 'Ring of Clumsiness', type: 'ring', rarity: 'common', stat_bonus: 2, description: 'Feels oddly heavy.', is_cursed: true },
  { id: '101', name: 'Helm of Opposite Alignment', type: 'helmet', rarity: 'uncommon', stat_bonus: 2, description: 'Your thoughts feel strange.', is_cursed: true },
  { id: '102', name: 'Cloak of Poison', type: 'cloak', rarity: 'uncommon', stat_bonus: 2, description: 'Smells faintly of nightshade.', is_cursed: true },
]

export function rollRarity(): string {
  const roll = d100()
  if (roll <= 3) return 'legendary'
  if (roll <= 15) return 'rare'
  if (roll <= 40) return 'uncommon'
  return 'common'
}

export function rollLoot(): Item {
  const rarity = rollRarity()
  const pool = LOOT_TABLES.filter(i => i.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function rollLootByRarity(rarity: string): Item {
  const pool = LOOT_TABLES.filter(i => i.rarity === rarity && i.type !== 'potion' && i.type !== 'scroll')
  return pool[Math.floor(Math.random() * pool.length)]
}

export function shouldDropLoot(lootChance: number): boolean {
  return d100() <= lootChance
}