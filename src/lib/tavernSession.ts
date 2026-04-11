const tavernVisitors = new Set<string>()

export function markTavernVisit(username: string): void {
  tavernVisitors.add(username)
}

export function hasTavernVisit(username: string): boolean {
  return tavernVisitors.has(username)
}