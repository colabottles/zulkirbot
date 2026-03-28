import { Monster } from '../types'

export interface Boss extends Monster {
  title: string
  origin: string
  deathMessage: string
}

export const BOSSES: Boss[] = [
  // Forgotten Realms
  {
    name: 'Strahd von Zarovich 🧛',
    title: 'The Devil of Barovia',
    origin: 'Ravenloft',
    hp: 120, attack: 14, defense: 10,
    xp_reward: 1500, gold_reward: 200, loot_chance: 40,
    deathMessage: 'was drained of life by Strahd von Zarovich 🧛, the Devil of Barovia'
  },
  {
    name: 'Acererak 💀',
    title: 'The Devourer',
    origin: 'Greyhawk',
    hp: 150, attack: 16, defense: 12,
    xp_reward: 2000, gold_reward: 250, loot_chance: 45,
    deathMessage: 'had their soul devoured by Acererak 💀, the Devourer'
  },
  {
    name: 'Demogorgon 👹',
    title: 'Prince of Demons',
    origin: 'Planescape',
    hp: 180, attack: 17, defense: 13,
    xp_reward: 2500, gold_reward: 300, loot_chance: 50,
    deathMessage: 'was torn apart by Demogorgon 👹, Prince of Demons'
  },
  {
    name: 'Orcus 💀',
    title: 'Demon Prince of Undead',
    origin: 'Planescape',
    hp: 175, attack: 16, defense: 13,
    xp_reward: 2400, gold_reward: 280, loot_chance: 48,
    deathMessage: 'was slain and raised as undead by Orcus 💀, Demon Prince of the Undead'
  },
  {
    name: 'Vecna 🧙',
    title: 'The Undying King',
    origin: 'Greyhawk',
    hp: 160, attack: 17, defense: 14,
    xp_reward: 2200, gold_reward: 270, loot_chance: 45,
    deathMessage: 'had their secrets stolen by Vecna 🧙, the Undying King'
  },
  {
    name: 'Tiamat 🐉',
    title: 'Queen of Evil Dragons',
    origin: 'Forgotten Realms',
    hp: 200, attack: 18, defense: 15,
    xp_reward: 3000, gold_reward: 400, loot_chance: 55,
    deathMessage: 'was incinerated by Tiamat 🐉, Queen of Evil Dragons'
  },
  {
    name: 'Bane 👁️',
    title: 'The Black Hand',
    origin: 'Forgotten Realms',
    hp: 155, attack: 15, defense: 12,
    xp_reward: 2000, gold_reward: 260, loot_chance: 44,
    deathMessage: 'was crushed under the Black Hand of Bane 👁️'
  },
  {
    name: 'Bhaal 💀',
    title: 'Lord of Murder',
    origin: 'Forgotten Realms',
    hp: 160, attack: 16, defense: 12,
    xp_reward: 2100, gold_reward: 270, loot_chance: 45,
    deathMessage: 'was sacrificed to Bhaal 💀, Lord of Murder'
  },
  {
    name: 'Myrkul 💀',
    title: 'Lord of Bones',
    origin: 'Forgotten Realms',
    hp: 155, attack: 15, defense: 13,
    xp_reward: 2000, gold_reward: 255, loot_chance: 44,
    deathMessage: 'was claimed by Myrkul 💀, Lord of Bones'
  },
  {
    name: 'Lolth 🕷️',
    title: 'Queen of Spiders',
    origin: 'Forgotten Realms',
    hp: 165, attack: 16, defense: 13,
    xp_reward: 2200, gold_reward: 275, loot_chance: 46,
    deathMessage: 'was wrapped in webs and consumed by Lolth 🕷️, Queen of Spiders'
  },
  {
    name: 'Zariel 😈',
    title: 'Archduchess of Avernus',
    origin: 'Planescape',
    hp: 170, attack: 17, defense: 13,
    xp_reward: 2300, gold_reward: 285, loot_chance: 47,
    deathMessage: 'was cast into the fires of Avernus by Zariel 😈'
  },
  {
    name: 'Asmodeus 😈',
    title: 'Lord of the Nine Hells',
    origin: 'Planescape',
    hp: 190, attack: 18, defense: 15,
    xp_reward: 2800, gold_reward: 350, loot_chance: 52,
    deathMessage: 'was bound in hellfire by Asmodeus 😈, Lord of the Nine Hells'
  },
  {
    name: 'Tharizdun 🌀',
    title: 'The Chained God',
    origin: 'Greyhawk',
    hp: 185, attack: 17, defense: 14,
    xp_reward: 2600, gold_reward: 320, loot_chance: 50,
    deathMessage: 'was consumed by the void of Tharizdun 🌀, the Chained God'
  },
  {
    name: 'Iuz 👹',
    title: 'The Old One',
    origin: 'Greyhawk',
    hp: 150, attack: 15, defense: 12,
    xp_reward: 1900, gold_reward: 240, loot_chance: 43,
    deathMessage: 'was destroyed by Iuz 👹, the Old One'
  },
  {
    name: 'Kas the Bloody-Handed ⚔️',
    title: 'Vampire Lord',
    origin: 'Greyhawk',
    hp: 140, attack: 15, defense: 11,
    xp_reward: 1800, gold_reward: 230, loot_chance: 42,
    deathMessage: 'was cut down by Kas the Bloody-Handed ⚔️, Vampire Lord'
  },
  {
    name: 'Vlaakith 💀',
    title: 'Lich-Queen of the Githyanki',
    origin: 'Planescape',
    hp: 155, attack: 16, defense: 13,
    xp_reward: 2000, gold_reward: 255, loot_chance: 44,
    deathMessage: 'had their essence consumed by Vlaakith 💀, Lich-Queen of the Githyanki'
  },
  {
    name: 'The Lady of Pain 🌀',
    title: 'Ruler of Sigil',
    origin: 'Planescape',
    hp: 999, attack: 20, defense: 20,
    xp_reward: 5000, gold_reward: 1000, loot_chance: 60,
    deathMessage: 'was mazed by The Lady of Pain 🌀, Ruler of Sigil — some say they are still wandering'
  },
  {
    name: 'Atropus 💀',
    title: 'The World Born Dead',
    origin: 'Forgotten Realms',
    hp: 195, attack: 18, defense: 15,
    xp_reward: 2900, gold_reward: 380, loot_chance: 53,
    deathMessage: 'was unmade by Atropus 💀, the World Born Dead'
  },
  {
    name: 'Shar 🌑',
    title: 'Mistress of the Night',
    origin: 'Forgotten Realms',
    hp: 170, attack: 17, defense: 14,
    xp_reward: 2300, gold_reward: 290, loot_chance: 47,
    deathMessage: 'was swallowed by the eternal darkness of Shar 🌑, Mistress of the Night'
  },
  {
    name: 'Szass Tam 🧙',
    title: 'Zulkir of Necromancy',
    origin: 'Forgotten Realms',
    hp: 165, attack: 16, defense: 13,
    xp_reward: 2200, gold_reward: 275, loot_chance: 46,
    deathMessage: 'was raised as an undead thrall by Szass Tam 🧙, Zulkir of Necromancy'
  },
  {
    name: 'Kalid-Ma 🔥',
    title: 'The Undying Sorcerer-King',
    origin: 'Dark Sun',
    hp: 160, attack: 16, defense: 13,
    xp_reward: 2100, gold_reward: 265, loot_chance: 45,
    deathMessage: 'had their life force drained by Kalid-Ma 🔥, the Undying Sorcerer-King of Dark Sun'
  },
  {
    name: 'Borys of Ebe 🐉',
    title: 'The Dragon of Athas',
    origin: 'Dark Sun',
    hp: 190, attack: 18, defense: 15,
    xp_reward: 2800, gold_reward: 360, loot_chance: 52,
    deathMessage: 'was consumed by the Dragon of Athas, Borys of Ebe 🐉'
  },
  {
    name: 'Yami 👹',
    title: 'Lord of the Dead',
    origin: 'Kara-Tur',
    hp: 155, attack: 15, defense: 12,
    xp_reward: 1950, gold_reward: 245, loot_chance: 43,
    deathMessage: 'was dragged to the underworld by Yami 👹, Lord of the Dead of Kara-Tur'
  },
  {
    name: 'Oyai 🌊',
    title: 'The Storm Dragon',
    origin: 'Kara-Tur',
    hp: 165, attack: 16, defense: 13,
    xp_reward: 2100, gold_reward: 265, loot_chance: 45,
    deathMessage: 'was drowned in the tempest of Oyai 🌊, the Storm Dragon of Kara-Tur'
  },
  {
    name: 'Juiblex 🟢',
    title: 'The Faceless Lord',
    origin: 'Planescape',
    hp: 155, attack: 15, defense: 11,
    xp_reward: 1900, gold_reward: 240, loot_chance: 43,
    deathMessage: 'was dissolved by Juiblex 🟢, the Faceless Lord'
  },
  {
    name: 'Yeenoghu 👹',
    title: 'Beast of Butchery',
    origin: 'Planescape',
    hp: 160, attack: 16, defense: 12,
    xp_reward: 2050, gold_reward: 255, loot_chance: 44,
    deathMessage: 'was butchered by Yeenoghu 👹, Beast of Butchery'
  },
]

export function getBossById(name: string): Boss | null {
  return BOSSES.find(
    b => b.name.toLowerCase().includes(name.toLowerCase())
  ) ?? null
}