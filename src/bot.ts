import tmi from 'tmi.js'
import 'dotenv/config'
import { registerCommands } from '../src/router'
import { allCommands } from '../src/commands'
import { rotateShop } from './lib/shopRotation'

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
  registerCommands(client, allCommands)
  await rotateShop()
  setInterval(rotateShop, 60 * 60 * 1000)
}).catch(console.error)