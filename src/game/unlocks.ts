import { getAchievements, type AchievementStats } from './achievements';
import { getCompletedIslandCount } from './islands';
import type { ThemeName } from '@/theme/themes';

/**
 * Cosmetics are the reward for skill, never hints. A gold medal means the player solved it
 * fast, unaided and without a wrong move — handing that player more help rewards exactly the
 * person who demonstrably does not need it. Themes recognise them instead; hints come from
 * the daily goals, where the player who keeps turning up is the one who wants them.
 *
 * Every requirement is derived from progress that already exists and syncs, so unlocks are
 * retroactive: a returning player sees what they already earned, with nothing to migrate.
 */
export interface UnlockRequirement {
  islands?: number;
  achievements?: number;
  goldMedals?: number;
}

export const THEME_REQUIREMENTS: Record<ThemeName, UnlockRequirement> = {
  classic: {},
  mint: { islands: 1 },
  violet: { achievements: 3 },
  navy: { islands: 3 },
  rose: { goldMedals: 25 },
  sun: { islands: 6 },
  // Placeholders, and the one loose end of this pair. What these two want is the season they
  // are named after — played the daily on a day in December, on a day in October — and that
  // needs a requirement kind this file does not have yet. `dailyCompletionDates` already stores
  // and syncs which days were played, so the rule is derivable like every other one here; it is
  // only the plumbing that is missing. Until then they sit on the same ladder as the rest.
  natal: { achievements: 6 },
  halloween: { goldMedals: 50 },
};

export interface UnlockStats {
  islands: number;
  achievements: number;
  goldMedals: number;
}

export function getUnlockStats(stats: AchievementStats): UnlockStats {
  return {
    islands: getCompletedIslandCount(stats.solvedMap),
    achievements: getAchievements(stats).filter(a => a.current >= a.target).length,
    goldMedals: Object.values(stats.levelMedals).filter(medal => medal === 'gold').length,
  };
}

export function isUnlocked(requirement: UnlockRequirement, stats: UnlockStats): boolean {
  return (
    stats.islands >= (requirement.islands ?? 0) &&
    stats.achievements >= (requirement.achievements ?? 0) &&
    stats.goldMedals >= (requirement.goldMedals ?? 0)
  );
}

export function isThemeUnlocked(name: ThemeName, stats: UnlockStats): boolean {
  return isUnlocked(THEME_REQUIREMENTS[name], stats);
}

/** How far off the player is, for the row that explains what the lock is waiting on. */
export function remainingFor(requirement: UnlockRequirement, stats: UnlockStats): UnlockRequirement {
  return {
    islands: Math.max(0, (requirement.islands ?? 0) - stats.islands) || undefined,
    achievements: Math.max(0, (requirement.achievements ?? 0) - stats.achievements) || undefined,
    goldMedals: Math.max(0, (requirement.goldMedals ?? 0) - stats.goldMedals) || undefined,
  };
}
