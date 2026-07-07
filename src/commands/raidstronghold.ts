import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import {
  getStronghold, getStrongholdRooms, getMaterials,
  getTierName, recalculateStrongholdStats, hasAlliance
} from '../lib/stronghold'
import { d100, d6 } from '../game/dice'

export const raidStrongholdCommand: BotCommand = {
  name: 'raid',
  cooldownSeconds: 10,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !raid [@username]`)
      return
    }

    const target = args[0].replace('@', '').toLowerCase()

    if (target === username) {
      client.say(channel, `@${username} — you can't raid your own stronghold.`)
      return
    }

    // Attacker must have a stronghold
    const attackerStronghold = await getStronghold(username)
    if (!attackerStronghold || attackerStronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you need a stronghold before raiding others. ` +
        `Use !stronghold build to establish one.`
      )
      return
    }

    // Target must have a stronghold
    const defenderStronghold = await getStronghold(target)
    if (!defenderStronghold || defenderStronghold.is_destroyed) {
      client.say(channel, `@${username} — ${target} doesn't have a stronghold to raid.`)
      return
    }

    // Alliance check — cannot raid allies
    const allied = await hasAlliance(username, target)
    if (allied) {
      client.say(channel,
        `@${username} — you are allied with ${target}. ` +
        `You cannot raid an ally.`
      )
      return
    }

    const attackerTierName = getTierName(attackerStronghold.stronghold_type, attackerStronghold.tier)
    const defenderTierName = getTierName(defenderStronghold.stronghold_type, defenderStronghold.tier)

    // Morale affects combat — high morale gives bonus
    const attackerMoraleBonus = Math.floor((attackerStronghold.morale - 50) / 10)
    const defenderMoraleBonus = Math.floor((defenderStronghold.morale - 50) / 10)

    // Auto-resolve raid
    const attackRoll = d100() + attackerStronghold.attack + attackerMoraleBonus
    const defenseRoll = d100() + defenderStronghold.defense + defenderMoraleBonus

    const attackerWins = attackRoll > defenseRoll

    if (attackerWins) {
      // Steal gold — 10–20% of defender's gold
      const { data: defenderChar } = await supabase
        .from('characters')
        .select('gold')
        .eq('twitch_username', target)
        .single()

      const { data: attackerChar } = await supabase
        .from('characters')
        .select('gold')
        .eq('twitch_username', username)
        .single()

      let goldStolen = 0
      if (defenderChar && defenderChar.gold > 0) {
        const pct = 0.10 + Math.random() * 0.10
        goldStolen = Math.floor(defenderChar.gold * pct)
        await supabase
          .from('characters')
          .update({ gold: defenderChar.gold - goldStolen })
          .eq('twitch_username', target)

        if (attackerChar) {
          await supabase
            .from('characters')
            .update({ gold: attackerChar.gold + goldStolen })
            .eq('twitch_username', username)
        }
      }

      // Steal materials — random amount of one material
      const mats = await getMaterials(target)
      const availableMats = Object.entries(mats).filter(([, v]) => v > 0)
      let matsMsg = ''

      if (availableMats.length > 0) {
        const [stolenMat, stolenAmt] = availableMats[Math.floor(Math.random() * availableMats.length)]
        const stealAmt = Math.max(1, Math.floor(stolenAmt * 0.15))

        await supabase
          .from('stronghold_materials')
          .update({ amount: stolenAmt - stealAmt })
          .eq('twitch_username', target)
          .eq('material', stolenMat)

        await supabase
          .from('stronghold_materials')
          .update({ amount: (mats[stolenMat as keyof typeof mats] ?? 0) + stealAmt })
          .eq('twitch_username', username)
          .eq('material', stolenMat)

        matsMsg = ` and ${stealAmt} ${stolenMat}`
      }

      // 10% chance per room to damage a room
      const defenderRooms = await getStrongholdRooms(target)
      const damagedRooms: string[] = []

      for (const room of defenderRooms) {
        if (d100() <= 10) {
          await supabase
            .from('stronghold_rooms')
            .update({ is_damaged: true })
            .eq('id', (room as any).id)
          damagedRooms.push((room as any).room_type)
        }
      }

      await recalculateStrongholdStats(target)

      // Reduce defender morale
      const newMorale = Math.max(0, defenderStronghold.morale - 15)
      await supabase
        .from('strongholds')
        .update({ morale: newMorale })
        .eq('twitch_username', target)

      const damageMsg = damagedRooms.length > 0
        ? ` Rooms damaged: ${damagedRooms.join(', ')}.`
        : ''

      client.say(channel,
        `⚔️ @${username}'s ${attackerTierName} raids ${target}'s ${defenderTierName}! ` +
        `The raid succeeds! Stolen: ${goldStolen}gp${matsMsg}.${damageMsg} ` +
        `${target}'s morale drops to ${newMorale}.`
      )

    } else {
      // Failed raid — attacker takes HP damage
      const hpLoss = d6() * 5
      const newHp = Math.max(1, attackerStronghold.hp - hpLoss)

      await supabase
        .from('strongholds')
        .update({ hp: newHp })
        .eq('twitch_username', username)

      // Reduce attacker morale
      const newMorale = Math.max(0, attackerStronghold.morale - 10)
      await supabase
        .from('strongholds')
        .update({ morale: newMorale })
        .eq('twitch_username', username)

      client.say(channel,
        `⚔️ @${username}'s ${attackerTierName} attacks ${target}'s ${defenderTierName}! ` +
        `The defenses hold! @${username}'s forces are repelled. ` +
        `-${hpLoss} stronghold HP. Morale drops to ${newMorale}.`
      )
    }
  }
}