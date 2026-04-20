import { BotCommand } from '../types'

const LAG_MESSAGES = [
  `The server hiccups. A kobold freezes mid-swing. The tavern bard plays the same note for six seconds. ZulkirJax blames the Astral Plane.`,
  `Lag detected. Somewhere in the Nine Hells, a devil is filing a complaint about packet loss.`,
  `The dungeon stutters. Three skeletons T-pose simultaneously. This is fine.`,
  `Connection unstable. The dungeon master's crystal ball is buffering. Please hold.`,
  `DDO servers are doing their thing again. Your character is technically still falling from that ledge.`,
  `The rubber banding is brought to you by Goodyear Tire & Rubber, Bounce Fabric Sheets, and Monroe Shock Absorbers!`,
  `Lag spike. The dragon froze mid-roar. Enjoy the three seconds of invincibility while it lasts.`,
  `The Astral Plane is experiencing congestion. Your soul may arrive slightly delayed.`,
  `Server hiccup detected. The lich paused its monologue. First time for everything.`,
  `Lag. Classic DDO. The monsters have stopped moving but they can still smell your gold.`,
  `The dungeon is buffering. Estimated time to resume imminent death: unknown.`,
  `ZulkirJax has clipped through the geometry again. The dungeon does not acknowledge this.`,
  `Lag so bad even the loading screen is loading. Somewhere Fred weeps into his brain shake.`,
  `The server is thinking. The mimic is frozen mid-chest. Do not open the chest.`,
  `Network instability detected. Your hireling has walked into a wall and will stay there.`,
  `I find your lack of stability disturbing.`,
]

export const lagCommand: BotCommand = {
  name: 'lag',
  cooldownSeconds: 10,
  handler: async (channel, _username, _args, client) => {
    const msg = LAG_MESSAGES[Math.floor(Math.random() * LAG_MESSAGES.length)]
    client.say(channel, `🌀 ${msg}`)
  }
}