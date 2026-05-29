import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const ALLOWED_USERS = new Set(['neutralagent', process.env.TWITCH_CHANNEL!.replace('#', '').toLowerCase()])

const BUFF_DURATION_MS = 10 * 60 * 1000
const BUFF_COOLDOWN_MS = 30 * 60 * 1000
let lastBuffTime = 0
let buffTimeout: ReturnType<typeof setTimeout> | null = null

export interface SteveBuffState {
  attackBonus: number
  defenseBonus: number
  damageBonus: number
  active: boolean
}

export const steveBuff: SteveBuffState = {
  attackBonus: 2,
  defenseBonus: 2,
  damageBonus: 4,
  active: false,
}

const BURGER_MESSAGES = [
  `🍔 @neutralagent slides a cheeseburger across the floor. Steve French sniffs it, looks up, and decides @neutralagent is worthy. The dungeon trembles slightly.`,
  `🍔 Steve French accepts the cheeseburger with great dignity. @neutralagent has earned his favour. This is not a small thing.`,
  `🍔 @neutralagent: "Here you go, buddy." Steve French takes the cheeseburger. Something shifts in the dungeon. The monsters feel it.`,
  `🍔 The cheeseburger disappears in one bite. Steve French regards @neutralagent with something approaching respect. He is ready.`,
  `🍔 Steve French was already here. The cheeseburger was a formality. @neutralagent knew this. Everyone knew this.`,
]

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

export const burgerCommand: BotCommand = {
  name: 'burger',
  cooldownSeconds: 0,
  handler: async (channel, username, _args, client) => {
    if (!ALLOWED_USERS.has(username.toLowerCase())) {
      client.say(channel,
        `@${username} — Steve French does not accept cheeseburgers from strangers.`
      )
      return
    }

    const now = Date.now()
    if (now - lastBuffTime < BUFF_COOLDOWN_MS) {
      const remainingMins = Math.ceil((BUFF_COOLDOWN_MS - (now - lastBuffTime)) / 60000)
      client.say(channel,
        `🍔 Steve French is still full. Try again in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.`
      )
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('hp, max_hp')
      .eq('twitch_username', 'neutralagent')
      .single()

    if (!char) return

    lastBuffTime = now
    steveBuff.active = true

    const newHp = Math.min(char.max_hp, char.hp + 20)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', 'neutralagent')

    client.say(channel, pickRandom(BURGER_MESSAGES))
    await new Promise(r => setTimeout(r, 1500))
    client.say(channel,
      `🦁 Steve French is powered up! @neutralagent gains +2 attack, +2 defense, +4 damage, +20 HP for 10 minutes! (${newHp}/${char.max_hp} HP)`
    )

    if (buffTimeout) clearTimeout(buffTimeout)
    buffTimeout = setTimeout(() => {
      steveBuff.active = false
      client.say(channel, `🦁 Steve French's cheeseburger buff has worn off. He is eyeing @neutralagent's pockets for more.`)
    }, BUFF_DURATION_MS)
  }
}