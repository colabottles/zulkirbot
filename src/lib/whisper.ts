import fs from 'fs'
import path from 'path'
import 'dotenv/config'

async function getTwitchUserId(username: string): Promise<string | null> {
  const response = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
        'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN!}`,
      },
    }
  )
  const data = await response.json()
  return data.data?.[0]?.id ?? null
}

async function getBotUserId(): Promise<string | null> {
  return getTwitchUserId(process.env.TWITCH_USERNAME!)
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: process.env.TWITCH_REFRESH_TOKEN!,
      }),
    })

    const data = await response.json()

    if (!data.access_token) {
      console.error('Token refresh failed:', data)
      return null
    }

    process.env.TWITCH_ACCESS_TOKEN = data.access_token
    process.env.TWITCH_REFRESH_TOKEN = data.refresh_token

    const envPath = path.resolve(process.cwd(), '.env')
    let envContent = fs.readFileSync(envPath, 'utf-8')
    envContent = envContent.replace(
      /TWITCH_ACCESS_TOKEN=.*/,
      `TWITCH_ACCESS_TOKEN=${data.access_token}`
    )
    envContent = envContent.replace(
      /TWITCH_REFRESH_TOKEN=.*/,
      `TWITCH_REFRESH_TOKEN=${data.refresh_token}`
    )
    fs.writeFileSync(envPath, envContent)

    console.log('[Auth] Token refreshed successfully.')
    return data.access_token
  } catch (err) {
    console.error('Token refresh error:', err)
    return null
  }
}

export async function sendWhisper(
  recipientUsername: string,
  message: string
): Promise<boolean> {
  try {
    const [botId, recipientId] = await Promise.all([
      getBotUserId(),
      getTwitchUserId(recipientUsername),
    ])

    console.log(`[Whisper] Bot ID: ${botId}, Recipient ID: ${recipientId}`)

    if (!botId || !recipientId) {
      console.error('Whisper error: could not resolve user IDs')
      return false
    }

    const token = process.env.TWITCH_ACCESS_TOKEN!
    console.log(`[Whisper] Using token: ${token.slice(0, 8)}...`)

    const response = await fetch(
      `https://api.twitch.tv/helix/whispers?from_user_id=${botId}&to_user_id=${recipientId}`,
      {
        method: 'POST',
        headers: {
          'Client-Id': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    )

    console.log(`[Whisper] Response status: ${response.status}`)

    if (response.status === 401) {
      console.log('[Auth] Token expired, refreshing...')
      const newToken = await refreshAccessToken()
      if (!newToken) return false

      const retry = await fetch(
        `https://api.twitch.tv/helix/whispers?from_user_id=${botId}&to_user_id=${recipientId}`,
        {
          method: 'POST',
          headers: {
            'Client-Id': process.env.TWITCH_CLIENT_ID!,
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        }
      )
      console.log(`[Whisper] Retry response status: ${retry.status}`)
      if (retry.status !== 204) {
        const retryError = await retry.json()
        console.error('[Whisper] Retry error:', retryError)
      }
      return retry.status === 204
    }

    if (response.status === 204) return true

    const error = await response.json()
    console.error('Whisper API error:', error)
    return false
  } catch (err) {
    console.error('Whisper fetch error:', err)
    return false
  }
}