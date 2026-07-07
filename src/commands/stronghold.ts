import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import {
  getStronghold, getStrongholdRooms, getMaterials,
  getStrongholdTypeName, getTierName, recalculateStrongholdStats,
  formatMaterials, destroyStronghold
} from '../lib/stronghold'
import {
  STRONGHOLD_TYPE_MAP, TIER_COSTS, TIER_STATS,
  TIER_ROOM_SLOTS, STRONGHOLD_TIER_NAMES, Material
} from '../game/strongholdData'
import { deductMaterials } from '../lib/stronghold'

export const strongholdCommand: BotCommand = {
  name: 'stronghold',
  aliases: ['sh'],
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('*')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const sub = args[0]?.toLowerCase()

    // !stronghold build — establish or upgrade
    if (sub === 'build') {
      const existing = await getStronghold(username)

      if (existing && !existing.is_destroyed) {
        // Upgrade existing stronghold
        if (existing.tier >= 5) {
          client.say(channel,
            `@${username} — your ${getTierName(existing.stronghold_type, existing.tier)} ` +
            `is already at maximum tier.`
          )
          return
        }

        const nextTier = existing.tier + 1
        const cost = TIER_COSTS[nextTier - 1]

        // Check gold
        if (char.gold < cost.gold) {
          client.say(channel,
            `@${username} — not enough gold to upgrade. ` +
            `Need ${cost.gold}gp, you have ${char.gold}gp.`
          )
          return
        }

        // Check materials
        const matCost: Partial<Record<Material, number>> = {}
        if (cost.wood > 0) matCost.wood = cost.wood
        if (cost.stone > 0) matCost.stone = cost.stone
        if (cost.iron > 0) matCost.iron = cost.iron
        if (cost.bronze > 0) matCost.bronze = cost.bronze
        if (cost.steel > 0) matCost.steel = cost.steel

        const mats = await getMaterials(username)
        for (const [mat, needed] of Object.entries(matCost)) {
          if ((mats[mat as Material] ?? 0) < (needed ?? 0)) {
            client.say(channel,
              `@${username} — not enough ${mat}. ` +
              `Need ${needed}, you have ${mats[mat as Material] ?? 0}.`
            )
            return
          }
        }

        // Deduct costs
        await supabase
          .from('characters')
          .update({ gold: char.gold - cost.gold })
          .eq('twitch_username', username)

        await deductMaterials(username, matCost)

        const tierStats = TIER_STATS[nextTier - 1]
        const newName = getTierName(existing.stronghold_type, nextTier)

        await supabase
          .from('strongholds')
          .update({
            tier: nextTier,
            max_hp: tierStats.hp,
            hp: tierStats.hp,
            defense: tierStats.defense,
            attack: tierStats.attack,
          })
          .eq('twitch_username', username)

        await recalculateStrongholdStats(username)

        client.say(channel,
          `🏰 @${username} — your stronghold has been upgraded to a ${newName}! ` +
          `(Tier ${nextTier} | HP: ${tierStats.hp} | ATK: ${tierStats.attack} | DEF: ${tierStats.defense})`
        )
        return
      }

      // Build new stronghold
      const cost = TIER_COSTS[0]

      if (char.gold < cost.gold) {
        client.say(channel,
          `@${username} — not enough gold to build a stronghold. ` +
          `Need ${cost.gold}gp, you have ${char.gold}gp.`
        )
        return
      }

      const matCost: Partial<Record<Material, number>> = {
        wood: cost.wood,
        stone: cost.stone,
      }

      const mats = await getMaterials(username)
      for (const [mat, needed] of Object.entries(matCost)) {
        if ((mats[mat as Material] ?? 0) < (needed ?? 0)) {
          client.say(channel,
            `@${username} — not enough ${mat} to build. ` +
            `Need ${needed}, you have ${mats[mat as Material] ?? 0}. Use !gather ${mat} to collect more.`
          )
          return
        }
      }

      await supabase
        .from('characters')
        .update({ gold: char.gold - cost.gold })
        .eq('twitch_username', username)

      await deductMaterials(username, matCost)

      const type = getStrongholdTypeName(char.class)
      const tierStats = TIER_STATS[0]
      const tierName = getTierName(type, 1)

      await supabase
        .from('strongholds')
        .insert({
          twitch_username: username,
          stronghold_type: type,
          tier: 1,
          hp: tierStats.hp,
          max_hp: tierStats.hp,
          defense: tierStats.defense,
          attack: tierStats.attack,
          morale: 50,
        })

      client.say(channel,
        `🏰 @${username} establishes a ${tierName}! ` +
        `(Tier 1 | HP: ${tierStats.hp} | ATK: ${tierStats.attack} | DEF: ${tierStats.defense} | Morale: 50) ` +
        `Use !build [room] to add rooms. Use !gather to collect materials.`
      )
      return
    }

    // !stronghold — view status
    const stronghold = await getStronghold(username)

    if (!stronghold || stronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you don't have a stronghold yet. ` +
        `Use !stronghold build to establish one (costs ${TIER_COSTS[0].gold}gp + ` +
        `${TIER_COSTS[0].wood} wood + ${TIER_COSTS[0].stone} stone).`
      )
      return
    }

    const rooms = await getStrongholdRooms(username)
    const mats = await getMaterials(username)
    const tierName = getTierName(stronghold.stronghold_type, stronghold.tier)
    const roomSlots = TIER_ROOM_SLOTS[stronghold.tier - 1]
    const roomList = rooms.length > 0
      ? rooms.map((r: any) => `${r.room_type}${r.is_damaged ? ' (damaged)' : ''}`).join(', ')
      : 'none'

    const matList = Object.entries(mats)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ') || 'none'

    const nextTier = stronghold.tier < 5
      ? ` | Next tier: ${TIER_COSTS[stronghold.tier].gold}gp + ${formatMaterials(TIER_COSTS[stronghold.tier] as any)}`
      : ''

    client.say(channel,
      `🏰 @${username}'s ${tierName} (Tier ${stronghold.tier}) | ` +
      `HP: ${stronghold.hp}/${stronghold.max_hp} | ` +
      `ATK: ${stronghold.attack} | DEF: ${stronghold.defense} | ` +
      `Morale: ${stronghold.morale}/100 | ` +
      `Rooms: ${rooms.length}/${roomSlots} (${roomList}) | ` +
      `Materials: ${matList}${nextTier}`
    )
  }
}