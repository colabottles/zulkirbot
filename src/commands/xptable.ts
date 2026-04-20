import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const XP_THRESHOLDS = [
  0, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 175000, 275000,
  400000, 550000, 700000, 875000, 1050000, 1250000, 1450000, 1675000,
  1900000, 2150000, 2400000, 2650000, 2925000, 3200000, 3500000,
  3800000, 4125000, 4450000, 4800000, 5150000, 5525000, 5900000,
  6300000, 6700000, 7125000, 7550000, 8000000, 8450000, 8925000,
  9400000,
]

export const xptableCommand: BotCommand = {
  name: 'xptable',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('level, xp')
      .eq('twitch_username', username)
      .single()

    const requestedLevel = args.length ? parseInt(args[0], 10) : char?.level ?? 1
    const centerLevel = isNaN(requestedLevel)
      ? char?.level ?? 1
      : Math.min(Math.max(requestedLevel, 1), 40)

    const startLevel = Math.max(1, centerLevel - 5)
    const endLevel = Math.min(40, centerLevel + 5)

    const rows: string[] = []
    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
      const xpNeeded = XP_THRESHOLDS[lvl - 1]
      const marker = lvl === char?.level ? '★' : ' '
      rows.push(`${marker}Lv${lvl}: ${xpNeeded.toLocaleString()} XP`)
    }

    const header = char
      ? `📊 XP Table (you are Lv${char.level} — ${char.xp.toLocaleString()} XP)`
      : `📊 XP Table`

    const nextLevel = char && char.level < 40
      ? ` | Next level at ${XP_THRESHOLDS[char.level].toLocaleString()} XP (${(XP_THRESHOLDS[char.level] - char.xp).toLocaleString()} to go)`
      : char?.level === 40
        ? ` | Maximum level reached!`
        : ''

    client.say(channel, `${header}${nextLevel} | ${rows.join(' | ')}`)
  }
}