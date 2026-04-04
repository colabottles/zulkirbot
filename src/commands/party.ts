import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights } from '../game/engine'
import { isInDuel } from '../lib/duels'
import {
  getPartyByUsername,
  getPartyById,
  getPartySize,
  getActiveRaid,
  passLeadership,
  ActiveRaid,
  setActiveRaid,
  removeActiveRaid,
} from '../lib/party'
import { BOSSES } from '../game/bosses'
import { getCharacterStats } from '../lib/stats'
import { d20, d8, d100 } from '../game/dice'
import { rollLoot } from '../game/loot'
import { trackKill } from '../lib/kills'
import { formatClass } from '../lib/format'

export const partyCommand: BotCommand = {
  name: 'party',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel, `@${username} — usage: !party create | !party join | !party leave | !party status | !party raid | !party attack`)
      return
    }

    const sub = args[0].toLowerCase()

    // CREATE
    if (sub === 'create') {
      const existing = await getPartyByUsername(username)
      if (existing) {
        client.say(channel, `@${username} — you're already in a party!`)
        return
      }

      if (activeFights.has(username) || isInDuel(username)) {
        client.say(channel, `@${username} — finish your current fight before forming a party!`)
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

      const { data: party, error } = await supabase
        .from('parties')
        .insert({ leader_username: username, status: 'open' })
        .select()
        .single()

      if (error || !party) {
        client.say(channel, `@${username} — something went wrong creating the party.`)
        return
      }

      await supabase.from('party_members').insert({
        party_id: party.id,
        twitch_username: username,
        display_name: char.display_name,
      })

      client.say(
        channel,
        `⚔️ @${username} forms a party! Type !party join to join the adventure. ` +
        `Max size: 10. When full, the leader can use !party raid to begin!`
      )
      return
    }

    // JOIN
    if (sub === 'join') {
      const existing = await getPartyByUsername(username)
      if (existing) {
        client.say(channel, `@${username} — you're already in a party!`)
        return
      }

      if (activeFights.has(username) || isInDuel(username)) {
        client.say(channel, `@${username} — finish your current fight before joining a party!`)
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

      // Find an open party
      const { data: openParties } = await supabase
        .from('parties')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(1)

      if (!openParties || openParties.length === 0) {
        client.say(channel, `@${username} — no open parties! Use !party create to form one.`)
        return
      }

      const party = openParties[0]
      const size = await getPartySize(party.id)

      if (size >= party.max_size) {
        client.say(channel, `@${username} — that party is full! Use !party create to form your own.`)
        return
      }

      await supabase.from('party_members').insert({
        party_id: party.id,
        twitch_username: username,
        display_name: char.display_name,
      })

      const newSize = size + 1
      const statusUpdate = newSize >= party.max_size ? 'full' : 'open'

      await supabase
        .from('parties')
        .update({ status: statusUpdate })
        .eq('id', party.id)

      const fullMsg = newSize >= party.max_size
        ? ` The party is FULL! @${party.leader_username} can now use !party raid to begin!`
        : ` (${newSize}/${party.max_size} members)`

      client.say(
        channel,
        `⚔️ @${username} joins the party!${fullMsg}`
      )
      return
    }

    // LEAVE
    if (sub === 'leave') {
      const party = await getPartyByUsername(username)

      if (!party) {
        client.say(channel, `@${username} — you're not in a party!`)
        return
      }

      if (party.status === 'raiding') {
        client.say(channel, `@${username} — you can't leave during a raid!`)
        return
      }

      await supabase
        .from('party_members')
        .delete()
        .eq('party_id', party.id)
        .eq('twitch_username', username)

      const remaining = await getPartySize(party.id)

      if (remaining === 0) {
        await supabase.from('parties').update({ status: 'disbanded' }).eq('id', party.id)
        client.say(channel, `@${username} leaves the party. The party has disbanded.`)
        return
      }

      if (party.leader_username === username) {
        const newLeader = await passLeadership(party.id, username)
        if (newLeader) {
          client.say(channel, `@${username} leaves the party. @${newLeader} is now the party leader.`)
        }
      } else {
        client.say(channel, `@${username} leaves the party. (${remaining}/${party.max_size} members)`)
      }

      if (party.status === 'full') {
        await supabase.from('parties').update({ status: 'open' }).eq('id', party.id)
      }
      return
    }

    // STATUS
    if (sub === 'status') {
      const party = await getPartyByUsername(username)

      if (!party) {
        client.say(channel, `@${username} — you're not in a party!`)
        return
      }

      const memberList = party.members
        .map(m => `${m.display_name}${m.is_alive ? '' : ' 💀'}`)
        .join(', ')

      client.say(
        channel,
        `⚔️ Party (${party.members.length}/${party.max_size}) — ` +
        `Leader: @${party.leader_username} | Status: ${party.status} | Members: ${memberList}`
      )
      return
    }

    // RAID — spawn a boss
    if (sub === 'raid') {
      const party = await getPartyByUsername(username)

      if (!party) {
        client.say(channel, `@${username} — you're not in a party!`)
        return
      }

      if (party.leader_username !== username) {
        client.say(channel, `@${username} — only the party leader can start a raid!`)
        return
      }

      if (party.status === 'raiding') {
        client.say(channel, `@${username} — the raid has already started!`)
        return
      }

      if (party.status !== 'full') {
        client.say(channel, `@${username} — the party must be full before starting a raid!`)
        return
      }

      // Pick a random boss and scale to party size
      const boss = { ...BOSSES[Math.floor(Math.random() * BOSSES.length)] }
      const scaledHp = Math.floor(boss.hp * (1 + (party.members.length * 0.2)))
      const scaledAttack = Math.floor(boss.attack * (1 + (party.members.length * 0.05)))

      // Random turn order
      const turnOrder = party.members
        .map(m => m.twitch_username)
        .sort(() => Math.random() - 0.5)

      const raid: ActiveRaid = {
        partyId: party.id,
        bossName: boss.name,
        bossHp: scaledHp,
        bossMaxHp: scaledHp,
        currentTurn: turnOrder[0],
        turnOrder,
        channel,
      }

      setActiveRaid(party.id, raid)

      await supabase
        .from('parties')
        .update({ status: 'raiding' })
        .eq('id', party.id)

      client.say(
        channel,
        `👹 ${boss.name} — "${boss.title}" appears! ` +
        `(HP: ${scaledHp} | ATK: ${scaledAttack}) ` +
        `Turn order: ${turnOrder.map(t => `@${t}`).join(' → ')} | ` +
        `@${turnOrder[0]} — type !party attack to strike!`
      )
      return
    }

    // ATTACK
    if (sub === 'attack') {
      const party = await getPartyByUsername(username)

      if (!party) {
        client.say(channel, `@${username} — you're not in a party!`)
        return
      }

      const raid = getActiveRaid(party.id)

      if (!raid) {
        client.say(channel, `@${username} — no active raid! The leader needs to use !party raid first.`)
        return
      }

      if (raid.currentTurn !== username) {
        client.say(channel, `@${username} — it's @${raid.currentTurn}'s turn!`)
        return
      }

      const member = party.members.find(m => m.twitch_username === username)
      if (!member || !member.is_alive) {
        client.say(channel, `@${username} — you've been sent to the temple to recover!`)
        return
      }

      const { data: char } = await supabase
        .from('characters')
        .select('*')
        .eq('twitch_username', username)
        .single()

      if (!char) return

      const stats = await getCharacterStats(char)
      const boss = BOSSES.find(b => b.name === raid.bossName)
      if (!boss) return

      // Player attacks boss
      const playerRoll = d20()
      const playerHit = playerRoll + 2 + stats.attackBonus > boss.defense
      let playerDamage = 0

      if (playerHit) {
        playerDamage = d8() + stats.damageBonus
        raid.bossHp -= playerDamage

        // Track damage dealt
        await supabase
          .from('party_members')
          .update({ damage_dealt: member.damage_dealt + playerDamage })
          .eq('party_id', party.id)
          .eq('twitch_username', username)
      }

      const hitMsg = playerHit
        ? `@${username} hits ${raid.bossName} for ${playerDamage} damage!`
        : `@${username} misses ${raid.bossName}!`

      // Boss defeated
      if (raid.bossHp <= 0) {
        removeActiveRaid(party.id)
        await supabase.from('parties').update({ status: 'disbanded' }).eq('id', party.id)

        // Fetch updated members with damage dealt
        const { data: finalMembers } = await supabase
          .from('party_members')
          .select('*')
          .eq('party_id', party.id)
          .eq('is_alive', true)

        if (!finalMembers) return

        const totalDamage = finalMembers.reduce((sum, m) => sum + m.damage_dealt, 0)

        // Distribute XP and gold based on damage dealt
        for (const m of finalMembers) {
          const share = totalDamage > 0 ? m.damage_dealt / totalDamage : 1 / finalMembers.length
          const xpShare = Math.floor(boss.xp_reward * share)
          const goldShare = Math.floor(boss.gold_reward * share)

          const { data: memberChar } = await supabase
            .from('characters')
            .select('*')
            .eq('twitch_username', m.twitch_username)
            .single()

          if (memberChar) {
            await supabase
              .from('characters')
              .update({
                xp: memberChar.xp + xpShare,
                gold: memberChar.gold + goldShare,
              })
              .eq('twitch_username', m.twitch_username)
          }

          await trackKill(memberChar?.id ?? '', m.twitch_username, boss.name, true)
        }

        // Roll for named loot — 5% chance
        const { data: bossLoot } = await supabase
          .from('boss_loot')
          .select('*')
          .eq('boss_name', raid.bossName)
          .single()

        let lootMsg = ''

        if (bossLoot && d100() <= 5) {
          // Random alive member gets the named loot
          const luckyMember = finalMembers[Math.floor(Math.random() * finalMembers.length)]
          const { data: luckyChar } = await supabase
            .from('characters')
            .select('id')
            .eq('twitch_username', luckyMember.twitch_username)
            .single()

          if (luckyChar) {
            await supabase.from('inventory').insert({
              character_id: luckyChar.id,
              item_name: bossLoot.item_name,
              item_type: 'trinket',
              rarity: 'legendary',
              stat_bonus: bossLoot.stat_bonus,
              description: bossLoot.description,
            })
            lootMsg = ` 🌟 @${luckyMember.twitch_username} finds the legendary ${bossLoot.item_name}!`
          }
        }

        // Everyone else gets a rare or better item roll
        for (const m of finalMembers) {
          if (lootMsg.includes(m.twitch_username)) continue
          const rarityRoll = d100()
          const rarity = rarityRoll <= 20 ? 'legendary' : 'rare'
          const item = rollLoot()

          const { data: memberChar } = await supabase
            .from('characters')
            .select('id')
            .eq('twitch_username', m.twitch_username)
            .single()

          if (memberChar) {
            await supabase.from('inventory').insert({
              character_id: memberChar.id,
              item_name: item.name,
              item_type: item.type,
              rarity,
              stat_bonus: item.stat_bonus,
              description: item.description,
            })
          }
        }

        const rewards = finalMembers
          .map(m => {
            const share = totalDamage > 0 ? m.damage_dealt / totalDamage : 1 / finalMembers.length
            return `@${m.twitch_username} +${Math.floor(boss.xp_reward * share)} XP +${Math.floor(boss.gold_reward * share)}g`
          })
          .join(' | ')

        client.say(
          channel,
          `🏆 ${hitMsg} ${raid.bossName} has been defeated! ${rewards}${lootMsg}`
        )
        return
      }

      // Boss attacks a random alive member
      const aliveMember = party.members
        .filter(m => m.is_alive && m.twitch_username !== username)
        .sort(() => Math.random() - 0.5)[0] ?? member

      const { data: targetChar } = await supabase
        .from('characters')
        .select('*')
        .eq('twitch_username', aliveMember.twitch_username)
        .single()

      if (!targetChar) return

      const targetStats = await getCharacterStats(targetChar)
      const monsterRoll = d20()
      const monsterHit = monsterRoll + boss.attack > 12 + targetStats.defenseBonus
      let monsterDamage = 0

      if (monsterHit) {
        monsterDamage = boss.attack
        const newHp = targetChar.hp - monsterDamage

        if (newHp <= 0) {
          // Member sent to temple — not permadeath
          await supabase
            .from('characters')
            .update({ hp: 1 })
            .eq('twitch_username', aliveMember.twitch_username)

          await supabase
            .from('party_members')
            .update({ is_alive: false })
            .eq('party_id', party.id)
            .eq('twitch_username', aliveMember.twitch_username)

          // Remove from turn order
          raid.turnOrder = raid.turnOrder.filter(t => t !== aliveMember.twitch_username)

          // Check if all members are dead
          if (raid.turnOrder.length === 0) {
            removeActiveRaid(party.id)
            await supabase.from('parties').update({ status: 'disbanded' }).eq('id', party.id)
            client.say(
              channel,
              `💀 ${hitMsg} ${raid.bossName} strikes @${aliveMember.twitch_username} — the entire party has been sent to the temple! ` +
              `${raid.bossName} wins! Use !rest to recover.`
            )
            return
          }

          // Advance turn
          const currentIndex = raid.turnOrder.indexOf(raid.currentTurn)
          raid.currentTurn = raid.turnOrder[(currentIndex + 1) % raid.turnOrder.length]

          client.say(
            channel,
            `⚔️ ${hitMsg} ${raid.bossName} strikes @${aliveMember.twitch_username} for ${monsterDamage} damage — ` +
            `sent to the temple! [Boss HP: ${raid.bossHp}/${raid.bossMaxHp}] ` +
            `@${raid.currentTurn} — type !party attack!`
          )
          return
        }

        await supabase
          .from('characters')
          .update({ hp: newHp })
          .eq('twitch_username', aliveMember.twitch_username)
      }

      // Advance turn
      const currentIndex = raid.turnOrder.indexOf(username)
      raid.currentTurn = raid.turnOrder[(currentIndex + 1) % raid.turnOrder.length]

      const monsterMsg = monsterHit
        ? `${raid.bossName} strikes @${aliveMember.twitch_username} for ${monsterDamage} damage!`
        : `${raid.bossName} misses @${aliveMember.twitch_username}!`

      client.say(
        channel,
        `⚔️ ${hitMsg} ${monsterMsg} ` +
        `[Boss HP: ${raid.bossHp}/${raid.bossMaxHp}] ` +
        `@${raid.currentTurn} — type !party attack!`
      )
      return
    }

    client.say(channel, `@${username} — usage: !party create | !party join | !party leave | !party status | !party raid | !party attack`)
  }
}