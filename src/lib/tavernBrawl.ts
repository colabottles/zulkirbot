export interface BrawlState {
  active: boolean
  joining: boolean
  participants: string[]
  eliminated: string[]
  channel: string
  joinTimeout: ReturnType<typeof setTimeout> | null
}

const state: BrawlState = {
  active: false,
  joining: false,
  participants: [],
  eliminated: [],
  channel: '',
  joinTimeout: null,
}

export function getBrawlState(): BrawlState {
  return state
}

export function isInBrawl(username: string): boolean {
  return state.participants.includes(username)
}

export function startJoinWindow(channel: string, onStart: () => void, onCancel: () => void): void {
  state.joining = true
  state.channel = channel
  state.joinTimeout = setTimeout(() => {
    if (state.participants.length < 2) {
      resetBrawl()
      onCancel()
    } else {
      state.joining = false
      state.active = true
      onStart()
    }
  }, 30 * 1000)
}

export function addParticipant(username: string): boolean {
  if (state.participants.includes(username)) return false
  state.participants.push(username)
  return true
}

export function eliminateParticipant(username: string): void {
  state.participants = state.participants.filter(p => p !== username)
  state.eliminated.push(username)
}

export function resetBrawl(): void {
  state.active = false
  state.joining = false
  state.participants = []
  state.eliminated = []
  state.channel = ''
  if (state.joinTimeout) clearTimeout(state.joinTimeout)
  state.joinTimeout = null
}