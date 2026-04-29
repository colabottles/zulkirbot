import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

function getColor(num: number): string {
  if (num === 0) return 'green'
  return RED_NUMBERS.includes(num) ? 'red' : 'black'
}

export const gambleCommand: BotCommand = {
  name: 'gamble',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    if (args.length < 3) {
      client.say(channel, `@${username} — usage: !gamble [amount] [number 0-36] [red/black]`)
      return
    }

    const amount = parseInt(args[0])
    const chosenNumber = parseInt(args[1])
    const chosenColor = args[2].toLowerCase()

    if (isNaN(amount) || amount <= 0) {
      client.say(channel, `@${username} — invalid amount.`)
      return
    }

    if (isNaN(chosenNumber) || chosenNumber < 0 || chosenNumber > 36) {
      client.say(channel, `@${username} — pick a number between 0 and 36.`)
      return
    }

    if (chosenColor !== 'red' && chosenColor !== 'black') {
      client.say(channel, `@${username} — pick red or black.`)
      return
    }

    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) {
      client.say(channel, `@${username} — you don't have a character yet! Use !join to create one.`)
      return
    }

    if (char.gold < amount) {
      client.say(channel, `@${username} — you don't have enough gold! You have ${char.gold}gp.`)
      return
    }

    // Spin the wheel
    const result = Math.floor(Math.random() * 37) // 0-36
    const resultColor = getColor(result)

    const exactMatch = result === chosenNumber
    const colorMatch = resultColor === chosenColor && result !== 0

    let winnings = 0
    let resultMsg = ''

    if (exactMatch) {
      // Exact number match — 35:1 payout
      winnings = amount * 35
      resultMsg = `🎰 The wheel lands on ${result} ${resultColor.toUpperCase()}! EXACT MATCH! @${username} wins ${winnings}gp!`
    } else if (colorMatch) {
      // Color match — 1:1 payout
      winnings = amount
      resultMsg = `🎰 The wheel lands on ${result} ${resultColor.toUpperCase()}! Color match! @${username} wins ${winnings}gp!`
    } else {
      // Loss
      winnings = -amount
      resultMsg = `🎰 The wheel lands on ${result} ${resultColor.toUpperCase()}! @${username} loses ${amount}gp!`
    }

    const newGold = char.gold + winnings

    await supabase
      .from('characters')
      .update({ gold: newGold })
      .eq('twitch_username', username)

    client.say(channel, `${resultMsg} (Gold: ${newGold}gp)`)
  }
}