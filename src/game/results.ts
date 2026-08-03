import { highestTier, type CelebrationTier } from '@/components/Grid/celebration';
import { getMedalForResult, isBetterMedal, type Medal } from './medals';
import { medalPointsGain } from './points';

/**
 * What a solve was worth. This lived inline in the game screen, where the only way to check it
 * was to solve a level by hand — which is how a replay would have quietly claimed points it did
 * not earn if nobody had thought to look. It is all derivable, so it is derived here.
 */
export interface CampaignSolve {
  hintsUsed: number;
  mistakes: number;
  /** Rectangles in the solution: the mistake budget scales with it. */
  rects: number;
  /** The best medal this level already held, if any. */
  bestMedal?: Medal;
  /** True on the levels the catalogue marks as milestones, which celebrate harder. */
  milestone: boolean;
  /** Set when this solve finished an island, which is the rarest thing that can happen. */
  unlockedIsland: boolean;
}

export interface CampaignOutcome {
  /** What was earned now, which is what gets recorded. */
  medal: Medal;
  /** What to show, which is the better of what was earned and what was already held. */
  displayedMedal: Medal;
  /** Points added to the friends board: the difference, so a replay adds nothing. */
  pointsGained: number;
  tier: CelebrationTier;
}

export function resolveCampaignSolve({
  hintsUsed,
  mistakes,
  rects,
  bestMedal,
  milestone,
  unlockedIsland,
}: CampaignSolve): CampaignOutcome {
  const medal = getMedalForResult({ hintsUsed, mistakes, rects });

  return {
    medal,
    displayedMedal: isBetterMedal(medal, bestMedal) ? medal : bestMedal ?? medal,
    pointsGained: medalPointsGain(medal, bestMedal),
    // Only the fresh result earns the big celebration; replaying a solved level does not.
    // Every medal celebrates, not just gold — bronze and silver used to look like no medal at
    // all, which is what most solves are. `highestTier` keeps the rarest of them on screen.
    tier: highestTier(
      unlockedIsland ? 'island' : null,
      medal,
      milestone ? 'milestone' : null,
    ),
  };
}
