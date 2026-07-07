import { Client } from 'tmi.js'
import { supabase } from './supabase'
import { rollLootByRarity } from '../game/loot'
import { NEUTRAL_NPC_QUOTES, MERCHANT_STOCK_COUNT, MERCHANT_MARKUP } from '../game/npcs'
import { getMonsterForLevel } from '../game/monsters'
import { startFight } from '../game/engine'
import { formatRarity } from './rarity'
import { d6, d100 } from '../game/dice'

const FRIENDLY_NPCS = ['merchant', 'adventurer', 'hermit'] as const
const HOSTILE_NPCS = ['mugger', 'rival'] as const

type FriendlyNPC = typeof FRIENDLY_NPCS[number]
type HostileNPC = typeof HOSTILE_NPCS[number]

// Active merchant sessions — channel → stock
const activeMerchants = new Map<string, {
  username: string
  stock: { item: any; price: number }[]
  expiresAt: number
}>()

// Active adventurer trade sessions
const activeTrades = new Map<string, {
  offeredItem: any
  expiresAt: number
}>()

const HERMIT_HINTS = [
  `"The shrine you seek is beyond the locked chest. The locked chest is behind the trapped corridor. Good luck."`,
  `"Rare items fall from monsters of great power. Fight harder. Fight smarter. Fight more."`,
  `"The Deck of Many Things appears to those who explore long enough. Or so I have heard."`,
  `"A rested character fights better. !rest between battles, traveller."`,
  `"The shop rotates every hour. The good items go fast. Check it often."`,
  `"Duels are settled by initiative. The quick survive. The slow do not."`,
  `"Cursed items reveal themselves when equipped. The shrine can cleanse them."`,
  `"Guild members of The Hexmongers receive double giveaway entries. Worth knowing."`,
  `"The arena opens to all who dare. Six gladiators is the ideal number."`,
  `"Campaigns grow harder the deeper you go. Named campaigns are not for the unprepared."`,
]

export async function triggerNpcEncounter(
  client: Client,
  channel: string,
  username: string
): Promise<void> {
  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  // 40% friendly, 30% hostile, 30% neutral
  const roll = d100()

  if (roll <= 40) {
    const type = FRIENDLY_NPCS[Math.floor(Math.random() * FRIENDLY_NPCS.length)]
    await triggerFriendlyNpc(client, channel, username, char, type)
  } else if (roll <= 70) {
    const type = HOSTILE_NPCS[Math.floor(Math.random() * HOSTILE_NPCS.length)]
    await triggerHostileNpc(client, channel, username, char, type)
  } else {
    triggerNeutralNpc(client, channel, username)
  }
}

async function triggerFriendlyNpc(
  client: Client,
  channel: string,
  username: string,
  char: any,
  type: FriendlyNPC
): Promise<void> {
  if (type === 'merchant') {
    // Build stock — mix of uncommon and rare
    const stock: { item: any; price: number }[] = []
    for (let i = 0; i < MERCHANT_STOCK_COUNT; i++) {
      const rarity = d100() <= 30 ? 'rare' : 'uncommon'
      const item = rollLootByRarity(rarity)
      const basePrice = rarity === 'rare' ? 60 : 20
      const price = Math.ceil((basePrice + Math.floor(Math.random() * 10) * 5) * MERCHANT_MARKUP)
      stock.push({ item, price })
    }

    activeMerchants.set(username, {
      username,
      stock,
      expiresAt: Date.now() + 60_000,
    })

    const stockList = stock
      .map((s, i) => `${i + 1}) ${s.item.name} (${formatRarity(s.item.rarity)}) — ${s.price}gp`)
      .join(' | ')

    client.say(channel,
      `🛒 @${username} — a travelling merchant steps from the shadows. ` +
      `"Wares for the weary!" Stock: ${stockList}. ` +
      `Type !buyfrommerchant [number] within 60 seconds. Gold: ${char.gold}gp.`
    )

    setTimeout(() => {
      if (activeMerchants.get(username)?.expiresAt === activeMerchants.get(username)?.expiresAt) {
        activeMerchants.delete(username)
      }
    }, 60_000)

  } else if (type === 'adventurer') {
    // Offer a random uncommon item for trade
    const offeredItem = rollLootByRarity('uncommon')

    activeTrades.set(username, {
      offeredItem,
      expiresAt: Date.now() + 60_000,
    })

    client.say(channel,
      `🗡️ @${username} — a fellow adventurer nods at you. ` +
      `"I'll trade you this ${offeredItem.name} (${formatRarity(offeredItem.rarity)}) for any item in your pack." ` +
      `Type !tradeitem [item name] within 60 seconds.`
    )

    setTimeout(() => activeTrades.delete(username), 60_000)

  } else {
    // Hermit — hint + small XP
    const hint = HERMIT_HINTS[Math.floor(Math.random() * HERMIT_HINTS.length)]
    const xpBonus = 50

    await supabase
      .from('characters')
      .update({ xp: char.xp + xpBonus })
      .eq('twitch_username', username)

    client.say(channel,
      `🧙 @${username} — a hermit materializes from a crack in the wall. ` +
      `${hint} He vanishes before you can ask a follow-up question. +${xpBonus} XP.`
    )
  }
}

async function triggerHostileNpc(
  client: Client,
  channel: string,
  username: string,
  char: any,
  type: HostileNPC
): Promise<void> {
  if (type === 'mugger') {
    const goldStolen = Math.min(char.gold, Math.floor(char.gold * 0.15) + d6() * 5)
    const newGold = Math.max(0, char.gold - goldStolen)

    await supabase
      .from('characters')
      .update({ gold: newGold })
      .eq('twitch_username', username)

    client.say(channel,
      `🦹 @${username} — a cloaked figure shoves you into a wall. ` +
      `"Your coin or your life." They don't wait for an answer. ` +
      `-${goldStolen}gp stolen! (${newGold}gp remaining)`
    )

  } else {
    // Rival adventurer — start a fight using the engine
    const rivalMonster = getMonsterForLevel(char.level)
    rivalMonster.name = `Rival Adventurer`
    rivalMonster.hp = Math.floor(rivalMonster.hp * 1.2)

    client.say(channel,
      `⚔️ @${username} — a rival adventurer blocks your path, eyes on your pack. ` +
      `"Hand it over or fight for it." They draw first. Type !attack to fight back!`
    )

    await startFight(channel, username, client, rivalMonster)
  }
}

function triggerNeutralNpc(
  client: Client,
  channel: string,
  username: string
): void {
  const quote = NEUTRAL_NPC_QUOTES[Math.floor(Math.random() * NEUTRAL_NPC_QUOTES.length)]
  client.say(channel,
    `🧑 @${username} — a stranger passes by and says: ${quote}`
  )
}

// ------------------------------------------------------------
// !buyfrommerchant handler
// ------------------------------------------------------------

export async function handleBuyFromMerchant(
  client: Client,
  channel: string,
  username: string,
  args: string[]
): Promise<void> {
  const session = activeMerchants.get(username)

  if (!session || Date.now() > session.expiresAt) {
    activeMerchants.delete(username)
    client.say(channel, `@${username} — the merchant has moved on. Use !explore to find them again.`)
    return
  }

  const num = parseInt(args[0], 10)
  if (isNaN(num) || num < 1 || num > session.stock.length) {
    client.say(channel, `@${username} — pick a number between 1 and ${session.stock.length}.`)
    return
  }

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const selection = session.stock[num - 1]

  if (char.gold < selection.price) {
    client.say(channel,
      `@${username} — you can't afford that. You have ${char.gold}gp and it costs ${selection.price}gp.`
    )
    return
  }

  activeMerchants.delete(username)

  await supabase.from('inventory').insert({
    character_id: char.id,
    item_name: selection.item.name,
    item_type: selection.item.type,
    rarity: selection.item.rarity,
    stat_bonus: selection.item.stat_bonus,
    description: selection.item.description,
  })

  await supabase
    .from('characters')
    .update({ gold: char.gold - selection.price })
    .eq('twitch_username', username)

  client.say(channel,
    `🛒 @${username} purchased ${selection.item.name} for ${selection.price}gp! ` +
    `(${char.gold - selection.price}gp remaining)`
  )
}

// ------------------------------------------------------------
// !tradeitem handler
// ------------------------------------------------------------

export async function handleTradeItem(
  client: Client,
  channel: string,
  username: string,
  args: string[]
): Promise<void> {
  const session = activeTrades.get(username)

  if (!session || Date.now() > session.expiresAt) {
    activeTrades.delete(username)
    client.say(channel, `@${username} — the adventurer has moved on.`)
    return
  }

  if (!args.length) {
    client.say(channel, `@${username} — usage: !tradeitem [item name]`)
    return
  }

  const itemName = args.join(' ').toLowerCase()

  const { data: char } = await supabase
    .from('characters')
    .select('*')
    .eq('twitch_username', username)
    .single()

  if (!char) return

  const { data: items } = await supabase
    .from('inventory')
    .select('*')
    .eq('character_id', char.id)
    .eq('equipped', false)
    .ilike('item_name', `%${itemName}%`)

  if (!items || items.length === 0) {
    client.say(channel,
      `@${username} — you don't have that item unequipped in your pack.`
    )
    return
  }

  const tradedItem = items[0]
  const offeredItem = session.offeredItem
  activeTrades.delete(username)

  // Remove traded item
  await supabase.from('inventory').delete().eq('id', tradedItem.id)

  // Add offered item
  await supabase.from('inventory').insert({
    character_id: char.id,
    item_name: offeredItem.name,
    item_type: offeredItem.type,
    rarity: offeredItem.rarity,
    stat_bonus: offeredItem.stat_bonus,
    description: offeredItem.description,
  })

  client.say(channel,
    `🗡️ @${username} traded their ${tradedItem.item_name} for a ` +
    `${formatRarity(offeredItem.rarity)} ${offeredItem.name}. ` +
    `The adventurer nods and disappears into the dark.`
  )
}