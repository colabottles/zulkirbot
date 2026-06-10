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

    // Always post to chat — Twitch whispers are unreliable even when API returns 204
    client.say(
      channel,
      `@${winner} — your prize code has been sent to your Twitch whispers! ` +
      `If you don't receive it, please whisper @${process.env.TWITCH_CHANNEL} directly to claim your code.`
    )

    client.say(
      channel,
      `@${process.env.TWITCH_CHANNEL} — don't forget to run !stop giveaway to resume the game! 🎮`
    )
  }
}