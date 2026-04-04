import { TavernDrink } from '../game/tavern'

export interface ActiveBuff {
  effect: string
  bonus: number
  username: string
}

const activeBuffs = new Map<string, ActiveBuff>()

export function applyBuff(username: string, drink: TavernDrink): void {
  if (drink.effect === 'weird') return
  activeBuffs.set(username, {
    effect: drink.effect,
    bonus: drink.bonus,
    username,
  })
}

export function getBuff(username: string): ActiveBuff | undefined {
  return activeBuffs.get(username)
}

export function clearBuff(username: string): void {
  activeBuffs.delete(username)
}