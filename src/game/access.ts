export const GUEST_CAMPAIGN_LEVEL_LIMIT = 10;

export function requiresCampaignLogin(levelIndex: number, isSignedIn: boolean): boolean {
  return !isSignedIn && levelIndex >= GUEST_CAMPAIGN_LEVEL_LIMIT;
}

export function isCampaignLevelUnlocked(levelIndex: number, solvedMap: Readonly<Record<number, true>>): boolean {
  if (solvedMap[levelIndex]) return true;

  for (let previous = 0; previous < levelIndex; previous++) {
    if (!solvedMap[previous]) return false;
  }

  return true;
}
