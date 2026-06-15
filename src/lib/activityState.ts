// Tracks whether any campaign is currently running, for reminder suppression
let activeCampaignCount = 0

export function markCampaignActive(): void {
  activeCampaignCount++
}

export function markCampaignInactive(): void {
  activeCampaignCount = Math.max(0, activeCampaignCount - 1)
}

export function isAnyCampaignActive(): boolean {
  return activeCampaignCount > 0
}