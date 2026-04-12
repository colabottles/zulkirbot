# ZulkirBot

A text-based RPG played entirely in Twitch chat on [zulkirjax](https://twitch.tv/zulkirjax).

Create a character, fight monsters, find loot, level up — and try not to die permanently.

---

## Documentation

Full command reference and game guides at **[zulkirbot-docs.netlify.app](https://zulkirbot-docs.netlify.app)**

---

## Features

- **25 playable classes** — from Fighter and Wizard to Dark Apostate and Dragon Lord
- **Permadeath combat** — fight monsters scaled to your level, or die trying
- **PvP dueling** — challenge other players to turn-based duels
- **Party raids** — form a party and take on raid bosses together
- **Item shop** — rotating stock every hour, buy and sell gear
- **Bank vault** — store up to 50 items safe from permadeath
- **The Tavern** — drinks, meals, gambling, rumours, barkeep wisdom, and brawls
- **Prestige system** — reach Level 40 and ascend through Epic I to Epic V
- **Giveaway system** — broadcaster-run DDO code giveaways with automatic game pause
- **Titles** — earn titles by slaying monsters
- **Daily & weekly rewards** — gold and XP for regular players

---

## Tech Stack

- [Node.js](https://nodejs.org/) — runtime
- [TypeScript](https://www.typescriptlang.org/) — language
- [tmi.js](https://tmijs.com/) — Twitch chat integration
- [Supabase](https://supabase.com/) — database and auth
- [ts-node-dev](https://github.com/wclr/ts-node-dev) — development runner
- [dotenv](https://github.com/motdotla/dotenv) — environment variables

---

## Prerequisites

- Node.js v20 or higher
- npm
- A Supabase project
- A Twitch bot account with OAuth token

---

## Getting Started

**1. Clone the repo:**

```bash
git clone https://github.com/colabottles/zulkirbot
cd zulkirbot
```

**2. Install dependencies:**

```bash
npm install
```

**3. Create your `.env` file:**

```env
TWITCH_USERNAME=your_bot_name
TWITCH_CHANNEL=your_channel
TWITCH_CHANNEL_2=your_second_channel
TWITCH_ACCESS_TOKEN=your_oauth_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**4. Start the bot:**

```bash
npm run dev
```

You should see:
"YourBot" connected to #your_channel
[Shop] Rotated at ...

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start bot in development mode with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled bot from `dist/` |

---

## Project Structure

```plaintext
yourbot/
├── src/
│   ├── bot.ts               # Entry point
│   ├── router.ts            # Command router
│   ├── commands/            # All bot commands
│   ├── game/                # Combat engine, monsters, loot, dice
│   ├── lib/                 # Supabase, auth, helpers
│   └── types.ts             # Shared TypeScript types
├── .env                     # Environment variables (not committed)
├── package.json
└── tsconfig.json
```

---

## Bot Accounts

YourBot runs two Twitch accounts:

| Account | Role |
| --- | --- |
| **YourBot** | Posts bot messages in chat |
| **YourAccount** | Streamer account — do not use for bot credentials |

> ⚠️ Make sure your stream account is logged out of your browser before starting the bot to avoid duplicate messages in chat.

---

## Giveaway Flow

1. `!setcode [codename]` — load a prize code (game pauses automatically)
2. `!start giveaway [name]` — open entries
3. Viewers type `!ddo` to enter — 5 minute timer starts on first entry
4. `!draw` — picks a winner and whispers the prize code
5. `!stop giveaway` — resets state and resumes the game

---

## Contributing

This is a personal project for [zulkirjax](https://twitch.tv/zulkirjax) streams. Issues and suggestions welcome via GitHub Issues.

---

## License

ISC

---

## Links

- 🎮 [Watch on Twitch](https://twitch.tv/zulkirjax)
- 📖 [Documentation](https://zulkirbot-docs.netlify.app)
- 🎮 [DDO Stream](https://twitch.tv/ddostream) Wednesdays at 2pm Eastern (UTC -0700)
