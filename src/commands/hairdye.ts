import { BotCommand } from '../types'

const HAIRDYE_MESSAGES = [
  `You open the latest SSG content update. Inside: a hair dye. Crimson Despair. Very exciting.`,
  `New patch dropped. Bug fixes? No. Balance changes? No. Hair dye? Twelve of them. Enjoy.`,
  `The dungeon master reaches into the content vault and produces a hair dye. Cerulean Regret. You are so grateful.`,
  `SSG heard your feedback about endgame content. Here is a hair dye. They heard you.`,
  `Congratulations. You have unlocked Ashen Mediocrity, a limited-time hair dye available for 2,000 DDO Points.`,
  `The developers worked tirelessly this quarter. The result: a hair dye called Void of Accountability. It is purple.`,
  `New hair dye available: Corporate Beige. Inspired by the quarterly meeting where someone suggested fixing lag instead.`,
  `Your character's hair can now be the color of broken promises. SSG calls it Sunrise Optimism.`,
  `The content team has delivered. It is a hair dye. It is always a hair dye. It will always be a hair dye.`,
  `Patch notes: fixed a typo in a tooltip from 2009. Added 47 hair dyes. Working as intended.`,
  `You wanted new quests. You wanted class balance. You wanted server stability. Here is Moonlit Disappointment, a hair dye.`,
  `SSG announces a major content update. The community holds its breath. It is a hair dye bundle. $19.99. Thank you for your support.`,
  `New hair dye: Existential Taupe. Limited time only. Your feedback about the lag has been noted and filed under hair dye.`,
  `The roadmap has been updated. Q1: hair dye. Q2: hair dye. Q3: surprise hair dye. Q4: holiday hair dye bundle.`,
  `You have received Smoldering Apathy, a rare hair dye. This is the endgame. This was always the endgame.`,
]

export const hairdyeCommand: BotCommand = {
  name: 'hairdye',
  cooldownSeconds: 10,
  handler: async (channel, _username, _args, client) => {
    const msg = HAIRDYE_MESSAGES[Math.floor(Math.random() * HAIRDYE_MESSAGES.length)]
    client.say(channel, `💇 ${msg}`)
  }
}