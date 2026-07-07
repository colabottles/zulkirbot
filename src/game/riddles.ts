export interface Riddle {
  question: string
  answer: string
}

export const RIDDLES: Riddle[] = [
  { question: 'I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?', answer: 'map' },
  { question: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps' },
  { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'echo' },
  { question: 'I have hands but cannot clap. What am I?', answer: 'clock' },
  { question: 'The more you have of it, the less you see. What am I?', answer: 'darkness' },
  { question: 'I am always hungry and must always be fed. The finger I touch will soon turn red. What am I?', answer: 'fire' },
  { question: 'I have a head and a tail, but no body. What am I?', answer: 'coin' },
  { question: 'I can fly without wings. I can cry without eyes. Wherever I go, darkness follows me. What am I?', answer: 'cloud' },
  { question: 'What has roots as nobody sees, is taller than trees, up, up, up it goes, and yet never grows?', answer: 'mountain' },
  { question: 'Thirty white horses on a red hill. First they champ, then they stamp, then they stand still. What are they?', answer: 'teeth' },
  { question: 'Voiceless it cries, wingless it flutters, toothless it bites, mouthless it mutters. What am I?', answer: 'wind' },
  { question: 'It cannot be seen, cannot be felt, cannot be heard, cannot be smelt. It lies behind stars and under hills. What is it?', answer: 'dark' },
  { question: 'A box without hinges, key, or lid, yet golden treasure inside is hid. What am I?', answer: 'egg' },
  { question: 'Alive without breath, as cold as death, never thirsty, ever drinking. What am I?', answer: 'fish' },
  { question: 'This thing all things devours: birds, beasts, trees, flowers. Gnaws iron, bites steel, grinds hard stones to meal. What am I?', answer: 'time' },
  { question: 'I have no legs but I run. I have no mouth but I roar. What am I?', answer: 'river' },
  { question: 'What can run but never walks, has a mouth but never talks, has a head but never weeps, has a bed but never sleeps?', answer: 'river' },
  { question: 'I am not alive, but I grow. I do not have lungs, but I need air. I do not have a mouth, but water kills me. What am I?', answer: 'fire' },
  { question: 'What gets wetter the more it dries?', answer: 'towel' },
  { question: 'The man who made it does not need it. The man who bought it does not want it. The man who uses it does not know it. What is it?', answer: 'coffin' },
  { question: 'I have lakes with no water, mountains with no stone, and cities with no buildings. What am I?', answer: 'map' },
  { question: 'What can be broken but is never held?', answer: 'promise' },
  { question: 'What runs all around a field but never moves?', answer: 'fence' },
  { question: 'I am taken from a mine and shut up in a wooden case, from which I am never released, and yet I am used by almost every person. What am I?', answer: 'pencil' },
  { question: 'What has a neck but no head?', answer: 'bottle' },
  { question: 'What gets sharper the more you use it?', answer: 'brain' },
  { question: 'I have no wings but I fly. I have no feet but I run. What am I?', answer: 'time' },
  { question: 'What is so fragile that saying its name breaks it?', answer: 'silence' },
  { question: 'What has one eye but cannot see?', answer: 'needle' },
  { question: 'What can you catch but not throw?', answer: 'cold' },
  { question: 'I am always in front of you but cannot be seen. What am I?', answer: 'future' },
  { question: 'What has words but never speaks?', answer: 'book' },
  { question: 'What goes up but never comes down?', answer: 'age' },
  { question: 'What is full of holes but still holds water?', answer: 'sponge' },
  { question: 'What has four legs in the morning, two legs in the afternoon, and three legs in the evening?', answer: 'human' },
  { question: 'I have a thousand needles but I do not sew. What am I?', answer: 'porcupine' },
  { question: 'What can fill a room but takes up no space?', answer: 'light' },
  { question: 'What begins and has no end and ends all things that begin?', answer: 'death' },
  { question: 'I am always coming but never arrive. What am I?', answer: 'tomorrow' },
  { question: 'What belongs to you but others use it more than you do?', answer: 'name' },
]

export function pickRiddle(): Riddle {
  return RIDDLES[Math.floor(Math.random() * RIDDLES.length)]
}