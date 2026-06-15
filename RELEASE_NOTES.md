# ZulkirBot Release Notes

---

## v2.4.4 — June 11, 2026

### Duel & Campaign Reminder

- New recurring reminder fires every 30 minutes encouraging players to try `!duel` or `!campaign`, suppressed while any duel or campaign is currently active.
- New `src/lib/activityState.ts` module tracks active campaign count via `markCampaignActive()` / `markCampaignInactive()` / `isAnyCampaignActive()`.
- `src/lib/duels.ts` — new `isAnyDuelActive()` export checks whether any duel is in progress.
- `campaign.ts`, `named_campaign.ts`, and `greyhawk_campaign.ts` now wrap their respective campaign runners (`runCampaign`, `runNamedCampaign`, `runGreyhawkCampaign`) in `markCampaignActive()` / `markCampaignInactive()` so the reminder correctly skips during active play.

### Files v2.4.4

- `src/lib/activityState.ts` — new module
- `src/lib/duels.ts` — `isAnyDuelActive()` added
- `src/commands/campaign.ts` — campaign activity tracking wired into solo and party runs
- `src/commands/named_campaign.ts` — campaign activity tracking wired in
- `src/commands/greyhawk_campaign.ts` — campaign activity tracking wired in
- `src/bot.ts` — new `DUEL_CAMPAIGN_REMINDERS` pool, 30-minute interval reminder, suppressed when `isAnyDuelActive()` or `isAnyCampaignActive()` is true

## v2.4.3 — June 12, 2026

- Replaced all names with generated names.

## v2.4.2 — June 10, 2026

### Bug Fixes

- **`!solo` and `!party` roast** — Both commands now silently ignored by the unknown command handler. Previously the roast fired alongside the campaign mode selection, producing a spurious response in chat.
- **Giveaway whisper fallback** — `!draw` now always posts a chat message to the winner telling them to check their Twitch whispers, regardless of whether the whisper API returned success. Twitch's whisper API returns 204 (accepted) even when delivery fails silently — the chat fallback ensures winners are always notified.

### Files v2.4.2

- `src/router.ts` — `solo` and `party` added to `SILENT_COMMANDS`
- `src/commands/draw.ts` — winner chat notification always fires after whisper attempt

## v2.4.1 — June 6, 2026

### Bug Fixes & Improvements

- **`!arena`** — Removed broadcaster-only restriction. Any player can now open the arena. Join window extended from 60 seconds to 3 minutes. Opening announcement updated to call out 6 gladiators as the ideal number for a full run.
- **`!campaign`** — Fixed stale campaign rows locking players out with a false "already in a campaign" message. Campaigns older than 30 minutes are now marked failed before the active-party check runs.
- **Named campaigns** — Removed per-user daily cooldown from `handleNamedCampaignCommand` in both `named_campaign.ts` and `greyhawk_campaign.ts`. Players can now run campaigns freely without a once-per-day limit.
- **All campaign types** — Join windows are now keyed by `channel:campaignId` instead of channel alone, allowing two party campaigns to run simultaneously. `handleJoinCampCommand`, `handleNamedJoinCamp`, and `handleGreyhawkJoinCamp` all updated to find the most recently opened join window when multiple are active.
- **Greyhawk campaigns** — Removed channel-wide `greyhawkLock` that was blocking a second simultaneous campaign. Participants now load real HP from the `characters` table instead of hardcoded 100/100.
- **`!explore`** — Numeric suffixes (`!explore 11`, etc.) now fail silently. Only the bare `!explore` command is accepted.
- **Bot account filtering** — ZulkirBot now ignores messages from known bot accounts: `moobot`, `wizebot`, `sery_bot`, `wzbot`, `kofistreambot`, `soundalerts`, `zulkirjax`, `zulkirbot`.
- **Ysukai Directive removed** — First-command mute warning eliminated from `router.ts`.
- **`campaignState.ts` removed** — Dead module. `setCampaignActive` was never called so `isCampaignActive()` always returned false. Import and condition removed from `router.ts`.
- **Nachowench** — Added as the tavern barkeep. Visiting `!tavern` with no args now fully restores HP for free if the player is injured, with Nachowench serving nachos. Full HP players get a nod. Barkeep food is now driven by a `BARKEEP_FOOD` lookup in `barkeep.ts` so future barkeeps can serve their own food.
- **`!linkddo`** — New command. Players can link their DDO character name and server to their ZulkirBot account. ZulkirBot verifies the character exists on DDO Audit before saving.
- **Hexmongers giveaway bonus** — Players with a DDO character linked via `!linkddo` who are members of The Hexmongers guild on Thrane receive 2 giveaway entries when typing `!ddo`, matching the existing subscriber bonus.

### Database

- New columns on `characters`: `ddo_character_name` (text, nullable), `ddo_server` (text, nullable).

### Files v2.4.1

- `src/commands/arena.ts` — broadcaster check removed, join window extended to 3 minutes, announcement updated
- `src/commands/campaign.ts` — stale campaign cleanup added, join window keyed by campaign ID
- `src/commands/named_campaign.ts` — daily cooldown removed, join window keyed by campaign ID
- `src/commands/greyhawk_campaign.ts` — daily cooldown removed (was absent), `greyhawkLock` removed, join window keyed by campaign ID, real HP loaded for all participants
- `src/commands/explore.ts` — numeric argument guard added
- `src/commands/tavern.ts` — Nachowench heal logic added, barkeep and food pulled from `barkeep.ts`
- `src/commands/barkeep.ts` — `BARKEEP_FOOD` map added, `getActiveBarkeep` and `getBarkeepFood` exported
- `src/commands/ddo.ts` — Hexmongers guild check added via DDO Audit API
- `src/commands/linkddo.ts` — new command
- `src/lib/campaignState.ts` — deleted
- `src/router.ts` — `BOT_ACCOUNTS` filter added, Ysukai Directive removed, `campaignState` import and condition removed, `linkddo` wired

## v2.4.0 — June 4, 2026

### Gladiator Arena

- **`!arena`** — Broadcaster-only command that opens a 60-second join window for a gladiator arena event.
- **`!enterarena`** — Any player with a living character can enter during the join window.
- Once the window closes the arena runs automatically — no commands needed from players beyond `!attack` on their turn.
- Waves scale to participant count: 1–2 players get 4 waves, 3–4 players get 5 waves, 5+ players get 6 waves.
- All waves and enemies scale to average party level using the same formula as `!campaign`.
- No permadeath — fallen players are set to 0 HP at arena end. Use `!rest` to recover.
- Survivors earn XP and gold scaled to the number of waves cleared.

#### Arena Enemy Roster

Six waves of arena-exclusive enemies — distinct from the regular monster pool, campaign enemies, and invasion bosses:

| Wave | Enemy | Special |
| --- | --- | --- |
| 1 | Giant Hyena Pack | — |
| 2 | Retiarius Gladiator | Net Throw |
| 3 | Manticore | Tail Spike Volley |
| 4 | Darkmantle Swarm | Darkness Pulse |
| 5 | The Arena Master | Executioner's Strike |
| Final | Valdris the Unbroken | Wrath of the Undefeated |

#### Files v2.4.0

- `src/commands/arena.ts` — full arena handler, `handleArenaCommand`, `handleEnterArenaCommand`
- `src/router.ts` — `!arena` and `!enterarena` wired outside normal command map

## v2.3.0 — June 3, 2026

### Duel Automation

- Duels now resolve automatically after `!accept` — no `!strike` needed.
- Initiative is rolled as before; the bot then runs each round with a short delay between hits so chat can follow the action.
- Round-by-round results post to chat with both players' current HP.
- Win/loss resolution, XP award, level-up check, and `duel_stats` updates are unchanged.
- `!strike` removed as a player command.

### Inventory & Leaderboard Overlays

- `!inventory` no longer whispers the item list or posts it to chat. It now posts a direct link to the player's inventory page at `zulkirbot.netlify.app/inventory.html?user=username`.
- `!inventory show` removed.
- `!leaderboard` now posts a link to `zulkirbot.netlify.app/leaderboard.html` instead of telling chat that the scene is switching.
- `leaderboard.html` added to the Netlify site — top 10 players by XP, matching the inventory page design.

### Files v2.3.0

- `src/lib/duels.ts` — `currentTurn` and `last_action` removed from `ActiveDuel`; `startDuel` replaced with `runDuel` which owns the full automated fight loop; `upsertDuelStat` moved here from `strike.ts`
- `src/commands/accept.ts` — calls `runDuel` after initiative roll instead of `startDuel`
- `src/commands/strike.ts` — removed
- `src/commands/inventory.ts` — item list and whisper fallback removed; posts link only; `!inventory show` removed
- `src/commands/leaderboard.ts` — posts overlay link instead of scene-switch message
- `public/leaderboard.html` — new leaderboard overlay page

## v2.2.1 - June 1, 2026

### Changes

Added and edited shortcut keys and aliases.

## v2.2.0 — May 7, 2026

### Boss Invasion System

#### Added

- **`!invasion [boss_id]`** — Broadcaster-only command that triggers a channel-wide boss invasion event. Chat has a 2-minute join window followed by a 10-minute kill window to collectively defeat the boss.
- **`!joinevent`** — Dual-purpose command: enlists a player during the join window, or attacks the boss during the fight phase. Damage is rolled using the player's class stats and gear via the existing `getCharacterStats` formula.
- **`!invasion status`** — Displays current boss HP, participant count, and time remaining. Available to all viewers.
- **`!invasion cancel`** — Broadcaster only. Cleanly aborts an active invasion.

#### Boss Roster — 11 bosses across 3 tiers

**Tier 1: Legendary** (base HP 380–420, scales +28–30 HP per participant)

- Acererak, the Devourer of Souls
- Vecna, the Undying King
- Larloch, the Shadow King
**Tier 2: Demigod** (base HP 580–700, scales +38–45 HP per participant)
- Orcus, Prince of Undeath
- Demogorgon, Prince of Demons
- Tiamat, Queen of Evil Dragons
- Yeenoghu, Beast of Butchery
**Tier 3: True God** (base HP 900–1100, scales +55–65 HP per participant)
- Asmodeus, Lord of the Nine Hells
- Tharizdun, the Chained God
- Bane, the Black Hand
- Shar, Mistress of the Night

#### Mechanics

- Boss HP scales to participant count: `base_hp + (participants × hp_per_player)` — always a challenge regardless of viewer count.
- Boss counterattacks fire at 25% chance per hit, dealing tier-scaled damage to all participants.
- Counterattack HP reduction floors at 1 — invasions cannot cause permadeath.
- Periodic HP updates post every 2 minutes during the fight phase.
- If the boss is not killed within 10 minutes, the defeat message fires and the invasion ends.

#### Rewards (all participants)

- XP and gold scaled to boss tier.
- Unique invasion title granted per boss (e.g. "Tomb Breaker", "Void Walker", "Hell's Defiant").
- Per-player legendary item drop chance (7–25% depending on tier).

#### Database v2.2.0

- `player_titles` — existing table used for title grants (column: `username`).
- `player_titles (username, title)` — unique index added.
- `reduce_hp(_username, _amount)` — new Supabase RPC used for counterattack HP reduction across all participants.

#### Files

- `src/game/invasionBosses.ts` — boss roster and `getBossById` helper
- `src/game/invasion.ts` — full invasion engine (join window, fight phase, victory, defeat, cancel, status)
- `src/commands/invasionCommand.ts` — `invasionCommand` and `joinEventCommand`

---

## v2.1.1 — May 6, 2026

### Bug Fixes v2.1.1

- Fixed Zulkir Jax messages interleaving with command responses — `summonZulkirjax` is now awaited in `router.ts` so the full Zulkirjax sequence completes before any command executes. The triggering command is swallowed when Zulkirjax appears.
- Fixed misplaced closing brace in `router.ts` that was cutting off the message handler scope, causing linter errors for `username` and `channel`.

## v2.1.0

### New Features

#### Leaderboard Panel

- **`leaderboard.html`** — Local OBS browser source panel displaying the top 10 players by XP in a parchment stat block aesthetic matching the stream goals overlay. Refreshes every 60 seconds automatically. Located in `panels/leaderboard.html`.
- `!leaderboard` in chat now tells viewers that @zulkirjax will switch to the leaderboard scene shortly, instead of posting the full list.

#### Inventory Whisper & Show

- **`!inventory`** — Now whispers the full inventory list directly to the player instead of posting in chat. No cooldown.
- **`!inventory show`** — Posts a condensed inventory summary to chat showing only Rare, Epic, Legendary, Mythic, and Artifact items alongside total item and equipped counts. 15 minute per-user cooldown. Cooldown remaining is whispered back to the player.

#### Epic & Mythic Rarities

- Two new rarity tiers added: **Epic** and **Mythic**.
- Full rarity hierarchy: Common → Uncommon → Rare → Epic → Legendary → Mythic.
- Epic and Mythic items drop exclusively from campaigns and special events.
- Rarity indicators now use emoji + letter format throughout all chat messages: ⬜C, 🟩U, 🟦R, 🟪E, 🟧L, 🟥M.
- Sell prices: Epic 100gp, Mythic 200gp. Both eligible for lucky double roll.
- Player shop listing caps: Epic 80gp, Mythic 160gp.
- Supabase `inventory` rarity constraint updated to include `epic` and `mythic`.

### Bug Fixes v2.1.0

- Fixed ZulkirJax appearing multiple times in a row — added module-level summoning lock in `router.ts` to prevent race condition.
- Fixed Steve French dialog appearing 3x in a row — added `steveFrenchActive` lock in `stevefrench.ts`.
- Fixed `!battle` already-in-fight message not naming the monster — now says "you're already in a fight with the [monster name]".
- Fixed flavor commands page 404 in docs — sidebar link corrected from `/items/flavor` to `/tavern/flavor`.

### Changed

- `!donate`, `!vso`, `!so`, `!followage`, `!uptime` now silently ignored instead of triggering the unknown command roast.
- Rarity display unified across all chat messages via shared `formatRarity()` helper in `src/lib/rarity.ts`.

### Files v2.1.0

- `panels/leaderboard.html` — new leaderboard OBS panel
- `src/lib/rarity.ts` — new shared rarity display helper
- `src/commands/inventory.ts` — whisper default, show subcommand, cooldown
- `src/commands/leaderboard.ts` — updated chat message
- `src/commands/auctions.ts` — rarity display updated
- `src/commands/bank.ts` — rarity display updated
- `src/commands/bid.ts` — rarity display updated
- `src/commands/endauction.ts` — rarity display updated
- `src/commands/explore.ts` — rarity display updated
- `src/commands/listauction.ts` — rarity display updated
- `src/commands/listings.ts` — rarity display updated
- `src/commands/listsaleitem.ts` — rarity display updated, epic/mythic price caps added
- `src/commands/rogue_commands.ts` — rarity display updated
- `src/commands/sell.ts` — epic/mythic sell prices added
- `src/commands/shop.ts` — rarity display updated
- `src/commands/weekly.ts` — rarity display updated
- `src/commands/stevefrench.ts` — steveFrenchActive lock added
- `src/commands/fight.ts` — already-in-fight message updated with monster name
- `src/game/engine.ts` — rarity display updated
- `src/game/loot.ts` — epic/mythic added to rollRarity
- `src/types.ts` — ItemRarity extended with epic and mythic
- `src/lib/zulkirjax.ts` — zulkirjaxSummoning lock added
- `src/router.ts` — silent commands list updated

## v2.0.1 — May 4, 2026

### Changed v2.0.1

- **Combat initiation** — `!battle` is now the sole command to start a combat encounter. `!fight` has been removed as a player-facing command to eliminate confusion between initiating combat and attacking during combat. The flow is now unambiguous: `!battle` to start, `!attack` to fight.

## v2.0.0

### New Features v2.0.0

#### Player Marketplace

- **`!listsaleitem [item name] [price]`** — List an item for sale to other players. 10gp listing fee. Max 5 active listings per player. Listings expire after 24 hours and are automatically returned to inventory.
- **`!pbuy [username] [item name]`** — Purchase an item from another player's listing. Gold transfers immediately; seller receives payment on purchase.
- **`!removelisting [item name]`** — Remove your own listing and return the item to your inventory.
- **`!listings`** — View all active player listings with item name, rarity, price, and seller.
- Price caps enforced: items bought from the shop cannot be listed above purchase price. Items found or dropped cannot be listed above 80% of base rarity value (common 8gp, uncommon 24gp, rare 48gp, legendary 120gp).

#### Auction House

- **`!listauction [item name] [starting bid]`** — List an item for auction. One auction active at a time. Free to list. Item is removed from inventory immediately.
- **`!bid [amount]`** — Place a bid on the active auction. Must exceed current bid by at least 1gp. Gold is deducted immediately. Outbid players are refunded instantly.
- **`!auctions`** — View the current auction, item details, and high bid.
- **`!endauction`** — Broadcaster only. Closes the auction, awards item to winner, pays seller. If no bids, item is returned to seller.

#### Subscriber Giveaway Bonus

- Subscribers now receive 2 entries when typing `!ddo` during a giveaway. Non-subscribers receive 1. Subscribers are notified of their bonus entry in chat.

#### ZulkirJax — Wandering Menace

- Zulkir Jax now appears randomly during regular play (1% chance per command). He does not appear during campaigns.
- On appearance he taunts the triggering player, applies a random debuff (HP drain, max HP reduction, or flavor mark), and waits.
- Players can type `!attack` to drive him off. He dodges, stares awkwardly, and leaves.
- If no one attacks within 2 minutes he leaves on his own with a parting line.
- Debuffs: `jax_cold` (-8 HP), `jax_doubt` (-10 max HP until next rest), `jax_unease`, `jax_paranoia`, `jax_marked` (flavor only).

#### !stevefrench

- NeutralAgent-only command. Summons Steve French, a mountain lion companion.
- Steve French appears with flavor text drawn from Bubbles' quotes from Trailer Park Boys.
- If NeutralAgent is in a fight, Steve French attacks the monster for 20–35 damage.
- NeutralAgent recovers 15 HP from the comfort of having a mountain lion nearby.
- 30 second cooldown.
- Any other player attempting `!stevefrench` is told Steve French does not come when called by strangers.

#### Rogue Skill Flow Overhaul

- Rogue skill commands now require sequential steps — players can no longer skip directly to `!disabletrap` or `!opendoor`.
- Trap events (`trapped_chest`, `trapped_corridor`) now auto-sense on `!explore` and require `!findtraps` before `!disabletrap` can be used.
- Hidden door events now require `!searchdoor` to find the door before `!opendoor` can be used.
- New command: **`!opendoor`** — opens a hidden door after `!searchdoor` succeeds. Awards gold and loot.
- `PendingRogueEvent` now tracks `sensed` and `found` state flags.

#### New Commands

- **`!whois [username]`** — Look up another player's class and level.
- **`!addentry [username]`** — Broadcaster only. Manually add a viewer to the active giveaway.
- **`!status stats`** — View your combat bonuses: attack, defense, damage, and HP bonuses derived from equipped gear and class.
- **`!battle`** — Alias for `!fight`. Starts a combat encounter.
- **`!unequip all`** — Unequip all non-cursed items at once.

#### Spam Reduction

- Unknown commands now respond with a random sarcastic roast instead of silence (30 responses, personalized with username and command attempted).
- Cooldown hits now silently drop instead of announcing wait time in chat.
- Players without a character are now silently blocked at the router level instead of each command announcing it individually.
- Hireling attack and absorb messages collapsed into the main `!attack` response line.
- Victory hireling special message collapsed into the victory line.
- All `━━━` divider lines removed from campaign output.
- `!explore` messages condensed throughout — all outcomes shortened, empty results reduced to 3 short lines.

#### Reminders & Warnings

- First-command mute warning: the first time a player uses any command per stream session they are warned that Twitch will mute them for sending too many commands too fast.
- Follow/whisper reminder fires every 30 minutes with a random message from a pool of 5, reminding viewers to follow ZulkirBot and send it a whisper to receive prize codes.

#### Shop Warning

- A 3-minute warning now fires in chat before the shop rotates, telling players to browse before stock changes.

#### Campaign Flavor Text

- 50-entry flavor text pool added to `named_campaign.ts`. Random flavor line fires after `!solo` or party set, before each stage, on campaign fail, and on campaign complete.

### Bug Fixes v2.0.0

- Fixed `!campaign` auto-attack not firing after the player prompt window — `waitForAttack` now has a built-in timeout so combat resumes automatically if the player doesn't type `!attack`.
- Fixed `!disabletrap` rewarding players who had not first used `!findtraps`.
- Fixed duplicate hidden door block in `!explore` — unreachable dead code removed.
- Fixed player attack order in campaigns — now randomized each round instead of following join order.

### Changed v2.0.0

- `!status stats` added as a subcommand — note that `stats` was previously an alias for `!status` and remains so; the subcommand check fires first when `stats` is the first argument.
- Player shop listings filtered from `!shop` — `!shop` now shows only bot-rotated stock. Player listings are shown via `!listings`.
- `!commands` removed from Moobot/Wizebot — was generating unnecessary chat noise.
- Shop rotation announcement suppressed — the hourly rotation no longer announces in chat; only the 3-minute warning fires.

### Database v2.0.0

- New table: `auctions` — id, listed_by, item_name, item_type, rarity, stat_bonus, description, is_cursed, purchase_price, starting_bid, current_bid, current_bidder, is_active, created_at.
- New columns on `shop`: `owner`, `listed_by`, `listed_at`, `expires_at`, `is_player_listing`.
- New column on `inventory`: `purchase_price`.
- New SQL function: `return_expired_listings()` — called every 15 minutes to return expired player shop listings to seller inventory.

### Files v2.0.0

- `src/lib/zulkirjax.ts` — ZulkirJax wandering menace system
- `src/lib/campaignState.ts` — campaign active flag for ZulkirJax blocking
- `src/lib/twitch.ts` — Twitch API subscriber check
- `src/lib/shopRotation.ts` — 3-minute warning added, `setShopClient` added
- `src/commands/stevefrench.ts` — Steve French command
- `src/commands/whois.ts` — whois command
- `src/commands/addentry.ts` — manual giveaway entry command
- `src/commands/listsaleitem.ts` — player shop listing command
- `src/commands/pbuy.ts` — player shop purchase command
- `src/commands/removelisting.ts` — player shop removal command
- `src/commands/listings.ts` — player shop view command
- `src/commands/listauction.ts` — auction listing command
- `src/commands/bid.ts` — auction bid command
- `src/commands/endauction.ts` — auction close command
- `src/commands/auctions.ts` — auction view command
- `src/commands/rogue_commands.ts` — sequential skill gating, `opendoorCommand` added
- `src/commands/explore.ts` — condensed messages, duplicate block removed, auto-sense added
- `src/commands/status.ts` — `!status stats` subcommand added
- `src/commands/unequip.ts` — `!unequip all` added
- `src/commands/sell.ts` — `purchase_price` recorded on shop purchases
- `src/commands/shop.ts` — player listings filtered from display, `purchase_price` recorded
- `src/commands/ddo.ts` — subscriber double entry added
- `src/commands/inventory.ts` — item stacking with count display
- `src/game/engine.ts` — hireling messages collapsed, victory message collapsed
- `src/router.ts` — character gate, cooldown silencing, ZulkirJax trigger, mute warning, unknown command roasts, campaign state check
- `src/bot.ts` — follow/whisper reminders, shop client wiring, expired listing cleanup interval
- `src/commands/index.ts` — all new commands registered

## v1.9.0 — April 28, 2026

### Bug Fixes v1.9.0

- Fixed `!campaign` failing for all players — is_dead column referenced in character lookup did not exist; death is handled by row deletion
- Fixed campaign daily cooldown incorrectly blocking all players channel-wide; cooldown is now per-user
- Fixed `!joincamp` colliding with mode selection — mode choice now uses `!solo` and `!party`
- Fixed hardcoded 100 HP for campaign participants — players now enter campaigns at their actual current HP
- Fixed artifacts from campaigns not persisting to player inventory
- Fixed campaign titles not being saved to player_titles table
- Fixed XP and gold from named campaigns not applying to characters
- Fixed is_dead references in `named_campaign.ts` join handler

## New Features v1.9.0

### Character Names

- Players can set a custom character name with `!setname [name]`
- Character names appear alongside Twitch usernames in combat, campaign, duel, graveyard, leaderboard, inventory, titles, and reward messages
- Character names are stored in the characters table and persist across sessions
- Graveyard entries now store character name at time of death

### Artifact Inventory Slots

- 4 dedicated artifact equipment slots added (`equipped_artifact1` through `equipped_artifact4`)
- Artifacts from campaigns are now inserted into inventory as artifact item type
- `!equip` supports artifact items and finds the first open slot automatically
- Artifact slots contribute hpBonus to character stats

### Level-Scaled Campaign Enemies

- Standard campaign enemies now scale based on average party level (levels 1–10)
- Boss HP, damage, and player damage output all scale with average level
- Level range is announced at campaign start for both solo and party modes

### Campaign Improvements

- Campaign combat is now player-driven — each participant must type `!attack` on their turn
- Multiple players can now run campaigns simultaneously (per-channel lock removed)
- Named campaigns also support simultaneous runs per user
- Enemy target selection is now shuffled each round to distribute hits more evenly
- 4-second delay added before each attack prompt to give players time to read
- `!campaign` now announces level scaling at start
- Named campaigns announce level range at start

### Gold Display

- All gold amounts now display as gp instead of g throughout all commands and messages

### Weekly Reward

- Weekly XP reward reduced from 2000 to 1000
- Players who receive exactly 1 XP are taunted

### Help Command

- `!help` now returns a link to the ZulkirBot documentation instead of a command list

## v1.8.1 — April 24, 2026

### Bug Fixes v1.8.1

- **`!campaign` character lookup** — `.select('hp, is_dead')` was referencing a
  non-existent `is_dead` column, causing Supabase to return null for every character
  lookup and telling all players they had no character. Fixed to `.select('hp')` only —
  death is handled by row deletion, not a flag column.
- **Campaign combat** — Combat no longer runs automatically. Players now type `!attack`
  to take their turn. Each player is prompted in turn order with a 2-minute window to
  act before auto-attack fires. Non-campaign players can still use `!attack` for solo
  fights simultaneously without conflict.

### Documentation Fixes

- Fixed broken Next links throughout the docs site — `hirelings.md` was in `combat/`
  instead of `tavern/`, and `campaigns/gauntlet.md` was missing entirely
- Fixed truncated `::: danger Permadeath` block in `greyhawk.md`
- Fixed malformed stage table in the Mystara campaign page
- Added missing doc pages: Introduction, The Gauntlet, Deck of Many Things, Flavor
  Commands, Broadcaster Commands

## v1.8.0 — April 23, 2026

### Greyhawk Arc & Poll Command

#### Added v1.8.0

- **Greyhawk Arc** — Five sequential named campaigns adapted from the classic TSR Greyhawk modules. The arc runs from a village inn east of Hommlet to the Demonweb Pits. Each campaign unlocks the next. The arc has a single through-line and persistent consequences that carry forward between campaigns.

  - **`!campaign village-of-hommlet`** — T1. Greyhawk / Hommlet. Requires 3 standard clears. Difficulty 1.0×. Five stages through the village, the old moathouse, and the dungeon beneath it. Boss: Lareth the Beautiful (220 HP). Four outcomes with persistent consequences.

  - **`!campaign temple-of-elemental-evil`** — T1-4. Greyhawk / Hommlet Region. Requires completing Hommlet. Difficulty 1.15×. Five stages descending into the Temple, through the four elemental nodes, and into the chamber of the Elder Elemental Eye. Boss: Zuggtmoy, Demon Queen of Fungi (280 HP). Four outcomes with persistent consequences.

  - **`!campaign scourge-of-the-slave-lords`** — A1-4. Greyhawk / Pomarj. Requires completing the Temple. Difficulty 1.25×. Five stages through Highport, the warrens, Suderham, the council chamber, and the Aerie. Boss: Stalman Klim, High Priest of the Slave Lords (300 HP). Four outcomes with persistent consequences.

  - **`!campaign against-the-giants`** — G1-2-3. Greyhawk / Sterich and the Underdark approaches. Requires completing the Slave Lords. Difficulty 1.35×. Five stages through the hill giant steading, the glacial rift, the fire giant hall, the dark passage, and the Vault of the Drow. Boss: Eclavdra, Drow Noble of House Eilservs (320 HP). Four outcomes with persistent consequences.

  - **`!campaign queen-of-the-spiders`** — GDQ1-7. Greyhawk / Underdark / Demonweb Pits. Requires completing Against the Giants. Difficulty 1.50×. Five stages through the Underdark roads, the city of the drow, the Fane of Lolth, the Demonweb entrance, and the Demonweb Pits. Boss: Lolth, Demon Queen of Spiders — two-phase fight (450 HP). Four outcomes with persistent consequences.

- **Lolth two-phase boss fight** — Custom boss fight for Queen of the Spiders stage 5.
  - Phase 1 (450 HP → 225 HP): standard attacks, Web of Fate fires once when HP drops below 300 (55 damage to all participants).
  - Phase 2 (225 HP → 0): Demonweb bonus attacks (45% chance, 15–25 damage). Web Resurrection fires once when Lolth would be killed — resets her to 225 HP. Must be killed again.
  - Round cap: 15 rounds.

- **Arc completion title** — Completing all five Greyhawk Arc campaigns awards `[Who Walked the Greyhawk Arc]` to all survivors of Queen of the Spiders. Recorded in `player_greyhawk_arc_complete`.

- **20 persistent consequences** — Four per campaign, covering all outcomes including failure. Consequences carry forward into future campaigns via `checkGreyhawkConsequences()`.

- **`!poll`** — Broadcaster-only general chat poll command.
  - Usage: `!poll "Question" Option1 | Option2 | Option3` — up to 5 options.
  - `!poll stop` — ends the poll early and announces results.
  - 5-minute timer with a 1-minute reminder.
  - All viewers vote by typing 1–5. One vote per viewer, changeable before the poll closes.
  - Results announced with vote counts and percentages. Winner called or tie declared.

#### Database v1.8.0

- Seeded `named_campaigns`, `named_campaign_stages`, `named_campaign_outcomes`, `named_campaign_titles`, `named_campaign_artifacts` for all five Greyhawk Arc slugs.
- New tables: `player_greyhawk_clears`, `player_greyhawk_arc_complete`.
- New consequence flag columns for all 20 Greyhawk Arc consequence types.
- Failure outcome keys made unique per campaign: `temple_failure`, `slavers_failure`, `giants_failure`, `spiders_failure`.

#### Files v1.8.0

- `src/commands/greyhawk_campaigns.ts` — all five campaigns, all consequence triggers, Lolth boss fight, arc completion logic, `handleGreyhawkCampaignCommand`, `handleGreyhawkJoinCamp`, `checkGreyhawkConsequences`
- `src/commands/poll.ts` — poll command and `handlePollVote`
- `src/commands/index.ts` — `pollCommand` added to `allCommands`
- `src/router.ts` — Greyhawk slug routing, `handleGreyhawkJoinCamp` wired into `!joincamp`, `checkGreyhawkConsequences` called after `checkConsequences`, `handlePollVote` called on every message, `!campaigns` response updated
- `zulkirbot-docs/docs/.vitepress/config.mts` — Greyhawk Arc sidebar section added
- `zulkirbot-docs/docs/campaigns/greyhawk-arc/hommlet.md` — campaign documentation
- `zulkirbot-docs/docs/campaigns/greyhawk-arc/temple.md` — campaign documentation
- `zulkirbot-docs/docs/campaigns/greyhawk-arc/slavers.md` — campaign documentation
- `zulkirbot-docs/docs/campaigns/greyhawk-arc/giants.md` — campaign documentation
- `zulkirbot-docs/docs/campaigns/greyhawk-arc/spiders.md` — campaign documentation

## v1.7.0 — April 21, 2026

### Named Campaign: The Lich King of Thay

#### Added v1.7.0

- **`!campaign the-lich-king-of-thay`** — The ultimate named campaign. Forgotten Realms / Thay setting. Requires all 10 standard campaign clears AND all 10 named campaign clears — the only campaign with a dual unlock requirement.
  - Difficulty modifier: 1.50× — the hardest campaign in the game.
  - Five stages through Eltabbar: The Gates, The Undead Warrens, The Red Wizard Conclave, The Phylactery Vault, and The Throne of Szass Tam.
  - Stage 2 Death Wave (all, 30 damage), Stage 3 Arcane Suppression (single, 35), Stage 4 Soul Rend (all, 40).
  - Zulkir Jax uses all four undead specials throughout: level drain, fear, paralysis, necrotic fire.

- **Zulkir Jax two-phase boss fight** — Custom boss fight replacing the standard stage 5 combat loop.
  - Phase 1 (400 HP → 200 HP): standard attacks, undead specials at 45% chance, and Army of Ten Thousand — fires once when HP drops below 300, dealing 25 damage to all participants and eliminating any at or below 25 HP.
  - Phase 2 (200 HP → 0): Phylactery Pulse fires once when Zulkir Jax would be killed — resets him to 200 HP. Must be killed again. Undead special chance increases to 55%.
  - Round cap: 15 rounds, after which Zulkir Jax falls regardless of HP.

- **Four outcomes with persistent consequences:**
  - `defeat_the_lich` → `thayan_survivor` — 35% chance HP drain per future campaign
  - `submit_to_zulkirjax` → `lich_servant` — always fires, 30/70 boon/toll split, Thayan agents may spawn in future campaigns
  - `negotiate_with_zulkirjax` → `uneasy_pact` — always fires, 50/50 boon or gold toll
  - `zulkirjax_failure` → `zulkirjax_triumphant` — always fires, heaviest toll (25% gold + 16% HP drain)

- **Titles:** `[Stood in the Throne of Szass Tam]` (clear), `[The Lich Breaker]`, `[Thrall of the Lich King]`, `[Who Bargained with the Lich King]`, `[Witness to the Inevitable]`, plus four stage milestone titles.

- **Artifact:** The Seal of Eltabbar — pure flavor.

- **Thayan spawn pool** — `THAY_SPAWN_POOL` added. Triggered by `lich_servant` consequence, 20% chance per campaign stage.

- **`checkUltimateUnlock()`** — new function checking both `standard_clears >= 10` AND `named_clears >= 10`. Used exclusively for the Thay campaign unlock gate.

#### Database v1.7.0

- Seeded `named_campaigns`, `named_campaign_stages`, `named_campaign_outcomes`, `named_campaign_titles`, `named_campaign_artifacts` for slug `the-lich-king-of-thay`.
- New consequence flag columns: `thayan_triggered`, `lich_triggered`, `lich_boon`, `pact_triggered`, `pact_boon`, `triumphant_triggered`.
- `player_consequence_flags.flag_type` constraint extended with `thayan_survivor`, `lich_servant`, `uneasy_pact`, `zulkirjax_triumphant`.

#### Files v1.7.0

- `src/commands/named_campaigns.ts` — Thay campaign consequence triggers, spawn check, milestone titles, `runZulkirjaxFight`, `checkUltimateUnlock`, outcome announcements, stage loop routing
- `zulkirbot-docs/docs/campaigns/thay.md` — campaign documentation
- `zulkirbot-docs/docs/.vitepress/config.mts` — sidebar entry added

## v1.6.1 — April 20, 2026

### Bug Fixes & Improvements v1.6.1

- **Flee HP persistence** — `!flee` now correctly writes the player's post-flee HP to the database. Previously flee damage was applied in memory but not saved, causing `!status` to show stale HP.
- **Trap death fix** — Trap damage in `!explore` now re-fetches current HP from the database before calculating death, preventing a player with reduced HP from surviving a lethal trap hit.
- **`!unequip` ownership check** — Players can no longer attempt to unequip items that don't belong to their character.
- **`!campaign` character lookup** — Username is now normalized to lowercase before the character lookup, fixing the bug where fafhyrd and similar players were told they had no character when trying to start a campaign.
- **AFK auto-combat** — Players who go AFK during a fight now have auto-combat trigger after 20 minutes. The fight resolves automatically — player and monster trade hits until one falls. Permadeath still applies on loss. Previously AFK players were simply knocked to 0 HP.
- **`!weekly` Monday reset** — Weekly reward now resets every Monday at midnight UTC instead of on a rolling 7-day window. The cooldown message now shows time until next Monday.

### Files v1.6.1

- `src/commands/flee.ts` — HP write-back added on successful flee
- `src/commands/explore.ts` — fresh HP fetch before trap damage
- `src/commands/unequip.ts` — item ownership check added
- `src/commands/campaign.ts` — `.toLowerCase()` on username lookups
- `src/game/engine.ts` — `checkFightTimeout` replaced with auto-combat loop
- `src/commands/weekly.ts` — Monday reset logic replacing 7-day rolling window

## v1.6.0 — April 19, 2026

### Spell System, Hireling System, Rogue Skills, Combat Overhaul

### Added v1.6.0

- **Spell system** — Full spellbook for all 16 caster classes.
  - 6 spells per class drawn from official D&D rulebooks, spanning spell levels 1–9.
  - `!spells` — view your spellbook and current spell points.
  - `!cast [spellname]` — cast a spell in or out of combat. Offensive spells require an active fight.
  - `!learnspell` — browse available spells for your class. `!learnspell [name]` to learn one.
  - `!prayforspells` — divine casters (Cleric, Paladin, Favored Soul, Dark Apostate) prepare spells this way.
  - `!scribescroll [name]` — learn a spell from a scroll found in your inventory. Scroll is consumed.
  - Spell points pool scales with class and level: full casters get level × 2, half casters get level × 1.5.
  - Spell points recharge on `!rest` or `!shrine`.
  - Spell slots unlock every 2 levels up to a maximum of 6.
  - Armor spell failure — arcane casters wearing armor have a chance to fail casting (light 10%, medium 25%, heavy 50%).
  - Concentration — spells with duration can break if the caster takes damage mid-fight (10–60% chance scaling with damage taken).
  - Wild Magic Surge — Wild Mage has a 10% chance on every cast to trigger a random effect from the official 50-entry surge table.

- **Hireling system** — Hire a companion from the tavern for 2g per stream session.
  - `!hireling [class]` — hire a companion of the specified class.
  - `!hireling status` — check your current hireling's HP and class.
  - 25 available classes across 5 archetypes: melee (d10), finesse (d8), divine (d6), arcane (d6), support (d4).
  - Hirelings deal damage each combat round, absorb hits (20% chance per monster attack, 3 HP before dying), and fire mid-battle quips.
  - Each archetype has a passive special: finesse finds bonus gold, divine occasionally heals, arcane can double damage, support grants attack bonuses.
  - Unique purchase flavor, mid-battle quips, and melodramatic death speeches per archetype.
  - Hireling HP persists across fights. Restores 1 HP on `!rest` or `!shrine`.

- **Rogue skill commands** — Four new skill commands tied to `!explore` events.
  - `!picklock` — attempt to open a locked chest. Eligible: Rogue, Arcane Trickster, Artificer.
  - `!disabletrap` — disarm a trapped chest or corridor. Eligible: Rogue, Arcane Trickster, Ranger.
  - `!findtraps` — reveal hidden traps before they fire. Eligible: Rogue, Arcane Trickster, Artificer.
  - `!searchdoor` — find hidden doors and secret passages. Eligible: Rogue, Arcane Trickster, Ranger.
  - Success chance varies by class. Ineligible classes can attempt with a low chance of success.
  - Pending events expire after 3 minutes.
  - Four new explore events: locked chest, trapped chest, hidden door, trapped corridor.

- **`!rage`** — Barbarian only. Channels battle fury into the next attack for +d12 bonus damage. 30 second cooldown.

- **`!turnundead`** — Cleric, Paladin, Sacred Fist, Dark Apostate only. Level-scaled turning based on official D&D CR thresholds. Clerics and allied classes destroy undead; Paladins force flee. 2 minute cooldown, resets on `!rest` or `!shrine`.

- **`!xptable`** — Displays XP thresholds centered on your current level. Accepts an optional level argument (`!xptable 20`). Shows 11 levels, marks your current level with ★, and shows XP needed for the next level.

- **`!lag`** — DDO server lag flavor command. 15 random messages. 10 second cooldown.

- **`!hairdye`** — Sarcastic SSG hair dye flavor command. 15 messages. 10 second cooldown.

- **Broadcaster commands** — 16 new broadcaster-only commands:
  - `!layonhands [user]` — heals a target for a specified amount.
  - `!inspiration [user]` — grants guaranteed natural 20, ×2 damage, +d8 on next fight.
  - `!feeblemind [user]` — locks all commands for 2 minutes.
  - `!polymorph [user]` — transforms target into a sheep, locking all commands for 5 minutes.
  - `!tasha [user]` — Tasha's Hideous Laughter, locks commands for 2 minutes with flavor on every attempt.
  - `!scry [user]` — reveals HP, gold, level, class, and kill count in flavor text.
  - `!deathward [user]` — next time target reaches 0 HP they survive at 1 HP instead. Clears on bot restart.
  - `!heroesfeast` — grants all players in active fights +50% XP and gold on their next fight for 10 minutes.
  - `!critical [user]` — next action is an automatic critical hit.
  - `!fumble [user]` — next action is an automatic fumble.
  - `!advantage [user]` — next action rolls twice, takes higher.
  - `!disadvantage [user]` — next action rolls twice, takes lower.
  - `!identify [user]` — reveals kill count in flavor text.
  - `!beholder [user]` — fires a random eye ray (10 rays) at target.
  - `!deckofmany [user]` — draws from the canonical 22-card Deck of Many Things.
  - `!tarokka [user]` — same as deckofmany with Vistani flavor.

- **Deck of Many Things** — Full canonical 22-card implementation. Cards include The Void and Donjon (permadeath to graveyard — Donjon sends the player to an SSG hair dye factory), Skull (spawns a Death Avatar boss fight), Euryale (permanent -2 attack penalty), Rogue (forced PvP duel with random player), The Fates (d100: clear consequence flag or reverse last campaign outcome), and The Throne (unique title).

- **Undead special damage types** — Undead monsters now have special attacks that trigger on hit.
  - Level drain — temporary 10% XP loss (Shadow, Specter, Vampire Spawn, Vampire, Lich).
  - Disease — d6 damage per fight for 3 fights (Zombie, Revenant, Death Knight).
  - Paralysis — lose next turn, monster still attacks (Skeleton, Ghoul, Lich).
  - Fear — lose next turn, monster still attacks (Banshee, Death Knight).
  - Gold drain — 15% gold loss (Vampire Spawn, Vampire).
  - Necrotic fire — d6 fire + d6 necrotic damage (Death Knight only).
  - Trigger chance ranges from 25–40% depending on monster.

- **Scrolls in loot system** — Scrolls now drop from explore chests and rogue skill rewards. Rarity maps to spell level: common (1–3), uncommon (4–6), rare (7–9).

### Changed v1.6.0

- **`!explore`** — Four new event types added: locked chest, trapped chest, hidden door, trapped corridor. Roll thresholds adjusted to accommodate new events.
- **`!rest` and `!shrine`** — Now recharge spell points, restore 1 hireling HP, and reset `!turnundead` cooldown on successful use.
- **Campaign slug renames** — Four campaigns renamed for consistency:
  - Ashes of Xaryxis → **The Dying Star**
  - Ashes of the Shadow King → **The Ritual of Nibenay**
  - Ashes Beneath the Flame → **The Whispering Flame**
  - Ashes of the Black Emperor → **The Black Emperor**

### Database v1.6.0

- New tables: `spells`, `player_spellbook`, `player_spell_points`, `active_concentration`, `active_spell_effects`, `wild_magic_log`.
- New RPC: `recharge_spell_points`.
- New columns on `player_consequence_flags`: `order_triggered`, `ledger_triggered`, `tyrants_triggered`, `tyrants_boon`, `bane_triggered`, `euryale_attack_penalty`, `euryale_cursed` flag type added.
- Campaign slug updates propagated to `named_campaign_stages`, `named_campaign_outcomes`, `named_campaign_titles`, `named_campaign_artifacts`, `player_consequence_flags`.

### Files v1.6.0

- `src/commands/spells.ts` — spell system commands
- `src/commands/rage.ts` — rage command
- `src/commands/turnundead.ts` — turn undead command
- `src/commands/xptable.ts` — XP table command
- `src/commands/lag.ts` — lag flavor command
- `src/commands/hairdye.ts` — hair dye flavor command
- `src/commands/hireling.ts` — hireling system
- `src/commands/rogue_commands.ts` — rogue skill commands
- `src/commands/new_commands.ts` — broadcaster and special commands
- `src/lib/spellPoints.ts` — spell point utilities
- `src/lib/wildMagic.ts` — Wild Magic Surge table
- `src/lib/undeadSpecials.ts` — undead special damage system
- `src/game/engine.ts` — updated with all new combat hooks
- `src/game/monsters.ts` — undead monsters tagged with specials
- `src/types.ts` — `UndeadSpecial` type, `Monster` interface extended
- `src/commands/index.ts` — all new commands wired
- `src/commands/rest.ts` — spell recharge, hireling rest, turn undead reset
- `src/commands/shrine.ts` — spell recharge, hireling rest, turn undead reset
- `src/router.ts` — feeblemind, polymorph, tasha locks added
- `src/game/loot.ts` — scrolls included in `rollLootByRarity`

## v1.5.1

### Added v1.5.1

- **Named Campaign: The Tyrant Reforged** — A Forgotten Realms mini-campaign set in Zhentil Keep. Requires 6 standard campaign clears. Features a pure flavor artifact and four outcomes with persistent consequences tied to Bane's network.
- **Named Campaign: The Smiling Tyrant** — A Greyhawk mini-campaign set in the Flanaess. Requires 8 standard campaign clears. Features a pure flavor artifact and four outcomes with persistent consequences that follow players into future campaigns.
- **Named Campaign: Ashes of the Black Emperor** — A Dragonlance mini-campaign set on Krynn. Requires 5 standard campaign clears. Features a pure flavor artifact and four outcomes with the heaviest persistent consequence in the game.
- **Named Campaign: Ashes Beneath the Flame** — An Eberron mini-campaign set in Thrane. Requires 3 standard campaign clears. Features a unique artifact with persistent consequences.

## v1.5.0 — April 18, 2026

### Added v1.5.0

- **Named Campaign: Ashes of Xaryxis** — A Spelljammer mini-campaign set in Wildspace. Requires 3 standard campaign clears.
- **Named Campaign: Embers of the Second War** — A Planescape mini-campaign set in Dis, the Iron City. Requires 5 standard campaign clears. Features a legendary artifact with unique properties.
- **Named Campaign: The Shattered Memory of Darkon** — A Ravenloft mini-campaign set in Darkon. Requires 5 standard campaign clears. Features a unique artifact.
- **HP dice rolls on character creation** — Starting HP is now rolled on the class hit die rather than using a fixed value. Each class maps to its correct die (d4 through d12).
- **HP dice rolls on level up** — Each level gained now rolls the class hit die once, matching tabletop rules. Multiple levels gained at once roll once per level.

### Changed v1.5.0

- **Fight timeout extended** from 5 minutes to 20 minutes. AFK players have more time before the monster finishes them off.

### Fixed v1.5.0

- **`!revive` HP calculation** was incorrectly multiplying die size by character level. It now rolls the class hit die once per level, same as normal level up.

### Internal

- `CLASS_HP` removed and replaced with `CLASS_HP_DIE` and `rollHp` across `engine.ts`, `join.ts`, `party.ts`, `strike.ts`, `revive.ts`, `weekly.ts`, and `classes.ts`.

## v1.4.4 — April 16, 2026

### Al-Qadim Named Campaign & Codebase Cleanup

### Added v1.4.4

- **`!campaign alqadim`** — Second named campaign: *The Seal of the Incomparable*
  (Al-Qadim / Zakhara setting).
  - Requires 10 standard campaign clears to unlock.
  - Higher difficulty than the standard gauntlet (+25% base enemy HP and damage).
  - Five unique stages with named enemies, special abilities, and per-stage flavor text
    drawn from Al-Qadim lore, revised to avoid orientalist tropes.
  - Two rival factions — the Emerald Concordat and the Ashen Throne — converge at the
    Stage 5 confrontation alongside the boss.
  - Three-way ending vote: Use the Seal, Destroy the Seal, or Return it to the
    Elemental Planes. All three outcomes trigger distinct consequence flags.
  - Unique title pool (8 titles, 3 locked to specific outcomes) and artifact:
    The Seal of the Incomparable.

- **Al-Qadim consequence system** — Three new persistent cross-campaign effects:
  - `seal_bound` — Gold drain (30% of current gold) fires after 3–5 campaigns.
  - `convergence_marked` — 20% chance per campaign stage that a rogue elemental spawns
    before the normal enemy. Elemental spawn uses its own lightweight combat loop.
  - `genie_debt` — Genie noble demands payment after 2–3 campaigns: 25% of gold, or
    20% of max HP if the player cannot afford it.

- **Elemental spawn system** — New `runElementalSpawn()` function and
  `ELEMENTAL_SPAWN_POOL` in `named_campaigns.ts`. Four elemental types: Fire, Earth,
  Air, Water. Fires mid-campaign before the stage enemy when `convergence_marked` is
  active on any living participant. Only one spawn per stage even with multiple marked
  players.

### Changed v1.4.4

- **`mystara_campaign.ts` renamed to `named_campaigns.ts`** — The file now serves as
  the single handler for all named campaigns. All future campaigns are seeded via
  migration SQL only; no new TypeScript files are needed per campaign.
- **`router.ts`** — Import updated to reflect the rename.
- **`checkConsequences()`** — Extended with `seal_bound` and `genie_debt` session-start
  triggers alongside existing Mystara consequence checks.
- **`writeConsequences()`** — Extended with `seal_bound`, `convergence_marked`, and
  `genie_debt` cases in the switch block.
- **`runNamedCampaign()`** — Convergence spawn check added to the stage loop before
  each `runNamedStage()` call.
- **Unlock requirement for all named campaigns updated to 10 standard clears.**

### Database v1.4.4

- Extended `player_consequence_flags.flag_type` constraint: added `seal_bound`,
  `convergence_marked`, `genie_debt`
- New columns on `player_consequence_flags`: `seal_campaign_counter`, `seal_trigger_at`,
  `seal_triggered`, `debt_campaign_counter`, `debt_trigger_at`, `debt_triggered`
- Seeded `named_campaigns`, `named_campaign_stages`, `named_campaign_outcomes`,
  `named_campaign_titles`, `named_campaign_artifacts` for slug `alqadim`
- Updated `active_player_consequences` view — extended `trigger_ready` to cover
  `seal_bound` and `genie_debt`
- Updated `increment_campaign_counters` RPC — now increments `seal_campaign_counter`
  and `debt_campaign_counter` alongside existing Mystara counters

### Files v1.4.4

- `src/commands/named_campaigns.ts` (renamed from `mystara_campaign.ts`)
- `src/router.ts` — import path updated

## v1.4.3 — April 15, 2026

### Brother Yvannis & Mystara Named Campaign

#### Added v.1.4.3

- **Brother Yvannis** — Cleric NPC who appears once per campaign at a random stage (1–4) alongside the rest shrine.
  - Offers five services: Cure Disease, Cure Blindness, Cure Paralysis, Heal, and Wish.
  - Costs are percentage-based on the player's current gold (10%–40%).
  - Checks player condition before charging — will not perform a service that does nothing.
  - Each player may interact with him once per appearance.
  - 90-second interaction window. Yvannis departs when the window closes.
  - Appearance stage is rolled randomly (1–4) at campaign creation and stored in the `campaigns` table.

- **`!campaign mystara`** — First named campaign: *The Crystal of Rafiel* (Mystara/Hollow World setting).
  - Requires one standard campaign clear to unlock. Higher difficulty than the standard gauntlet (+25% base enemy HP and damage, further modified by channel consequence flags).
  - Five unique stages with named enemies, special abilities, and per-stage flavor text drawn from Mystara lore.
  - Ending vote fires after the boss is defeated. Participants vote on one of four outcomes. Tiebreaker opens to all of chat. Random fallback if still tied.
  - Four outcomes with distinct mechanical consequences: Stabilize, Destroy, Take Control, Let It Spread.
  - Consequences persist across future campaigns and are stored per-player and per-channel in Supabase.
  - Unique title pool (8 titles, some locked to specific outcomes) and artifact: Crystal of Rafiel.

- **Named campaign system** — Infrastructure supporting all future named campaigns.
  - Tables: `named_campaigns`, `named_campaign_stages`, `named_campaign_outcomes`, `named_campaign_titles`, `named_campaign_artifacts`.
  - Unlock gating via `player_campaign_clears` — tracks standard and named clears per player per slug.
  - Difficulty modifier stored per campaign, applied to all enemy stats at runtime.
  - Channel-wide difficulty flag (`spread_difficulty_active`) stacks with per-campaign modifiers.

- **Consequence system** — Persistent cross-campaign effects stored in Supabase.
  - `player_consequence_flags` — per-player flags for `corruption_stabilized`, `crystal_control`, `shadow_marked`, `disease`, `blindness`, `paralysis`.
  - `channel_consequence_flags` — channel-wide difficulty bumps.
  - `madness_outcomes` table — six seeded madness events for the Take Control consequence.
  - Consequence checks fire at session start on any command via `checkConsequences()` in `router.ts`.
  - Assassin death and madness trigger are checked against per-player campaign counters incremented by RPCs.

### Database v.1.4.3

- New column: `campaigns.yvannis_stage` (INT, 1–4) — stage at which Yvannis appears
- Extended `player_consequence_flags.flag_type` constraint to include `disease`, `blindness`, `paralysis`
- New RPCs: `increment_campaign_counters`, `increment_named_clears`, `increment_standard_clears`
- Updated view: `active_player_consequences` — includes `trigger_ready` computed boolean

### Files v1.4.3

- `src/commands/cleric.ts` — Brother Yvannis NPC handler
- `src/commands/mystara_campaign.ts` — Named campaign handler (Mystara)
- `src/router.ts` — `!cleric`, `!campaigns`, named campaign routing, consequence check
- `src/commands/campaign.ts` — Added `yvannis_stage` to campaign insert and stage loop

## v1.4.2 — April 14, 2026

### !campaign — New multi-stage campaign system. One campaign per channel per day

- Solo or party mode. Party mode opens a 60-second join window via `!joincamp`.
- Five stages of escalating difficulty: *Skirmish → Ambush → Patrol → Elite Guard → Minor Boss.*
- Rest shrine fires before each stage after the first, restoring 20 HP to all living players.
- HP carries over between stages. No full heal between fights.
- Permadeath applies per player. Dead players are out; surviving party members continue.
- If all players die, the campaign ends in defeat and the daily cooldown is consumed.
- Boss drawn randomly from a pool of 18 named villains rooted in D&D/Forgotten Realms lore.
- Stage 3 enemy uses a named special ability. Stage 4 elite uses a power move drawn from a rotating pool.
- Boss fires a named special attack at round 2 hitting all living party members.
- Full clear awards scaling XP and gold, a unique title (drawn from a pool of 10), and one minor artifact drop to a random survivor (drawn from a pool of 12).
- Dead players earn XP and gold only for stages they survived.

### Database v.1.4.2

**New tables:** campaigns, campaign_participants, campaign_stage_log, campaign_rewards
**New seed tables:** campaign_boss_pool (18 entries), campaign_artifact_pool (12 entries), campaign_title_pool (10 entries)
**New view:** campaign_today — used to enforce the channel-wide daily cooldown

### Files v1.4.2

- `src/commands/campaign.ts` — full campaign handler
- `router.ts` — `!campaign` and `!joincamp` wired outside normal command map

## v1.4.0 — April 13, 2026

### Bug Fixes v1.4.0

#### Permadeath + Flee race condition

Fixed an issue where a player who died in combat could still trigger the `!flee` command. The flee handler now checks the database to confirm the character exists before proceeding, and cleans up any stale fight state.

#### Tavern Brawl fizzle reset

Fixed an issue where `!brawl` could not be started again after a brawl fizzled out due to insufficient participants. `tavernVisitors` is now cleared on brawl cancel and brawl end, and the triggering player is now added via `addParticipant` instead of a direct array push.

#### Weekly reward double-write

Fixed a race condition in `!weekly` where two separate database writes were made, leaving the character in an inconsistent state if the bot restarted between them. Now uses a single atomic update. Also fixed the level-up message not appearing in the weekly reward chat response.

#### Party raid XP missing level recalc

Fixed an issue where defeating a raid boss granted XP to party members but never recalculated or updated their level, causing level/XP desync. Party members now correctly level up after a successful raid.

#### Duplicate item stat negation

Two equipped items with the same name no longer stack stat bonuses. Only the first equipped instance counts toward stats. Players are warned in chat when equipping a duplicate item that the second copy provides no bonus.

### Improvements

#### Equip command

Players can no longer equip an item that is already equipped, preventing the same item from occupying two slots.

#### Code Quality

Removed unused `tmi` import from `flee.ts`
Removed unused `formatClass` import from `party.ts`
Removed unused `getPartyById` import from `party.ts`
Replaced dynamic `await import()` calls in `party.ts` with static top-level imports for `calculateLevel` and `CLASS_HP_DIE`

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

### Bug Fixes v1.0.1

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
