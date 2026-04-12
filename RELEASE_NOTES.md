# ZulkirBot Release Notes

---

## v1.3.0 — April 12, 2026

### Prestige System

- Added `!prestige` command — available at Level 40 for 1,000g
- Five prestige ranks: Epic I through Epic V
- Each prestige grants +10 permanent max HP
- Prestige badge displays in `!status`
- Players keep all gold, inventory, and bank vault on prestige

### XP Curve Overhaul

- Replaced flat XP thresholds with a BECMI-inspired curve
- Early levels (1-8) progress quickly and reward new players
- High levels (10-40) require serious dedication
- Level 40 now caps at 9,400,000 XP

### Documentation Site

- Launched ZulkirBot Docs at zulkirbot-docs.netlify.app
- Built with VitePress
- Full command reference, XP table, prestige guide, and more
- Cinzel Decorative headings, Grenze body text, #7B0005 brand color

---

## v1.2.0 — April 12, 2026

### Tavern Brawl

- Tavern brawls now trigger randomly at 15% chance when a player buys a drink or meal
- 30 second join window — type `!brawl` to enter
- Minimum 2 players required to start
- Free-for-all combat — last one standing wins
- Rewards scale with number of participants (15g + 10 XP per fighter)
- Losers drop to 0 HP — use `!rest` to recover

### Tavern Improvements

- Added `!drinks` command — standalone drink menu
- Added `!meals` command — standalone meal menu
- Added `!barkeep` — random barkeep quotes and tips (requires purchase)
- Added `!rumour` — random flavour text and gameplay hints (requires purchase)
- Replaced three-message tavern menu with single welcome message
- Added tavern session tracking — commands unlock after first purchase
- Updated `Traveler's Bread and Cheese` to `Primus's Poutine-a-Plenty`
- Updated `Mushroom Risotto` to `Manshoon's Mushroom Risotto`
- Updated `Halfling Pie` to `Athas Halfling Pie`
- Updated `Spiced Lamb Skewers` to `Sembian Spiced Lamb Skewers`

### Barkeep Names

Barkeep now randomly selects from a roster of DDO streamer names: Tavern Tails, JackDrag0n, Ysukai, NeutralAgent, Brakkart, Tuf_RPG, codiene42, guppyczar, Noobahlolic, Nachowench, and Bobhorn Leghorn.

---

## v1.1.0 — April 11, 2026

### Bank System

- Added `!bank deposit [item]` — deposit unequipped items into vault
- Added `!bank depositall` — deposit all unequipped items at once
- Added `!bank withdraw [item]` — retrieve items from vault
- Added `!bank list` — view vault contents
- 50 slots per player
- Bank is wiped on permadeath (cascading delete via Supabase)

### Selling Improvements

- Added `!sell all` — sell all unequipped, non-cursed items at once
- Added d100 lucky roll for Rare and Legendary items — roll 75+ for double payout
- Updated sell prices: Common 10g, Uncommon 30g, Rare 60g, Legendary 150g

### Giveaway Improvements

- Game commands now pause automatically when `!setcode` is used
- Game resumes automatically when `!stop giveaway` is run
- Added broadcaster reminder to run `!stop giveaway` after `!draw`
- Fixed giveaway timer — entries now correctly persist after `!ddo`
- Fixed "giveaway giveaway" double word in prize name display
- Fixed "1 entries" grammar — now correctly shows "1 entry"

### Duel Fixes

- Fixed loser HP — now correctly set to 0 (not 1) after a duel loss
- Fixed double message bug — win message no longer fires twice
- `upsertDuelStat` now correctly called for both winner and loser after every duel

---

## v1.0.1 — April 11, 2026

### Bug Fixes

- Fixed ZulkirJax duplicating bot messages in chat — caused by ZulkirJax being logged in while bot was running
- Fixed `!start giveaway` not persisting state to `!ddo` command
- Fixed shop rotation timer resetting on bot restart

### Startup Guide

- Generated printable ZulkirBot Startup & Recovery Guide PDF
- Covers prerequisites, startup steps, environment variables, token refresh, and quick reference
- Styled in ZulkirBot dark purple theme

---

## v1.0.0 — Initial Release

### Core RPG System

- Character creation with `!join` — 25 available classes
- Combat system with `!fight`, `!attack`, `!flee`
- Exploration with `!explore`, `!rest`, `!shrine`
- Inventory management — `!inventory`, `!equip`, `!unequip`, `!use`, `!drop`
- Item shop with hourly rotation — `!shop`
- Leveling system with XP and gold rewards
- Permadeath — characters deleted on death, recorded in `!graveyard`

### PvP Dueling

- Challenge system with `!duel`, `!accept`, `!decline`
- Turn-based combat with `!strike`
- Initiative roll to determine first turn
- Winner earns 50 XP
- PvP leaderboard with `!pvpboard`

### Party & Raids

- Party system — create, join, leave, status
- Raid system — turn-based boss fights with party
- XP and gold distributed by damage dealt
- Rare loot drops for all survivors
- 5% chance of legendary boss item drop

### Tavern

- Drink menu with combat buffs
- Meal menu with HP restoration
- Roulette gambling with `!gamble`

### Title System

- Titles earned by slaying monsters
- Set and display active title in `!status`

### Daily & Weekly Rewards

- `!daily` — up to 100g every 24 hours
- `!weekly` — up to 2,000 XP + rare item chance every 7 days

### Giveaway System

- `!setcode` — load prize code
- `!start giveaway` — start giveaway with 5 minute timer
- `!ddo` — enter giveaway
- `!draw` — pick winner and whisper prize code
- `!stop giveaway` — reset giveaway state

### Bot Infrastructure

- tmi.js Twitch chat integration
- Supabase backend
- Token refresh every 12 hours
- Shop rotation every hour
- Two bot accounts: ZulkirBot and ZulkirJax
