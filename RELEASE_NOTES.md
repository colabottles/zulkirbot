# ZulkirBot Release Notes

---

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

### Bug Fixes & Improvements

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

## v1.5.1 — April 19, 2026

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

### Changed

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
