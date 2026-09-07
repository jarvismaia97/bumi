/**
 * How far a guest gets before the campaign asks for an account. It was 10 until 2026-09-08,
 * which put the wall about ten minutes in — early enough that an account still bought the
 * player nothing they could feel: one device, no friends on the board, no streak to protect.
 * 50 moves it past the point where someone has decided whether the game is worth an account.
 *
 * Nothing is lost by waiting: guest progress is merged and uploaded on sign-in
 * (`src/state/progressSync.ts`), so the levels solved before the wall travel with them.
 */
export const GUEST_CAMPAIGN_LEVEL_LIMIT = 50;

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
