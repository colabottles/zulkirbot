import fs from 'fs'
import path from 'path'
import 'dotenv/config'

let refreshInProgress = false

export async function refreshToken(): Promise<boolean> {
  if (refreshInProgress) return false
  refreshInProgress = true

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
      console.error('[Auth] Token refresh failed:', data)
      return false
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
    return true
  } catch (err) {
    console.error('[Auth] Token refresh error:', err)
    return false
  } finally {
    refreshInProgress = false
  }
}