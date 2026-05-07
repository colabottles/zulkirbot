export const RARITY_DISPLAY: Record<string, string> = {
  common: '⬜C',
  uncommon: '🟩U',
  rare: '🟦R',
  epic: '🟪E',
  legendary: '🟧L',
  mythic: '🟥M',
}

export function formatRarity(rarity: string): string {
  return RARITY_DISPLAY[rarity] ?? rarity
}