export const roll = (sides: number): number =>
  Math.floor(Math.random() * sides) + 1

export const d4 = () => roll(4)
export const d6 = () => roll(6)
export const d8 = () => roll(8)
export const d10 = () => roll(10)
export const d12 = () => roll(12)
export const d20 = () => roll(20)
export const d100 = () => roll(100)