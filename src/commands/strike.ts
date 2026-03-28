import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { getActiveDuel, removeDuel } from '../lib/duels'
import { getCharacterStats } from '../lib/stats'
import { d20, d8 } from '../game/dice'
import { formatClass } from '../lib/format'

const XP_REWARD = 50

export const strikeCommand: BotCommand = {
  name: 'strike',
  aliases: ['s'],
  cooldownSeconds: 3,
  handler: async (channel, username, _args, client) => {
    const duel = getActiveDuel(username)

    if (!duel) {
      client.say(channel, `@${username} — you're not in a duel!`)
      return
    }

    if (duel.currentTurn !== username) {
      const opponent = duel.challenger === username ? duel.target : duel.challenger
      client.say(channel, `@${username} — it's @${opponent}'s turn!`)
      return
    }

    const opponent = duel.challenger === username ? duel.target : duel.challenger

    const { data: attackerChar } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    const { data: defenderChar } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', opponent)
      .single()

    if (!attackerChar || !defenderChar) {
      client.say(channel, `@${username} — something went wrong with the duel.`)
      removeDuel(duel.challenger, duel.target)
      return
    }

    const attackerStats = await getCharacterStats(attackerChar)
    const defenderStats = await getCharacterStats(defenderChar)

    // Attack roll
    const roll = d20()
    const hit = roll + 2 + attackerStats.attackBonus > 10 + defenderStats.defenseBonus
    let damage = 0

    if (hit) {
      damage = d8() + attackerStats.damageBonus

      if (duel.challenger === username) {
        duel.targetHp -= damage
      } else {
        duel.challengerHp -= damage
      }
    }

    const attackerHp = duel.challenger === username ? duel.challengerHp : duel.targetHp
    const defenderHp = duel.challenger === username ? duel.targetHp : duel.challengerHp

    const hitMsg = hit
      ? `@${username} hits @${opponent} for ${damage} damage!`
      : `@${username} misses @${opponent}!`

    // Check if duel is over
    if (defenderHp <= 0) {
      removeDuel(duel.challenger, duel.target)

      // Award XP to winner
      const { data: winnerChar } = await supabase
        .from('characters')
        .select('*')
        .eq('twitch_username', username)
        .single()

      if (winnerChar) {
        await supabase
          .from('characters')
          .update({ xp: winnerChar.xp + XP_REWARD })
          .eq('twitch_username', username)
      }

      // Set loser to 1 HP
      await supabase
        .from('characters')
        .update({ hp: 1 })
        .eq('twitch_username', opponent)

      // Update duel stats
      await upsertDuelStat(username, attackerChar.display_name, true)
      await upsertDuelStat(opponent, defenderChar.display_name, false)

      client.say(
        channel,
        `⚔️ ${hitMsg} ` +
        `🏆 @${username} wins the duel! +${XP_REWARD} XP! ` +
        `@${opponent} is defeated and left with 1 HP. Use !rest to recover.`
      )
      return
    }

    // Switch turns
    duel.currentTurn = opponent
    duel.last_action = Date.now()

    client.say(
      channel,
      `⚔️ ${hitMsg} ` +
      `[@${username} HP: ${attackerHp} | @${opponent} HP: ${defenderHp}] ` +
      `@${opponent} — type !strike to fight back!`
    )
  }
}

async function upsertDuelStat(
  username: string,
  displayName: string,
  won: boolean
): Promise<void> {
  const { data: existing } = await supabase
    .from('duel_stats')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (existing) {
    await supabase
      .from('duel_stats')
      .update({
        wins: won ? existing.wins + 1 : existing.wins,
        losses: won ? existing.losses : existing.losses + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('twitch_username', username)
  } else {
    await supabase.from('duel_stats').insert({
      twitch_username: username,
      display_name: displayName,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
    })
  }
}