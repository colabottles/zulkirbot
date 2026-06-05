import tmi from 'tmi.js'
import 'dotenv/config'
import { supabase } from './lib/supabase'
import { registerCommands } from '../src/router'
import { setShopClient } from './lib/shopRotation'
import { allCommands } from '../src/commands'
import { rotateShop } from './lib/shopRotation'
import { refreshToken } from './lib/auth'

const FOLLOW_WHISPER_REMINDERS = [
  `📢 Reminder: Follow @ZulkirBot on Twitch and send it a whisper so it can DM you prize codes during giveaways!`,
  `📢 Want to win giveaway prizes? Make sure you're following @ZulkirBot and have sent it a whisper first!`,
  `📢 Giveaway tip: ZulkirBot sends prize codes via whisper. Follow it and send a whisper now so you're ready!`,
  `📢 Don't miss out on prizes! Follow @ZulkirBot and whisper it anything to unlock prize code delivery.`,
  `📢 ZulkirBot whispers prize codes to winners — make sure you're following it and have whispered it at least once!`,
]

let isRefreshing = false

const client = new tmi.Client({
  options: { debug: false },
  connection: {
    reconnect: true,
    secure: true,
  },
  identity: {
    username: process.env.TWITCH_USERNAME!,
    password: `oauth:${process.env.TWITCH_ACCESS_TOKEN!}`,
  },
  channels: [
    process.env.TWITCH_CHANNEL!,
    process.env.TWITCH_CHANNEL_2!,
  ].filter(Boolean),
})

client.connect().then(async () => {
  console.log(`ZulkirBot connected to #${process.env.TWITCH_CHANNEL}`)
  client.say(`#${process.env.TWITCH_CHANNEL}`, `🎲 ZulkirBot v2.4.0 is online! Check the docs for the latest changes and new commands: https://zulkirbot-docs.netlify.app`)
  registerCommands(client, allCommands)
  setShopClient(client, process.env.TWITCH_CHANNEL!)
  await rotateShop()

  setInterval(rotateShop, 60 * 60 * 1000)

  setInterval(async () => {
    await supabase.rpc('return_expired_listings')
  }, 15 * 60 * 1000)

  setInterval(() => {
    const msg = FOLLOW_WHISPER_REMINDERS[Math.floor(Math.random() * FOLLOW_WHISPER_REMINDERS.length)]
    client.say(`#${process.env.TWITCH_CHANNEL}`, msg)
  }, 30 * 60 * 1000)

  setInterval(async () => {
    if (isRefreshing) return
    isRefreshing = true
    console.log('[Auth] Scheduled token refresh...')
    await refreshToken()
    isRefreshing = false
  }, 12 * 60 * 60 * 1000)
})