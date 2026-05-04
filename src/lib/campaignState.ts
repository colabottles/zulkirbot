let campaignActive = false

export function setCampaignActive(active: boolean): void {
  campaignActive = active
}

export function isCampaignActive(): boolean {
  return campaignActive
}