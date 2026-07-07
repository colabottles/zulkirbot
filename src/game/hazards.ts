export interface EnvironmentalHazard {
  name: string
  description: string
  damageMin: number
  damageMax: number
}

// Classes immune to all hazards
export const HAZARD_IMMUNE_CLASSES = ['ranger', 'druid', 'barbarian']

// Classes that take half damage
export const HAZARD_RESISTANT_CLASSES = ['fighter', 'paladin', 'monk']

export const HAZARDS: EnvironmentalHazard[] = [
  { name: 'Cave-In', description: 'The ceiling gives way without warning.', damageMin: 5, damageMax: 16 },
  { name: 'Poison Gas Vent', description: 'A crack in the floor releases a noxious cloud.', damageMin: 5, damageMax: 16 },
  { name: 'Collapsing Floor', description: 'The stonework crumbles beneath your feet.', damageMin: 5, damageMax: 16 },
  { name: 'Arcane Feedback', description: 'A residual spell discharge crackles through the air.', damageMin: 5, damageMax: 16 },
  { name: 'Flooding Corridor', description: 'Water surges from a hidden channel.', damageMin: 5, damageMax: 16 },
  { name: 'Falling Stalactite', description: 'Something shifts above and comes down fast.', damageMin: 5, damageMax: 16 },
  { name: 'Necrotic Seepage', description: 'The walls weep dark energy. It finds you.', damageMin: 5, damageMax: 16 },
  { name: 'Pressure Plate', description: 'A click underfoot. Then consequences.', damageMin: 5, damageMax: 16 },
  { name: 'Spore Cloud', description: 'A fungal colony detonates at your approach.', damageMin: 5, damageMax: 16 },
  { name: 'Unstable Rune', description: 'Someone\'s old ward activates. Incorrectly.', damageMin: 5, damageMax: 16 },
]

const roll = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

export function pickHazard(): EnvironmentalHazard {
  return HAZARDS[Math.floor(Math.random() * HAZARDS.length)]
}

export function rollHazardDamage(hazard: EnvironmentalHazard): number {
  return roll(hazard.damageMin, hazard.damageMax)
}