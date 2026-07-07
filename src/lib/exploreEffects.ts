import { supabase } from './supabase'

export type ExploreStat = 'attack' | 'defense' | 'damage'

export async function applyExploreEffect(
  username: string,
  effectType: 'buff' | 'debuff',
  stat: ExploreStat,
  amount: number,
  source: string,
  durationMs: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  await supabase.from('explore_effects').insert({
    twitch_username: username,
    effect_type: effectType,
    stat,
    amount,
    expires_at: expiresAt,
    source,
  })
}

export async function getActiveEffects(username: string): Promise<{
  attackBonus: number
  defenseBonus: number
  damageBonus: number
}> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('explore_effects')
    .select('*')
    .eq('twitch_username', username)
    .gt('expires_at', now)

  const result = { attackBonus: 0, defenseBonus: 0, damageBonus: 0 }
  for (const effect of data ?? []) {
    const sign = effect.effect_type === 'buff' ? 1 : -1
    const value = effect.amount * sign
    if (effect.stat === 'attack') result.attackBonus += value
    if (effect.stat === 'defense') result.defenseBonus += value
    if (effect.stat === 'damage') result.damageBonus += value
  }
  return result
}

export async function clearExploreEffects(username: string): Promise<void> {
  await supabase
    .from('explore_effects')
    .delete()
    .eq('twitch_username', username)
}

export async function pruneExpiredEffects(username: string): Promise<void> {
  const now = new Date().toISOString()
  await supabase
    .from('explore_effects')
    .delete()
    .eq('twitch_username', username)
    .lt('expires_at', now)
}