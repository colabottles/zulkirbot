import { Monster } from '../types'

export const MONSTERS: Record<number, Monster[]> = {
  // Levels 1-5: Easy
  1: [
    { name: 'Giant Rat', hp: 3, attack: 1, defense: 1, xp_reward: 10, gold_reward: 1, loot_chance: 5 },
    { name: 'Kobold', hp: 4, attack: 1, defense: 1, xp_reward: 15, gold_reward: 2, loot_chance: 8 },
    { name: 'Goblin', hp: 4, attack: 2, defense: 1, xp_reward: 20, gold_reward: 3, loot_chance: 10 },
    { name: 'Giant Spider', hp: 3, attack: 2, defense: 1, xp_reward: 15, gold_reward: 1, loot_chance: 8 },
    { name: 'Skeleton', hp: 4, attack: 1, defense: 2, xp_reward: 20, gold_reward: 2, loot_chance: 10 },
    { name: 'Stirge', hp: 2, attack: 2, defense: 1, xp_reward: 10, gold_reward: 1, loot_chance: 5 },
    { name: 'Mud Mephit', hp: 4, attack: 1, defense: 1, xp_reward: 15, gold_reward: 2, loot_chance: 8 },
    { name: 'Giant Centipede', hp: 3, attack: 2, defense: 1, xp_reward: 10, gold_reward: 1, loot_chance: 5 },
    { name: 'Twig Blight', hp: 4, attack: 1, defense: 1, xp_reward: 15, gold_reward: 1, loot_chance: 6 },
    { name: 'Zombie', hp: 5, attack: 2, defense: 1, xp_reward: 20, gold_reward: 2, loot_chance: 8 },
  ],
  // Levels 6-10: Medium
  2: [
    { name: 'Orc', hp: 10, attack: 3, defense: 2, xp_reward: 40, gold_reward: 5, loot_chance: 12 },
    { name: 'Gnoll', hp: 9, attack: 3, defense: 2, xp_reward: 40, gold_reward: 4, loot_chance: 10 },
    { name: 'Shadow', hp: 8, attack: 3, defense: 2, xp_reward: 45, gold_reward: 3, loot_chance: 15 },
    { name: 'Hobgoblin', hp: 11, attack: 3, defense: 2, xp_reward: 40, gold_reward: 5, loot_chance: 10 },
    { name: 'Ghoul', hp: 10, attack: 3, defense: 2, xp_reward: 45, gold_reward: 4, loot_chance: 12 },
    { name: 'Bugbear', hp: 12, attack: 3, defense: 2, xp_reward: 50, gold_reward: 6, loot_chance: 12 },
    { name: 'Lizardfolk', hp: 9, attack: 3, defense: 3, xp_reward: 40, gold_reward: 4, loot_chance: 10 },
    { name: 'Specter', hp: 8, attack: 4, defense: 2, xp_reward: 50, gold_reward: 3, loot_chance: 15 },
    { name: 'Duergar', hp: 11, attack: 3, defense: 3, xp_reward: 45, gold_reward: 6, loot_chance: 12 },
    { name: 'Yuan-ti Pureblood', hp: 10, attack: 3, defense: 2, xp_reward: 50, gold_reward: 5, loot_chance: 14 },
  ],
  // Levels 11-20: Hard
  3: [
    { name: 'Ogre', hp: 20, attack: 5, defense: 3, xp_reward: 80, gold_reward: 10, loot_chance: 15 },
    { name: 'Worg', hp: 18, attack: 5, defense: 3, xp_reward: 75, gold_reward: 6, loot_chance: 10 },
    { name: 'Werewolf', hp: 22, attack: 6, defense: 3, xp_reward: 90, gold_reward: 12, loot_chance: 18 },
    { name: 'Basilisk', hp: 20, attack: 5, defense: 4, xp_reward: 85, gold_reward: 10, loot_chance: 15 },
    { name: 'Hell Hound', hp: 18, attack: 6, defense: 3, xp_reward: 90, gold_reward: 8, loot_chance: 15 },
    { name: 'Green Hag', hp: 22, attack: 5, defense: 3, xp_reward: 100, gold_reward: 14, loot_chance: 18 },
    { name: 'Intellect Devourer', hp: 16, attack: 6, defense: 4, xp_reward: 95, gold_reward: 10, loot_chance: 20 },
    { name: 'Merrow', hp: 20, attack: 5, defense: 3, xp_reward: 80, gold_reward: 8, loot_chance: 12 },
    { name: 'Oni', hp: 24, attack: 6, defense: 4, xp_reward: 110, gold_reward: 15, loot_chance: 20 },
    { name: 'Vampire Spawn', hp: 20, attack: 6, defense: 4, xp_reward: 100, gold_reward: 12, loot_chance: 18 },
  ],
  // Levels 21-30: Difficult
  4: [
    { name: 'Stone Giant', hp: 35, attack: 7, defense: 5, xp_reward: 150, gold_reward: 20, loot_chance: 18 },
    { name: 'Banshee', hp: 28, attack: 8, defense: 4, xp_reward: 160, gold_reward: 12, loot_chance: 22 },
    { name: 'Minotaur', hp: 32, attack: 8, defense: 4, xp_reward: 155, gold_reward: 18, loot_chance: 18 },
    { name: 'Medusa', hp: 30, attack: 8, defense: 5, xp_reward: 170, gold_reward: 22, loot_chance: 22 },
    { name: 'Mind Flayer', hp: 28, attack: 9, defense: 5, xp_reward: 180, gold_reward: 25, loot_chance: 25 },
    { name: 'Night Hag', hp: 30, attack: 8, defense: 5, xp_reward: 175, gold_reward: 20, loot_chance: 22 },
    { name: 'Rakshasa', hp: 32, attack: 9, defense: 5, xp_reward: 185, gold_reward: 28, loot_chance: 25 },
    { name: 'Revenant', hp: 35, attack: 8, defense: 5, xp_reward: 165, gold_reward: 15, loot_chance: 18 },
    { name: 'Young Red Dragon', hp: 40, attack: 9, defense: 6, xp_reward: 200, gold_reward: 35, loot_chance: 28 },
    { name: 'Beholder', hp: 38, attack: 10, defense: 6, xp_reward: 210, gold_reward: 30, loot_chance: 28 },
  ],
  // Levels 31-40: Highly Difficult
  5: [
    { name: 'Troll', hp: 42, attack: 10, defense: 5, xp_reward: 230, gold_reward: 25, loot_chance: 20 },
    { name: 'Vampire', hp: 45, attack: 11, defense: 7, xp_reward: 260, gold_reward: 40, loot_chance: 28 },
    { name: 'Nightmare', hp: 40, attack: 11, defense: 5, xp_reward: 240, gold_reward: 20, loot_chance: 20 },
    { name: 'Wyvern', hp: 45, attack: 11, defense: 6, xp_reward: 260, gold_reward: 28, loot_chance: 22 },
    { name: 'Adult Red Dragon', hp: 60, attack: 13, defense: 8, xp_reward: 350, gold_reward: 60, loot_chance: 35 },
    { name: 'Lich', hp: 55, attack: 13, defense: 8, xp_reward: 340, gold_reward: 55, loot_chance: 35 },
    { name: 'Death Knight', hp: 52, attack: 12, defense: 8, xp_reward: 320, gold_reward: 50, loot_chance: 30 },
    { name: 'Pit Fiend', hp: 58, attack: 13, defense: 8, xp_reward: 345, gold_reward: 55, loot_chance: 32 },
    { name: 'Ancient Red Dragon', hp: 75, attack: 15, defense: 10, xp_reward: 500, gold_reward: 100, loot_chance: 40 },
    { name: 'Tarrasque', hp: 100, attack: 16, defense: 12, xp_reward: 750, gold_reward: 150, loot_chance: 50 },
  ],
}

export function getMonsterForLevel(level: number): Monster {
  let tier: number
  if (level <= 5) tier = 1
  else if (level <= 10) tier = 2
  else if (level <= 20) tier = 3
  else if (level <= 30) tier = 4
  else tier = 5

  const pool = MONSTERS[tier]
  return { ...pool[Math.floor(Math.random() * pool.length)] }
}