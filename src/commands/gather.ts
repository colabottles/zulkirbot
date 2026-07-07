import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { activeFights, startFight } from '../game/engine'
import {
  MATERIAL_GATHER_AMOUNTS, GATHER_COOLDOWN_MS,
  GATHER_MONSTER_CHANCE, Material
} from '../game/strongholdData'
import { addMaterial, getStronghold } from '../lib/stronghold'
import { d100 } from '../game/dice'

const VALID_MATERIALS: Material[] = ['wood', 'stone', 'iron', 'bronze', 'steel', 'mithral', 'adamantine']

// Per-player gather cooldowns
const gatherCooldowns = new Map<string, number>()

export const gatherCommand: BotCommand = {
  name: 'gather',
  cooldownSeconds: 5,
  handler: async (channel, username, args, client) => {
    if (!args.length) {
      client.say(channel,
        `@${username} — usage: !gather [material]. ` +
        `Materials: ${VALID_MATERIALS.join(', ')}.`
      )
      return
    }

    const material = args[0].toLowerCase() as Material

    if (!VALID_MATERIALS.includes(material)) {
      client.say(channel,
        `@${username} — unknown material "${material}". ` +
        `Valid materials: ${VALID_MATERIALS.join(', ')}.`
      )
      return
    }

    // Must have a stronghold to gather
    const stronghold = await getStronghold(username)
    if (!stronghold || stronghold.is_destroyed) {
      client.say(channel,
        `@${username} — you need a stronghold before you can gather materials. ` +
        `Use !stronghold build to establish one.`
      )
      return
    }

    // Can't gather while in a fight
    if (activeFights.has(username)) {
      client.say(channel, `@${username} — finish your fight before gathering materials.`)
      return
    }

    // Cooldown check
    const lastGather = gatherCooldowns.get(username) ?? 0
    const elapsed = Date.now() - lastGather
    if (elapsed < GATHER_COOLDOWN_MS) {
      const remaining = Math.ceil((GATHER_COOLDOWN_MS - elapsed) / 1000)
      client.say(channel,
        `@${username} — you need to rest before gathering again. (${remaining}s remaining)`
      )
      return
    }

    gatherCooldowns.set(username, Date.now())

    // Monster encounter chance
    if (d100() <= GATHER_MONSTER_CHANCE) {
      client.say(channel,
        `@${username} — something stirs in the ${getMaterialLocation(material)} as you gather. ` +
        `You are not alone out there!`
      )
      await startFight(channel, username, client)
      return
    }

    // Roll gather amount
    const [min, max] = MATERIAL_GATHER_AMOUNTS[material]
    const amount = min + Math.floor(Math.random() * (max - min + 1))

    await addMaterial(username, material, amount)

    const { data: char } = await supabase
      .from('characters')
      .select('class')
      .eq('twitch_username', username)
      .single()

    client.say(channel,
      `⛏️ @${username} gathers ${amount} ${material} from the surrounding area. ` +
      `Use !stronghold to check your materials.`
    )
  }
}

function getMaterialLocation(material: Material): string {
  switch (material) {
    case 'wood': return 'forest'
    case 'stone': return 'quarry'
    case 'iron': return 'mine'
    case 'bronze': return 'ruins'
    case 'steel': return 'forge ruins'
    case 'mithral': return 'deep caverns'
    case 'adamantine': return 'ancient mine'
  }
}