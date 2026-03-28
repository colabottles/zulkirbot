import { supabase } from './supabase'

export async function trimGraveyard(): Promise<void> {
  const { data: allFallen } = await supabase
    .from('graveyard')
    .select('id, xp')
    .order('xp', { ascending: false })

  if (allFallen && allFallen.length > 20) {
    const toDelete = allFallen.slice(20).map((r: any) => r.id)
    await supabase.from('graveyard').delete().in('id', toDelete)
  }
}