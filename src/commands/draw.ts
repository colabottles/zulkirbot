import { BotCommand } from '../types'
import { getGiveawayState, drawWinner } from '../lib/giveaway'
import { sendWhisper } from '../lib/whisper'

export const drawCommand: BotCommand = {
  name: 'draw',
  handler: async (channel, username, _args, client) => {
    if (username !== process.env.TWITCH_CHANNEL) {
      client.say(channel, `@${username} — you don't have permission to use that command.`)
      return
    }

    const state = getGiveawayState()

    if (state.entries.length === 0) {
      client.say(channel, `@${username} — no entries to draw from!`)
      return
    }

    if (!state.prizeCode) {
      client.say(channel, `@${username} — no prize code set! Use !setcode [codename] first.`)
      return
    }

    const winner = drawWinner()

    if (!winner) {
      client.say(channel, `@${username} — no entries to draw from!`)
      return
    }

    client.say(
      channel,
      `🎉 🎊 The winner of the ${state.prizeName} giveaway is... @${winner}! 🎊 🎉 ` +
      `Congratulations! Check your Twitch whispers for your prize code!`
    )

    console.log(`[Draw] Winner: ${winner}`)
    console.log(`[Draw] Prize code: ${state.prizeCode}`)
    console.log(`[Draw] Attempting whisper to ${winner}...`)

    const whisperSent = await sendWhisper(
      winner,
      `🎉 Congratulations! You won the ${state.prizeName} giveaway on ${process.env.TWITCH_CHANNEL}'s stream! ` +
      `Here is your code: ${state.prizeCode} — Enjoy!`
    )

    console.log(`[Draw] Whisper sent: ${whisperSent}`)

    if (!whisperSent) {
      client.say(
        channel,
        `@${winner} — I couldn't send you a whisper! Please make sure your whispers are open ` +
        `and contact @${process.env.TWITCH_CHANNEL} directly for your code.`
      )
    }

    client.say(
      channel,
      `@${process.env.TWITCH_CHANNEL} — don't forget to run !stop giveaway to resume the game! 🎮`
    )
  }
}