export interface GiveawayState {
  active: boolean
  prizeName: string
  prizeCode: string
  entries: string[]
  timerStarted: boolean
  timerEndTime: number | null
  channel: string
  warned: boolean
  gamePaused: boolean
}

const state: GiveawayState = {
  active: false,
  prizeName: '',
  prizeCode: '',
  entries: [],
  timerStarted: false,
  timerEndTime: null,
  channel: '',
  warned: false,
  gamePaused: false,
}

let warningTimeout: ReturnType<typeof setTimeout> | null = null
let endTimeout: ReturnType<typeof setTimeout> | null = null

export function getGiveawayState(): GiveawayState {
  return state
}

export function setGiveawayActive(
  active: boolean,
  prizeName: string = '',
  channel: string = ''
): void {
  state.active = active
  state.prizeName = prizeName
  state.channel = channel
  state.entries = []
  state.timerStarted = false
  state.timerEndTime = null
  state.warned = false
  clearTimeouts()
}

export function setPrizeCode(code: string): void {
  state.prizeCode = code
  state.gamePaused = true
}

export function resumeGame(): void {
  state.gamePaused = false
  state.prizeCode = ''
}

export function isGamePaused(): boolean {
  return state.gamePaused
}

export function addEntry(username: string): boolean {
  if (state.entries.includes(username)) return false
  state.entries.push(username)
  return true
}

export function startTimer(
  onWarning: () => void,
  onEnd: () => void
): void {
  if (state.timerStarted) return
  state.timerStarted = true
  state.timerEndTime = Date.now() + 5 * 60 * 1000
  warningTimeout = setTimeout(() => {
    state.warned = true
    onWarning()
  }, 4 * 60 * 1000)
  endTimeout = setTimeout(() => {
    state.active = false
    onEnd()
  }, 5 * 60 * 1000)
}

export function drawWinner(): string | null {
  if (state.entries.length === 0) return null
  return state.entries[Math.floor(Math.random() * state.entries.length)]
}

export function resetGiveaway(): void {
  state.active = false
  state.prizeName = ''
  state.prizeCode = ''
  state.entries = []
  state.timerStarted = false
  state.timerEndTime = null
  state.channel = ''
  state.warned = false
  state.gamePaused = false
  clearTimeouts()
}

function clearTimeouts(): void {
  if (warningTimeout) clearTimeout(warningTimeout)
  if (endTimeout) clearTimeout(endTimeout)
  warningTimeout = null
  endTimeout = null
}