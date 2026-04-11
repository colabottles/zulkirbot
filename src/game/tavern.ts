export interface TavernDrink {
  name: string
  description: string
  color: string
  flavor: string
  effect: 'attack' | 'defense' | 'damage' | 'hp' | 'weird'
  bonus: number
  price: number
  weirdMessage?: string
}

export interface TavernMeal {
  name: string
  description: string
  healAmount: number
  price: number
}

export const TAVERN_DRINKS: TavernDrink[] = [
  { name: "Dragon's Blood Ale", description: 'A fiery red ale that burns going down.', color: 'deep crimson', flavor: 'smoky, bitter, with a fiery finish', effect: 'damage', bonus: 3, price: 15 },
  { name: 'Moonshae Mist', description: 'A pale blue brew that shimmers in the light.', color: 'pale blue', flavor: 'cool, floral, with a hint of sea salt', effect: 'defense', bonus: 2, price: 12 },
  { name: 'Shadowdark Stout', description: 'A pitch black stout from the underdark.', color: 'pitch black', flavor: 'dark chocolate, mushroom, and ash', effect: 'attack', bonus: 2, price: 12 },
  { name: 'Elixir of the Arcane', description: 'A swirling purple concoction.', color: 'swirling purple', flavor: 'sweet, electric, with a metallic bite', effect: 'damage', bonus: 4, price: 20 },
  { name: 'Trollblood Tonic', description: 'A thick green liquid of dubious origin.', color: 'murky green', flavor: 'earthy, sour, and deeply unpleasant', effect: 'hp', bonus: 5, price: 18 },
  { name: 'Feywild Fizz', description: 'A sparkling golden drink that tickles the nose.', color: 'sparkling gold', flavor: 'honey, elderflower, and pure joy', effect: 'attack', bonus: 3, price: 15 },
  { name: 'Underdark Whiskey', description: 'Aged in mushroom barrels deep below the surface.', color: 'amber brown', flavor: 'smoky, fungal, with a long finish', effect: 'damage', bonus: 2, price: 10 },
  { name: 'Potion of Liquid Courage', description: 'You feel invincible. You are not.', color: 'bright orange', flavor: 'spicy, warm, and slightly hallucinogenic', effect: 'weird', bonus: 0, price: 8, weirdMessage: 'You feel invincible! Unfortunately this has no actual effect on your combat ability.' },
  { name: "Beholder's Eye", description: 'A cocktail that stares back at you.', color: 'milky white with a dark iris', flavor: 'oddly savory, with notes of regret', effect: 'weird', bonus: 0, price: 8, weirdMessage: 'You feel watched. Nothing happens, but you feel watched.' },
  { name: 'Mindflayer Brew', description: "You don't want to know what's in it.", color: 'deep violet', flavor: 'indescribable — your mind goes briefly blank', effect: 'weird', bonus: 0, price: 8, weirdMessage: 'Your thoughts scatter briefly. You forget what you were doing but feel refreshed.' },
  { name: 'Dwarven Thundermead', description: 'Strong enough to fell an ogre.', color: 'dark gold', flavor: 'honey, iron, and pure dwarven stubbornness', effect: 'defense', bonus: 3, price: 15 },
  { name: 'Silvermoon Sauvignon', description: 'An elven wine of exceptional refinement.', color: 'pale silver', flavor: 'crisp, floral, with notes of moonlight', effect: 'attack', bonus: 2, price: 20 },
]

export const TAVERN_MEALS: TavernMeal[] = [
  { name: 'Roasted Boar', description: 'A whole roasted boar with root vegetables.', healAmount: 10, price: 15 },
  { name: 'Hearty Stew', description: 'Thick stew with whatever was available today.', healAmount: 8, price: 10 },
  { name: 'Elven Waybread', description: 'Light but surprisingly filling.', healAmount: 6, price: 8 },
  { name: 'Dwarven Iron Ration', description: 'Dense, chewy, and effective.', healAmount: 7, price: 8 },
  { name: 'Dragon Pepper Chicken', description: 'Spiced with actual dragon pepper. Your eyes water.', healAmount: 12, price: 18 },
  { name: "Manshoon's Mushroom Risotto", description: 'From mushrooms of uncertain provenance.', healAmount: 9, price: 12 },
  { name: 'Smoked Cave Fish', description: 'Caught fresh from the underdark rivers.', healAmount: 8, price: 10 },
  { name: 'Athas Halfling Pie', description: 'Nobody makes pie like halflings that are sun-dried.', healAmount: 11, price: 15 },
  { name: 'Grilled Owlbear Steak', description: 'Tough but rewarding.', healAmount: 14, price: 22 },
  { name: "Primus's Poutine-a-Plenty", description: 'Issued by decree of Primus himself. Gravy, curds, and fries in perfect alignment. Deviation is not permitted.', healAmount: 5, price: 6 },
  { name: 'Sembian Spiced Lamb Skewers', description: 'A favourite of the Daleland folk.', healAmount: 10, price: 14 },
  { name: 'Feywild Fruit Platter', description: 'Exotic fruits from beyond the veil.', healAmount: 9, price: 13 },
]