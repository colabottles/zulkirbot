import 'dotenv/config'
import http from 'http'
import { exec } from 'child_process'

const CLIENT_ID = process.env.TWITCH_CLIENT_ID!
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!
const REDIRECT_URI = 'http://localhost:3000/callback'
const SCOPES = [
  'chat:read',
  'chat:edit',
  'user:manage:whispers',
].join(' ')

const authUrl =
  `https://id.twitch.tv/oauth2/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}`

console.log('Opening browser for ZulkirBot authorization...')
exec(`start "${authUrl}"`)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:3000`)
  const code = url.searchParams.get('code')

  if (!code) {
    res.end('No code found.')
    return
  }

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })

  const token = await tokenRes.json()
  console.log('Full token response:', JSON.stringify(token, null, 2))

  console.log('\n✅ Token generated successfully!')
  console.log(`TWITCH_ACCESS_TOKEN=${token.access_token}`)
  console.log(`TWITCH_REFRESH_TOKEN=${token.refresh_token}`)

  res.end('Token generated! Check your terminal and update your .env file.')
  server.close()
})

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000...')
})