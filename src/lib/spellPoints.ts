import { supabase } from './supabase'

export const FULL_CASTER_CLASSES = [
  'wizard', 'sorcerer', 'cleric', 'druid', 'bard', 'warlock',
  'wild_mage', 'stormsinger', 'blightcaster', 'favored_soul', 'dark_apostate',
]

export const HALF_CASTER_CLASSES = [
  'paladin', 'arcane_trickster', 'dragon_disciple', 'acolyte_of_the_skin', 'dragon_lord',
]

export const DIVINE_PREP_CLASSES = [
  'cleric', 'paladin', 'favored_soul', 'dark_apostate',
]

export const ARCANE_FAILURE_CLASSES = [
  'wizard', 'sorcerer', 'warlock', 'wild_mage', 'bard',
  'blightcaster', 'dragon_lord', 'dragon_disciple', 'arcane_trickster', 'stormsinger',
]

export function getMaxSpellPoints(charClass: string, charLevel: number): number {
  if (FULL_CASTER_CLASSES.includes(charClass)) return charLevel * 2
  if (HALF_CASTER_CLASSES.includes(charClass)) return Math.floor(charLevel * 1.5)
  return 0
}

export function getSpellSlotCount(charLevel: number): number {
  // One spell slot per 2 levels, max 6
  return Math.min(6, Math.ceil(charLevel / 2))
}

export function getMinLevelForSpellLevel(spellLevel: number): number {
  const minimums: Record<number, number> = {
    1: 1, 2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17,
  }
  return minimums[spellLevel] ?? 99
}

export function getArmorFailureChance(armorType: string | null, charClass: string): number {
  if (!ARCANE_FAILURE_CLASSES.includes(charClass)) return 0
  switch (armorType) {
    case 'light': return 10
    case 'medium': return 25
    case 'heavy': return 50
    case 'shield': return 5
    default: return 0
  }
}

export function getConcentrationFailChance(damageTaken: number): number {
  if (damageTaken >= 16) return 60
  if (damageTaken >= 11) return 40
  if (damageTaken >= 6) return 25
  if (damageTaken >= 1) return 10
  return 0
}

export async function ensureSpellPoints(username: string, charClass: string, charLevel: number): Promise<void> {
  const maxPoints = getMaxSpellPoints(charClass, charLevel)
  await supabase.from('player_spell_points').upsert(
    { username, max_points: maxPoints, current_points: maxPoints },
    { onConflict: 'username', ignoreDuplicates: true }
  )
}

export async function getSpellPoints(username: string): Promise<{ current: number; max: number }> {
  const { data } = await supabase
    .from('player_spell_points')
    .select('current_points, max_points')
    .eq('username', username)
    .single()
  return { current: data?.current_points ?? 0, max: data?.max_points ?? 0 }
}

export async function spendSpellPoints(username: string, amount: number): Promise<boolean> {
  const { current } = await getSpellPoints(username)
  if (current < amount) return false
  await supabase
    .from('player_spell_points')
    .update({ current_points: current - amount })
    .eq('username', username)
  return true
}

export async function rechargeSpellPoints(username: string): Promise<void> {
  await supabase.rpc('recharge_spell_points', { p_username: username })
}