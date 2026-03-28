export interface DuelChallenge {
  challenger: string
  target: string
  channel: string
  expiresAt: number
}

export interface ActiveDuel {
  challenger: string
  target: string
  channel: string
  challengerHp: number
  targetHp: number
  currentTurn: string
  last_action: number
}

const pendingChallenges = new Map<string, DuelChallenge>()
const activeDuels = new Map<string, ActiveDuel>()

const DUEL_TIMEOUT_MS = 3 * 60 * 1000

export function createChallenge(
  challenger: string,
  target: string,
  channel: string
): void {
  pendingChallenges.set(target, {
    challenger,
    target,
    channel,
    expiresAt: Date.now() + DUEL_TIMEOUT_MS,
  })
}

export function getChallenge(target: string): DuelChallenge | undefined {
  const challenge = pendingChallenges.get(target)
  if (!challenge) return undefined
  if (Date.now() > challenge.expiresAt) {
    pendingChallenges.delete(target)
    return undefined
  }
  return challenge
}

export function removeChallenge(target: string): void {
  pendingChallenges.delete(target)
}

export function startDuel(
  challenger: string,
  target: string,
  channel: string,
  challengerHp: number,
  targetHp: number,
  firstTurn: string
): void {
  const duel: ActiveDuel = {
    challenger,
    target,
    channel,
    challengerHp,
    targetHp,
    currentTurn: firstTurn,
    last_action: Date.now(),
  }
  activeDuels.set(challenger, duel)
  activeDuels.set(target, duel)
}

export function getActiveDuel(username: string): ActiveDuel | undefined {
  return activeDuels.get(username)
}

export function removeDuel(challenger: string, target: string): void {
  activeDuels.delete(challenger)
  activeDuels.delete(target)
}

export function isInDuel(username: string): boolean {
  return activeDuels.has(username)
}