import { supabase } from './supabase'

export interface PartyState {
  id: string
  leader_username: string
  status: 'open' | 'full' | 'raiding' | 'disbanded'
  max_size: number
  members: PartyMember[]
}

export interface PartyMember {
  twitch_username: string
  display_name: string
  is_alive: boolean
  damage_dealt: number
}

export interface ActiveRaid {
  partyId: string
  bossName: string
  bossHp: number
  bossMaxHp: number
  currentTurn: string
  turnOrder: string[]
  channel: string
}

const activeRaids = new Map<string, ActiveRaid>()

export function getActiveRaid(partyId: string): ActiveRaid | undefined {
  return activeRaids.get(partyId)
}

export function setActiveRaid(partyId: string, raid: ActiveRaid): void {
  activeRaids.set(partyId, raid)
}

export function removeActiveRaid(partyId: string): void {
  activeRaids.delete(partyId)
}

export async function getPartyByUsername(username: string): Promise<PartyState | null> {
  const { data: member } = await supabase
    .from('party_members')
    .select('party_id')
    .eq('twitch_username', username)
    .single()

  if (!member) return null

  return getPartyById(member.party_id)
}

export async function getPartyById(partyId: string): Promise<PartyState | null> {
  const { data: party } = await supabase
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .single()

  if (!party) return null

  const { data: members } = await supabase
    .from('party_members')
    .select('*')
    .eq('party_id', partyId)
    .order('joined_at', { ascending: true })

  return {
    ...party,
    members: members ?? [],
  }
}

export async function getPartySize(partyId: string): Promise<number> {
  const { data: members } = await supabase
    .from('party_members')
    .select('id')
    .eq('party_id', partyId)

  return members?.length ?? 0
}

export async function passLeadership(partyId: string, currentLeader: string): Promise<string | null> {
  const { data: members } = await supabase
    .from('party_members')
    .select('twitch_username')
    .eq('party_id', partyId)
    .eq('is_alive', true)
    .neq('twitch_username', currentLeader)
    .order('joined_at', { ascending: true })
    .limit(1)

  if (!members || members.length === 0) return null

  const newLeader = members[0].twitch_username

  await supabase
    .from('parties')
    .update({ leader_username: newLeader })
    .eq('id', partyId)

  return newLeader
}