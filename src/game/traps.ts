export interface Trap {
  name: string
  type: 'physical' | 'magic' | 'instant_kill'
  damageMin: number
  damageMax: number
  description: string
  deathMessage?: string
}

export const TRAPS: Record<number, Trap[]> = {
  // Levels 1-5: Easy
  1: [
    { name: 'Poison Dart', type: 'physical', damageMin: 1, damageMax: 3, description: 'A hidden dart laced with weak poison grazes you' },
    { name: 'Spike Pit', type: 'physical', damageMin: 2, damageMax: 4, description: 'You stumble into a shallow pit of rusty spikes' },
    { name: 'Bear Trap', type: 'physical', damageMin: 1, damageMax: 3, description: 'A crude bear trap snaps shut on your ankle' },
    { name: 'Fire Rune', type: 'magic', damageMin: 2, damageMax: 4, description: 'A poorly drawn fire rune scorches you' },
    { name: 'Frost Sigil', type: 'magic', damageMin: 1, damageMax: 3, description: 'A frost sigil chills you to the bone' },
  ],
  // Levels 6-10: Medium
  2: [
    { name: 'Arrow Volley', type: 'physical', damageMin: 3, damageMax: 6, description: 'A volley of arrows fires from the walls' },
    { name: 'Swinging Blade', type: 'physical', damageMin: 4, damageMax: 7, description: 'A massive pendulum blade swings from the ceiling' },
    { name: 'Spike Pit', type: 'physical', damageMin: 3, damageMax: 6, description: 'You fall into a deep pit lined with iron spikes' },
    { name: 'Lightning Glyph', type: 'magic', damageMin: 4, damageMax: 7, description: 'A lightning glyph arcs electricity through you' },
    { name: 'Arcane Burst', type: 'magic', damageMin: 3, damageMax: 6, description: 'An arcane burst erupts from a hidden sigil' },
    { name: 'Shadow Snare', type: 'magic', damageMin: 3, damageMax: 5, description: 'Shadow tendrils erupt from the floor and tear at you' },
  ],
  // Levels 11-20: Hard
  3: [
    { name: 'Crushing Wall', type: 'physical', damageMin: 6, damageMax: 10, description: 'Two stone walls slam together, crushing you between them' },
    { name: 'Poison Gas Vent', type: 'physical', damageMin: 5, damageMax: 9, description: 'Toxic gas floods the corridor from hidden vents' },
    { name: 'Blade Gauntlet', type: 'physical', damageMin: 6, damageMax: 10, description: 'A corridor of spinning blades catches you off guard' },
    { name: 'Necrotic Ward', type: 'magic', damageMin: 6, damageMax: 10, description: 'A necrotic ward drains the life from your body' },
    { name: 'Fire Rune', type: 'magic', damageMin: 5, damageMax: 9, description: 'A powerful fire rune engulfs you in flames' },
    { name: 'Frost Sigil', type: 'magic', damageMin: 5, damageMax: 8, description: 'A glacial sigil encases your limbs in ice' },
  ],
  // Levels 21-30: Difficult
  4: [
    { name: 'Collapsing Floor', type: 'physical', damageMin: 10, damageMax: 16, description: 'The floor gives way and you plummet into darkness' },
    { name: 'Poison Dart Volley', type: 'physical', damageMin: 8, damageMax: 14, description: 'Dozens of poisoned darts riddle you from all directions' },
    { name: 'Arcane Burst', type: 'magic', damageMin: 10, damageMax: 16, description: 'A devastating arcane burst tears through your defenses' },
    { name: 'Necrotic Ward', type: 'magic', damageMin: 9, damageMax: 15, description: 'A powerful necrotic ward rots your flesh' },
    { name: 'Shadow Snare', type: 'magic', damageMin: 8, damageMax: 14, description: 'Shadow tendrils drag you through a pocket of darkness' },
    {
      name: 'Disintegration Rune', type: 'instant_kill', damageMin: 999, damageMax: 999,
      description: 'A disintegration rune flares to life beneath your feet',
      deathMessage: 'was reduced to a pile of ash by a Disintegration Rune'
    },
  ],
  // Levels 31-40: Highly Difficult
  5: [
    { name: 'Crushing Wall', type: 'physical', damageMin: 15, damageMax: 25, description: 'Ancient stone walls slam shut with devastating force' },
    { name: 'Blade Gauntlet', type: 'physical', damageMin: 14, damageMax: 22, description: 'An enchanted blade gauntlet shreds through your armor' },
    { name: 'Lightning Glyph', type: 'magic', damageMin: 15, damageMax: 24, description: 'A master-level lightning glyph fries you where you stand' },
    { name: 'Necrotic Ward', type: 'magic', damageMin: 14, damageMax: 22, description: 'An ancient necrotic ward strips the soul from your body' },
    {
      name: 'Disintegration Rune', type: 'instant_kill', damageMin: 999, damageMax: 999,
      description: 'A master disintegration rune flares beneath your feet',
      deathMessage: 'was vaporized by a master Disintegration Rune'
    },
    {
      name: 'Sphere of Annihilation', type: 'instant_kill', damageMin: 999, damageMax: 999,
      description: 'A Sphere of Annihilation rolls silently from the shadows',
      deathMessage: 'was erased from existence by a Sphere of Annihilation'
    },
    {
      name: 'Death Ward', type: 'instant_kill', damageMin: 999, damageMax: 999,
      description: 'A Death Ward triggers, stopping your heart instantly',
      deathMessage: 'was slain instantly by a Death Ward'
    },
  ],
}

export const DISARM_CLASSES = ['rogue', 'artificer', 'arcane_trickster']
export const DISARM_CHANCE = 60

export function getTrapForLevel(level: number): Trap {
  let tier: number
  if (level <= 5) tier = 1
  else if (level <= 10) tier = 2
  else if (level <= 20) tier = 3
  else if (level <= 30) tier = 4
  else tier = 5

  const pool = TRAPS[tier]
  return { ...pool[Math.floor(Math.random() * pool.length)] }
}

export function rollTrapDamage(trap: Trap): number {
  return Math.floor(Math.random() * (trap.damageMax - trap.damageMin + 1)) + trap.damageMin
}