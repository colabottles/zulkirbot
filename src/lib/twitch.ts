export async function isSubscriber(username: string, channel: string): Promise<boolean> {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID!
    const accessToken = process.env.TWITCH_ACCESS_TOKEN!

    // Get broadcaster ID
    const broadcasterRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${channel}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )
    const broadcasterData = await broadcasterRes.json()
    const broadcasterId = broadcasterData.data?.[0]?.id
    if (!broadcasterId) return false

    // Get user ID
    const userRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${username}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )
    const userData = await userRes.json()
    const userId = userData.data?.[0]?.id
    if (!userId) return false

    // Check subscription
    const subRes = await fetch(
      `https://api.twitch.tv/helix/subscriptions/check?broadcaster_id=${broadcasterId}&user_id=${userId}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    return subRes.status === 200
  } catch {
    return false
  }
}