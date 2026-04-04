import { supabase } from './supabase'

export interface TitleDefinition {
  title: string
  monster: string
  count: number
}

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  // Tier 1 monsters
  { title: 'Rat Catcher', monster: 'Giant Rat', count: 10 },
  { title: 'Exterminator', monster: 'Giant Rat', count: 50 },
  { title: 'Kobold Crusher', monster: 'Kobold', count: 10 },
  { title: 'Goblin Slayer', monster: 'Goblin', count: 10 },
  { title: 'Goblin King Killer', monster: 'Goblin', count: 50 },
  { title: 'Arachnid Hunter', monster: 'Giant Spider', count: 10 },
  { title: 'Bone Breaker', monster: 'Skeleton', count: 10 },
  { title: 'Undead Hunter', monster: 'Skeleton', count: 50 },
  { title: 'Stirge Swatter', monster: 'Stirge', count: 10 },
  { title: 'Mephit Masher', monster: 'Mud Mephit', count: 10 },
  { title: 'Centipede Stomper', monster: 'Giant Centipede', count: 10 },
  { title: 'Blight Burner', monster: 'Twig Blight', count: 10 },
  { title: 'Zombie Slayer', monster: 'Zombie', count: 10 },
  // Tier 2 monsters
  { title: 'Orc Breaker', monster: 'Orc', count: 10 },
  { title: 'Orc Warlord', monster: 'Orc', count: 50 },
  { title: 'Gnoll Hunter', monster: 'Gnoll', count: 10 },
  { title: 'Shadow Walker', monster: 'Shadow', count: 10 },
  { title: 'Hobgoblin Slayer', monster: 'Hobgoblin', count: 10 },
  { title: 'Ghoul Crusher', monster: 'Ghoul', count: 10 },
  { title: 'Bugbear Bane', monster: 'Bugbear', count: 10 },
  { title: 'Lizard Hunter', monster: 'Lizardfolk', count: 10 },
  { title: 'Specter Banisher', monster: 'Specter', count: 10 },
  { title: 'Duergar Destroyer', monster: 'Duergar', count: 10 },
  { title: 'Serpent Slayer', monster: 'Yuan-ti Pureblood', count: 10 },
  // Tier 3 monsters
  { title: 'Ogre Smasher', monster: 'Ogre', count: 10 },
  { title: 'Wolf Slayer', monster: 'Worg', count: 10 },
  { title: 'Werewolf Hunter', monster: 'Werewolf', count: 10 },
  { title: 'Basilisk Blinder', monster: 'Basilisk', count: 10 },
  { title: 'Hellhound Tamer', monster: 'Hell Hound', count: 10 },
  { title: 'Hag Slayer', monster: 'Green Hag', count: 10 },
  { title: 'Mind Breaker', monster: 'Intellect Devourer', count: 10 },
  { title: 'Sea Hunter', monster: 'Merrow', count: 10 },
  { title: 'Oni Vanquisher', monster: 'Oni', count: 10 },
  { title: 'Vampire Hunter', monster: 'Vampire Spawn', count: 10 },
  // Tier 4 monsters
  { title: 'Giant Feller', monster: 'Stone Giant', count: 10 },
  { title: 'Banshee Silencer', monster: 'Banshee', count: 10 },
  { title: 'Minotaur Slayer', monster: 'Minotaur', count: 10 },
  { title: 'Stone Turner', monster: 'Medusa', count: 10 },
  { title: 'Mind Flayer Slayer', monster: 'Mind Flayer', count: 10 },
  { title: 'Hag Breaker', monster: 'Night Hag', count: 10 },
  { title: 'Rakshasa Destroyer', monster: 'Rakshasa', count: 10 },
  { title: 'Revenant Ender', monster: 'Revenant', count: 10 },
  { title: 'Dragon Slayer', monster: 'Young Red Dragon', count: 5 },
  { title: 'Eye Gouger', monster: 'Beholder', count: 5 },
  // Tier 5 monsters
  { title: 'Troll Bane', monster: 'Troll', count: 10 },
  { title: 'Vampire Lord Slayer', monster: 'Vampire', count: 5 },
  { title: 'Nightmare Ender', monster: 'Nightmare', count: 5 },
  { title: 'Wyvern Rider', monster: 'Wyvern', count: 5 },
  { title: 'Dragon Lord', monster: 'Adult Red Dragon', count: 3 },
  { title: 'Lich Breaker', monster: 'Lich', count: 3 },
  { title: 'Death Knight Slayer', monster: 'Death Knight', count: 3 },
  { title: 'Pit Fiend Vanquisher', monster: 'Pit Fiend', count: 3 },
  { title: 'Ancient Dragon Slayer', monster: 'Ancient Red Dragon', count: 1 },
  { title: 'Tarrasque Tamer', monster: 'Tarrasque', count: 1 },
  // Boss kills
  { title: 'Devil Slayer', monster: 'Strahd von Zarovich 🧛', count: 1 },
  { title: 'Tomb Raider', monster: 'Acererak 💀', count: 1 },
  { title: 'Demon Prince Slayer', monster: 'Demogorgon 👹', count: 1 },
  { title: 'Undead Prince Slayer', monster: 'Orcus 💀', count: 1 },
  { title: 'Eye Thief', monster: 'Vecna 🧙', count: 1 },
  { title: 'Dragon Queen Slayer', monster: 'Tiamat 🐉', count: 1 },
  { title: 'Black Hand Breaker', monster: 'Bane 👁️', count: 1 },
  { title: 'Murder Ender', monster: 'Bhaal 💀', count: 1 },
  { title: 'Lord of Bones Slayer', monster: 'Myrkul 💀', count: 1 },
  { title: 'Spider Queen Slayer', monster: 'Lolth 🕷️', count: 1 },
  { title: 'Archduchess Slayer', monster: 'Zariel 😈', count: 1 },
  { title: 'Hell Lord Slayer', monster: 'Asmodeus 😈', count: 1 },
  { title: 'Chain Breaker', monster: 'Tharizdun 🌀', count: 1 },
  { title: 'Old One Slayer', monster: 'Iuz 👹', count: 1 },
  { title: 'Bloody Hand Breaker', monster: 'Kas the Bloody-Handed ⚔️', count: 1 },
  { title: 'Lich Queen Slayer', monster: 'Vlaakith 💀', count: 1 },
  { title: 'Maze Runner', monster: 'The Lady of Pain 🌀', count: 1 },
  { title: 'World Saver', monster: 'Atropus 💀', count: 1 },
  { title: 'Night Ender', monster: 'Shar 🌑', count: 1 },
  { title: 'Zulkir Slayer', monster: 'Szass Tam 🧙', count: 1 },
  { title: 'Athasian Hero', monster: 'Kalid-Ma 🔥', count: 1 },
  { title: 'Dragon of Athas Slayer', monster: 'Borys of Ebe 🐉', count: 1 },
  { title: 'Underworld Escapee', monster: 'Yami 👹', count: 1 },
  { title: 'Storm Rider', monster: 'Oyai 🌊', count: 1 },
  { title: 'Faceless Lord Slayer', monster: 'Juiblex 🟢', count: 1 },
  { title: 'Butcher Slayer', monster: 'Yeenoghu 👹', count: 1 },
]

export async function trackKill(
  characterId: string,
  username: string,
  monsterName: string,
  isBoss: boolean
): Promise<string[]> {
  const table = isBoss ? 'boss_kills' : 'kill_stats'

  const { data: existing } = await supabase
    .from(table)
    .select('*')
    .eq('character_id', characterId)
    .eq('monster_name', monsterName)
    .single()

  let newCount = 1

  if (existing) {
    newCount = existing.kill_count + 1
    await supabase
      .from(table)
      .update({
        kill_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from(table).insert({
      character_id: characterId,
      twitch_username: username,
      monster_name: monsterName,
      kill_count: 1,
    })
  }

  // Check for new titles
  const newTitles: string[] = []
  const eligible = TITLE_DEFINITIONS.filter(
    t => t.monster === monsterName && t.count === newCount
  )

  for (const titleDef of eligible) {
    const { data: existingTitle } = await supabase
      .from('titles')
      .select('id')
      .eq('character_id', characterId)
      .eq('title', titleDef.title)
      .single()

    if (!existingTitle) {
      await supabase.from('titles').insert({
        character_id: characterId,
        twitch_username: username,
        title: titleDef.title,
      })
      newTitles.push(titleDef.title)
    }
  }

  return newTitles
}