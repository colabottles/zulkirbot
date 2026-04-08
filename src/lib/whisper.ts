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

export async function sendWhisper(
  recipientUsername: string,
  message: string
): Promise<boolean> {
  try {
    const [botId, recipientId] = await Promise.all([
      getBotUserId(),
      getTwitchUserId(recipientUsername),
    ])

    if (!botId || !recipientId) {
      console.error('Whisper error: could not resolve user IDs')
      return false
    }

    const response = await fetch(
      `https://api.twitch.tv/helix/whispers?from_user_id=${botId}&to_user_id=${recipientId}`,
      {
        method: 'POST',
        headers: {
          'Client-Id': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    )

    if (response.status === 204) return true

    const error = await response.json()
    console.error('Whisper API error:', error)
    return false
  } catch (err) {
    console.error('Whisper fetch error:', err)
    return false
  }
}