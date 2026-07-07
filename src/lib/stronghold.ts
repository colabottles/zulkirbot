import { supabase } from './supabase'
import {
  STRONGHOLD_TYPE_MAP, STRONGHOLD_TIER_NAMES, TIER_COSTS,
  TIER_STATS, TIER_ROOM_SLOTS, ROOMS, Material,
  MATERIAL_GATHER_AMOUNTS, StrongholdType
} from '../game/strongholdData'

export async function getStronghold(username: string) {
  const { data } = await supabase
    .from('strongholds')
    .select('*')
    .eq('twitch_username', username)
    .single()
  return data
}

export async function getStrongholdRooms(username: string) {
  const { data } = await supabase
    .from('stronghold_rooms')
    .select('*')
    .eq('twitch_username', username)
  return data ?? []
}

export async function getMaterials(username: string): Promise<Record<Material, number>> {
  const { data } = await supabase
    .from('stronghold_materials')
    .select('*')
    .eq('twitch_username', username)

  const result: Record<string, number> = {}
  for (const row of data ?? []) {
    result[row.material] = row.amount
  }
  return result as Record<Material, number>
}

export async function addMaterial(username: string, material: Material, amount: number): Promise<void> {
  const { data: existing } = await supabase
    .from('stronghold_materials')
    .select('amount')
    .eq('twitch_username', username)
    .eq('material', material)
    .single()

  if (existing) {
    await supabase
      .from('stronghold_materials')
      .update({ amount: existing.amount + amount })
      .eq('twitch_username', username)
      .eq('material', material)
  } else {
    await supabase
      .from('stronghold_materials')
      .insert({ twitch_username: username, material, amount })
  }
}

export async function deductMaterials(
  username: string,
  costs: Partial<Record<Material, number>>
): Promise<boolean> {
  const current = await getMaterials(username)

  for (const [mat, needed] of Object.entries(costs)) {
    if ((current[mat as Material] ?? 0) < (needed ?? 0)) return false
  }

  for (const [mat, needed] of Object.entries(costs)) {
    await supabase
      .from('stronghold_materials')
      .update({ amount: (current[mat as Material] ?? 0) - (needed ?? 0) })
      .eq('twitch_username', username)
      .eq('material', mat)
  }
  return true
}

export function getStrongholdTypeName(charClass: string): StrongholdType {
  return STRONGHOLD_TYPE_MAP[charClass] ?? 'martial'
}

export function getTierName(type: StrongholdType, tier: number): string {
  return STRONGHOLD_TIER_NAMES[type][tier - 1] ?? 'Unknown'
}

export function getRoomCount(rooms: { room_type: string }[]): number {
  return rooms.filter(r => !('is_damaged' in r && (r as any).is_damaged)).length
}

export async function recalculateStrongholdStats(username: string): Promise<void> {
  const stronghold = await getStronghold(username)
  if (!stronghold) return

  const rooms = await getStrongholdRooms(username)
  const tierStats = TIER_STATS[stronghold.tier - 1]

  let hp = tierStats.hp
  let defense = tierStats.defense
  let attack = tierStats.attack
  let morale = 50

  for (const room of rooms) {
    if ((room as any).is_damaged) continue
    const def = ROOMS[room.room_type]
    if (!def) continue
    hp += def.statBonus.hp ?? 0
    defense += def.statBonus.defense ?? 0
    attack += def.statBonus.attack ?? 0
    morale += def.statBonus.morale ?? 0
  }

  morale = Math.min(100, Math.max(0, morale))

  await supabase
    .from('strongholds')
    .update({ max_hp: hp, hp: Math.min(stronghold.hp, hp), defense, attack, morale })
    .eq('twitch_username', username)
}

export async function destroyStronghold(username: string): Promise<string | null> {
  const stronghold = await getStronghold(username)
  if (!stronghold) return null

  const type = stronghold.stronghold_type as StrongholdType
  const tierName = getTierName(type, stronghold.tier)

  await supabase
    .from('strongholds')
    .update({ is_destroyed: true })
    .eq('twitch_username', username)

  return tierName
}

export function formatMaterials(mats: Partial<Record<Material, number>>): string {
  return Object.entries(mats)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
}

export async function hasAlliance(playerA: string, playerB: string): Promise<boolean> {
  const { data } = await supabase
    .from('stronghold_alliances')
    .select('id')
    .or(`and(player_a.eq.${playerA},player_b.eq.${playerB}),and(player_a.eq.${playerB},player_b.eq.${playerA})`)
    .single()
  return !!data
}

export async function formAlliance(playerA: string, playerB: string): Promise<void> {
  const exists = await hasAlliance(playerA, playerB)
  if (exists) return
  await supabase
    .from('stronghold_alliances')
    .insert({ player_a: playerA, player_b: playerB })
}