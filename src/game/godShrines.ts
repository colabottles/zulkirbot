export type GodAlignment = 'good' | 'evil'

export interface GodShrine {
  name: string
  alignment: GodAlignment
  domain: string
  boonMsg: (username: string) => string
  debuffMsg: (username: string) => string
  neutralMsg: (username: string) => string
}

// Good-aligned classes
export const GOOD_CLASSES = [
  'cleric', 'paladin', 'favored_soul', 'sacred_fist',
  'ranger', 'druid', 'bard', 'monk'
]

// Evil-aligned classes
export const EVIL_CLASSES = [
  'dark_apostate', 'blightcaster', 'acolyte_of_the_skin'
]

export const GOD_SHRINES: GodShrine[] = [
  {
    name: 'Mystra',
    alignment: 'good',
    domain: 'Magic',
    boonMsg: (u) => `✨ @${u} — Mystra's blessing settles over you. The Weave answers your call. +5 ATK until your next fight ends.`,
    debuffMsg: (u) => `✨ @${u} — Mystra's shrine hums with power but offers nothing to one of your... persuasion.`,
    neutralMsg: (u) => `✨ @${u} — Mystra's shrine pulses softly. The magic acknowledges you without judgment.`,
  },
  {
    name: 'Tempus',
    alignment: 'good',
    domain: 'War',
    boonMsg: (u) => `⚔️ @${u} — Tempus roars his approval. Battle fury fills your veins. +5 DMG until your next fight ends.`,
    debuffMsg: (u) => `⚔️ @${u} — Tempus finds you unworthy of his blessing today.`,
    neutralMsg: (u) => `⚔️ @${u} — Tempus's shrine smells of blood and steel. It watches you without comment.`,
  },
  {
    name: 'Tyr',
    alignment: 'good',
    domain: 'Justice',
    boonMsg: (u) => `⚖️ @${u} — Tyr's scales tip in your favor. Justice protects the righteous. +5 DEF until your next fight ends.`,
    debuffMsg: (u) => `⚖️ @${u} — Tyr's scales do not tip for those who walk your path.`,
    neutralMsg: (u) => `⚖️ @${u} — Tyr's shrine stands impassive. Justice is blind. So is the shrine, apparently.`,
  },
  {
    name: 'Lathander',
    alignment: 'good',
    domain: 'Dawn',
    boonMsg: (u) => `🌅 @${u} — Lathander's light washes over you. New beginnings bring strength. +5 ATK until your next fight ends.`,
    debuffMsg: (u) => `🌅 @${u} — Lathander's light finds nothing worth blessing in you today.`,
    neutralMsg: (u) => `🌅 @${u} — Lathander's shrine glows warmly. It does not discriminate. It just doesn't help either.`,
  },
  {
    name: 'Selûne',
    alignment: 'good',
    domain: 'Moon',
    boonMsg: (u) => `🌙 @${u} — Selûne's silver light guides your hand. +5 DEF until your next fight ends.`,
    debuffMsg: (u) => `🌙 @${u} — Selûne's light dims as you approach. She has seen what you are.`,
    neutralMsg: (u) => `🌙 @${u} — Selûne's shrine glimmers quietly. The moon rises. The moon sets. Nothing changes.`,
  },
  {
    name: 'Oghma',
    alignment: 'good',
    domain: 'Knowledge',
    boonMsg: (u) => `📜 @${u} — Oghma grants you clarity. Knowledge sharpens every strike. +5 DMG until your next fight ends.`,
    debuffMsg: (u) => `📜 @${u} — Oghma's shrine contains much knowledge. None of it is for you.`,
    neutralMsg: (u) => `📜 @${u} — Oghma's shrine hums with accumulated wisdom. Most of it seems irrelevant to your current situation.`,
  },
  {
    name: 'Kelemvor',
    alignment: 'good',
    domain: 'Death',
    boonMsg: (u) => `💀 @${u} — Kelemvor steadies your hand. Death comes for all things. Not you. Not yet. +5 DEF until your next fight ends.`,
    debuffMsg: (u) => `💀 @${u} — Kelemvor notes your name. He seems to be making a list.`,
    neutralMsg: (u) => `💀 @${u} — Kelemvor's shrine is quiet. He is patient. He can wait.`,
  },
  {
    name: 'Shar',
    alignment: 'evil',
    domain: 'Darkness',
    boonMsg: (u) => `🌑 @${u} — Shar wraps you in shadow. Darkness empowers those who embrace it. +5 DMG until your next fight ends.`,
    debuffMsg: (u) => `🌑 @${u} — Shar's darkness reaches for you. It finds something it does not like. -5 DEF until your next fight ends.`,
    neutralMsg: (u) => `🌑 @${u} — Shar's shrine pulses with cold darkness. It acknowledges your presence and returns to ignoring you.`,
  },
  {
    name: 'Bane',
    alignment: 'evil',
    domain: 'Tyranny',
    boonMsg: (u) => `✊ @${u} — Bane's iron will flows through you. Domination begins with the first strike. +5 ATK until your next fight ends.`,
    debuffMsg: (u) => `✊ @${u} — Bane finds you insufficiently ruthless. A crushing weight settles on your shoulders. -5 ATK until your next fight ends.`,
    neutralMsg: (u) => `✊ @${u} — Bane's shrine radiates oppressive authority. It does not acknowledge you. This is probably fine.`,
  },
  {
    name: 'Gruumsh',
    alignment: 'evil',
    domain: 'Slaughter',
    boonMsg: (u) => `🩸 @${u} — Gruumsh roars in your blood. DESTROY. +5 DMG until your next fight ends.`,
    debuffMsg: (u) => `🩸 @${u} — Gruumsh finds you weak. His contempt is a physical force. -5 DMG until your next fight ends.`,
    neutralMsg: (u) => `🩸 @${u} — Gruumsh's shrine smells of old violence. It tolerates your presence. For now.`,
  },
]

export function pickShrine(): GodShrine {
  return GOD_SHRINES[Math.floor(Math.random() * GOD_SHRINES.length)]
}