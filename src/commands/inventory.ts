import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'
import { formatRarity } from '../lib/rarity'
import { sendWhisper } from '../lib/whisper'

const HIGHLIGHT_RARITIES = new Set(['rare', 'epic', 'legendary', 'mythic', 'artifact'])
const showCooldowns = new Map<string, number>()
const SHOW_COOLDOWN_MS = 15 * 60 * 1000
const PANEL_BASE_URL = 'https://zulkirbot.netlify.app'

// Attempt whisper — fall back to a condensed chat message if it fails
async function whisperOrChat(
  channel: string,
  username: string,
  message: string,
  client: import('tmi.js').Client
): Promise<void> {
  const sent = await sendWhisper(username, message)
  if (!sent) {
    // Truncate to avoid chat spam — cap at 400 chars
    const truncated = message.length > 400 ? message.slice(0, 397) + '...' : message
    client.say(channel, `@${username} ${truncated}`)
  }
}

export const inventoryCommand: BotCommand = {
  name: 'inventory',
  aliases: ['inv', 'bag', 'items'],
  handler: async (channel, username, args, client) => {
    const { data: char } = await supabase
      .from('characters')
      .select('id, character_name')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    const characterName = char.character_name ?? username

    const { data: items } = await supabase
      .from('inventory')
      .select('*')
      .eq('character_id', char.id)
      .order('rarity', { ascending: false })

    if (!items || items.length === 0) {
      await whisperOrChat(channel, username, `Your inventory is empty. Go fight something!`, client)
      return
    }

    // Stack duplicate items by name
    const stacked = new Map<string, { rarity: string; count: number; equipped: boolean }>()
    for (const item of items) {
      const key = item.item_name
      if (stacked.has(key)) {
        stacked.get(key)!.count++
      } else {
        stacked.set(key, { rarity: item.rarity, count: 1, equipped: !!item.equipped })
      }
    }

    // !inventory show — post highlights to chat with cooldown
    if (args[0]?.toLowerCase() === 'show') {
      const now = Date.now()
      const lastUsed = showCooldowns.get(username) ?? 0
      if (now - lastUsed < SHOW_COOLDOWN_MS) {
        const remainingMins = Math.ceil((SHOW_COOLDOWN_MS - (now - lastUsed)) / 60000)
        await whisperOrChat(channel, username,
          `You can show your inventory again in ${remainingMins} minute${remainingMins === 1 ? '' : 's'}.`,
          client
        )
        return
      }

      showCooldowns.set(username, now)

      const highlights = [...stacked.entries()]
        .filter(([_, { rarity }]) => HIGHLIGHT_RARITIES.has(rarity))
        .map(([name, { rarity, count, equipped }]) =>
          `${name} ${formatRarity(rarity)}${count > 1 ? ` x${count}` : ''}${equipped ? '[E]' : ''}`
        )

      const totalItems = items.length
      const equippedCount = items.filter(i => i.equipped).length

      if (highlights.length === 0) {
        client.say(channel,
          `🎒 ${characterName}'s inventory: ${totalItems} items (${equippedCount} equipped) — no rare or better items.`
        )
      } else {
        client.say(channel,
          `🎒 ${characterName}'s inventory: ${totalItems} items (${equippedCount} equipped) | ` +
          `Notable: ${highlights.join(', ')}`
        )
      }
      return
    }

    // Default !inventory — attempt whisper, fall back to chat
    const fullList = [...stacked.entries()]
      .map(([name, { rarity, count, equipped }]) =>
        `${name} ${formatRarity(rarity)}${count > 1 ? ` x${count}` : ''}${equipped ? '[E]' : ''}`
      )
      .join(', ')

    // Whisper the full list, then post the link to chat
    await whisperOrChat(
      channel,
      username,
      `🎒 ${characterName}'s inventory (${items.length} items): ${fullList}`,
      client
    )
    client.say(channel, `🎒 ${characterName}'s full inventory → ${PANEL_BASE_URL}/inventory.html?user=${username}`)
  }
}