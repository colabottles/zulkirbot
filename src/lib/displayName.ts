export function getDisplayName(username: string, char: { character_name?: string | null }): string {
  return char.character_name?.trim() || username
}