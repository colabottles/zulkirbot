import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

export const graveyardCommand: BotCommand = {
  name: 'graveyard',
  aliases: ['grave', 'rip', 'fallen'],
  cooldownSeconds: 10,
  handler: async (channel, username, _args, client) => {
    const { data: fallen } = await supabase
      .from('graveyard')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!fallen || fallen.length === 0) {
      client.say(channel, `The heroes graveyard is empty — no one has fallen yet!`)
      return
    }

    const list = fallen
      .map((h: any) => {
        const name = h.character_name ?? h.display_name
        return `${name} (${h.class} Lv.${h.level}, ${h.xp} XP, slain by ${h.killed_by})`
      })
      .join(' | ')

    client.say(channel, `🪦 Heroes Graveyard: ${list}`)
  }
}

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