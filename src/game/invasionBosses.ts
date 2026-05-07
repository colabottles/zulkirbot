export interface InvasionBoss {
  id: string
  name: string
  title: string
  tier: 1 | 2 | 3
  base_hp: number
  hp_per_player: number
  announce_text: string
  victory_text: string
  defeat_text: string
  gold_reward: number
  xp_reward: number
  title_reward: string
  legendary_drop_chance: number
}

export const INVASION_BOSSES: InvasionBoss[] = [
  // ── Tier 1: Legendary ────────────────────────────────────────
  {
    id: 'acererak',
    name: 'Acererak',
    title: 'the Devourer of Souls',
    tier: 1,
    base_hp: 400,
    hp_per_player: 30,
    announce_text: '💀 The tomb stirs. ACERERAK, the Devourer of Souls, rises from the depths of the Tomb of Horrors! All adventurers — type !joinevent to stand against him! You have 10 minutes!',
    victory_text: '🏆 Acererak crumbles to ash! The tomb is silent once more. The realm is saved — for now.',
    defeat_text: '☠️ Acererak laughs as the last hero falls. Your souls now feed his phylactery. Better luck next time, adventurers.',
    gold_reward: 800,
    xp_reward: 2500,
    title_reward: 'Tomb Breaker',
    legendary_drop_chance: 0.08,
  },
  {
    id: 'vecna',
    name: 'Vecna',
    title: 'the Undying King',
    tier: 1,
    base_hp: 420,
    hp_per_player: 30,
    announce_text: '👁️ A hand. An eye. A whisper from beyond death. VECNA, the Undying King, walks the mortal realm once more! Type !joinevent to oppose him! You have 10 minutes!',
    victory_text: '🏆 Vecna\'s form disperses into shadow! His secrets die with him — this time. The realm breathes again.',
    defeat_text: '☠️ Vecna\'s eye sweeps the battlefield. He knows all your secrets now. The realm falls under his shadow.',
    gold_reward: 850,
    xp_reward: 2600,
    title_reward: 'Keeper of No Secrets',
    legendary_drop_chance: 0.08,
  },
  {
    id: 'larloch',
    name: 'Larloch',
    title: 'the Shadow King',
    tier: 1,
    base_hp: 380,
    hp_per_player: 28,
    announce_text: '🌑 The oldest darkness stirs. LARLOCH, the Shadow King — ancient Netherese lich and master of Warlock\'s Crypt — descends upon the realm! Type !joinevent to face him! You have 10 minutes!',
    victory_text: '🏆 Larloch retreats into the shadow plane, wounded and furious. The realm endures another age.',
    defeat_text: '☠️ Larloch has outlived empires. He will outlive you too. Darkness falls.',
    gold_reward: 750,
    xp_reward: 2400,
    title_reward: 'Shadow Breaker',
    legendary_drop_chance: 0.07,
  },

  // ── Tier 2: Demigod ──────────────────────────────────────────
  {
    id: 'orcus',
    name: 'Orcus',
    title: 'Prince of Undeath',
    tier: 2,
    base_hp: 600,
    hp_per_player: 40,
    announce_text: '💀 THE DEAD WALK. ORCUS, Prince of Undeath, descends upon the realm! His wand splits the sky. Type !joinevent to join the battle! You have 10 minutes!',
    victory_text: '🏆 Orcus is banished back to the Abyss! The undead crumble to dust. The realm lives — for now.',
    defeat_text: '☠️ The wand of Orcus rises over a field of corpses. All who fell now serve the Prince of Undeath.',
    gold_reward: 1200,
    xp_reward: 4000,
    title_reward: 'Undeath\'s Bane',
    legendary_drop_chance: 0.12,
  },
  {
    id: 'demogorgon',
    name: 'Demogorgon',
    title: 'Prince of Demons',
    tier: 2,
    base_hp: 650,
    hp_per_player: 42,
    announce_text: '🐙 TWO HEADS HOWL AS ONE. DEMOGORGON, the Prince of Demons, tears through the planar barrier! His gaze drives mortals mad! Type !joinevent to fight! You have 10 minutes!',
    victory_text: '🏆 Demogorgon roars and retreats into the Abyss, both heads screaming in defeat. The barrier seals behind him.',
    defeat_text: '☠️ Aameul laughs. Hethradiah devours. The realm has gone mad.',
    gold_reward: 1300,
    xp_reward: 4200,
    title_reward: 'Sanity\'s Defender',
    legendary_drop_chance: 0.12,
  },
  {
    id: 'tiamat',
    name: 'Tiamat',
    title: 'Queen of Evil Dragons',
    tier: 2,
    base_hp: 700,
    hp_per_player: 45,
    announce_text: '🐉 FIVE HEADS. ONE RAGE. TIAMAT, Queen of Evil Dragons, descends from Avernus! The sky burns with her breath! Type !joinevent to stand against her! You have 10 minutes!',
    victory_text: '🏆 Tiamat shrieks and is dragged back to Avernus in chains of divine light. The realm is scorched but standing!',
    defeat_text: '☠️ Five breaths. Five colors. Five ways to die. The realm is ash.',
    gold_reward: 1400,
    xp_reward: 4500,
    title_reward: 'Dragonsbane',
    legendary_drop_chance: 0.13,
  },
  {
    id: 'yeenoghu',
    name: 'Yeenoghu',
    title: 'Beast of Butchery',
    tier: 2,
    base_hp: 580,
    hp_per_player: 38,
    announce_text: '🦴 Hunger made flesh. YEENOGHU, the Beast of Butchery, stalks the land — and nothing survives his passing! Type !joinevent to face him! You have 10 minutes!',
    victory_text: '🏆 Yeenoghu howls in fury and dissolves back into the Abyss. The gnoll hordes scatter without their master.',
    defeat_text: '☠️ Yeenoghu feasts. The gnolls feast. There is nothing left.',
    gold_reward: 1150,
    xp_reward: 3800,
    title_reward: 'Famine\'s End',
    legendary_drop_chance: 0.11,
  },

  // ── Tier 3: True God ─────────────────────────────────────────
  {
    id: 'asmodeus',
    name: 'Asmodeus',
    title: 'Lord of the Nine Hells',
    tier: 3,
    base_hp: 1000,
    hp_per_player: 60,
    announce_text: '🔥 Hell opens. ASMODEUS, Lord of the Nine Hells, walks the mortal realm in his true form. No contract will save you now. Type !joinevent — if you dare. You have 10 minutes!',
    victory_text: '🏆 Asmodeus smiles even in defeat. "Impressive," he says, and steps back into the Nine Hells. This changes nothing — but today, the realm stands.',
    defeat_text: '☠️ Asmodeus adjusts his cuffs. Another soul signed. Another realm added to his ledger.',
    gold_reward: 2500,
    xp_reward: 8000,
    title_reward: 'Hell\'s Defiant',
    legendary_drop_chance: 0.20,
  },
  {
    id: 'tharizdun',
    name: 'Tharizdun',
    title: 'the Chained God',
    tier: 3,
    base_hp: 1100,
    hp_per_player: 65,
    announce_text: '🌀 THE CHAINS BREAK. THARIZDUN, the Chained God — destroyer of universes, the Elder Evil — is FREE. Every god screams. Every plane trembles. Type !joinevent. You are all that stands between existence and oblivion. You have 10 minutes!',
    victory_text: '🏆 The chains reform. Tharizdun is bound once more — but the cracks remain. The multiverse survives... this time.',
    defeat_text: '☠️ The void takes everything. There is no realm left to save.',
    gold_reward: 3000,
    xp_reward: 10000,
    title_reward: 'Void Walker',
    legendary_drop_chance: 0.25,
  },
  {
    id: 'bane',
    name: 'Bane',
    title: 'the Black Hand',
    tier: 3,
    base_hp: 900,
    hp_per_player: 55,
    announce_text: '✊ KNEEL OR DIE. BANE, God of Tyranny, has descended to claim the realm as his own! His black gauntlet reaches across the sky! Type !joinevent to resist! You have 10 minutes!',
    victory_text: '🏆 Bane\'s gauntlet withdraws. "You have earned this reprieve," he growls. He will return. He always returns.',
    defeat_text: '☠️ The black hand closes over the realm. All bow. All serve. All fear.',
    gold_reward: 2200,
    xp_reward: 7000,
    title_reward: 'Tyrant\'s Nemesis',
    legendary_drop_chance: 0.18,
  },
  {
    id: 'shar',
    name: 'Shar',
    title: 'Mistress of the Night',
    tier: 3,
    base_hp: 950,
    hp_per_player: 58,
    announce_text: '🌑 The light dies. The memories fade. SHAR, Mistress of the Night and Goddess of Darkness, smothers the realm in eternal shadow! Type !joinevent before you forget why you fight. You have 10 minutes!',
    victory_text: '🏆 A sliver of light cuts through the dark. Shar retreats, whispering promises of oblivion. You remember — this time.',
    defeat_text: '☠️ Darkness. Loss. Silence. Shar takes everything — even the memory of what was lost.',
    gold_reward: 2300,
    xp_reward: 7500,
    title_reward: 'Light in the Dark',
    legendary_drop_chance: 0.19,
  },
]

export function getBossById(id: string): InvasionBoss | undefined {
  return INVASION_BOSSES.find(b => b.id === id.toLowerCase())
}