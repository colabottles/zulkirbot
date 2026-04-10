import tmi from 'tmi.js'
import 'dotenv/config'
import { registerCommands } from '../src/router'
import { allCommands } from '../src/commands'
import { rotateShop } from './lib/shopRotation'
import { refreshToken } from './lib/auth'

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
  channels: [process.env.TWITCH_CHANNEL!],
})

client.connect().then(async () => {
  console.log(`ZulkirBot connected to #${process.env.TWITCH_CHANNEL}`)
  registerCommands(client, allCommands)
  await rotateShop()
  setInterval(rotateShop, 60 * 60 * 1000)

  // Refresh token every 30 days
  setInterval(async () => {
    if (isRefreshing) return
    isRefreshing = true
    console.log('[Auth] Scheduled token refresh...')
    await refreshToken()
    isRefreshing = false
  }, 30 * 24 * 60 * 60 * 1000)
}).catch(console.error)