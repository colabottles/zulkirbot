let manuallyPaused = false

export function isManuallyPaused(): boolean {
  return manuallyPaused
}

export function setManualPause(paused: boolean): void {
  manuallyPaused = paused
}