# ZulkirBot Release Notes

---

## v1.4.3 — April 15, 2026

### Brother Yvannis & Mystara Named Campaign

#### Added

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

### Database

- New column: `campaigns.yvannis_stage` (INT, 1–4) — stage at which Yvannis appears
- Extended `player_consequence_flags.flag_type` constraint to include `disease`, `blindness`, `paralysis`
- New RPCs: `increment_campaign_counters`, `increment_named_clears`, `increment_standard_clears`
- Updated view: `active_player_consequences` — includes `trigger_ready` computed boolean

### Files

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
Replaced dynamic `await import()` calls in `party.ts` with static top-level imports for `calculateLevel` and `CLASS_HP`

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
