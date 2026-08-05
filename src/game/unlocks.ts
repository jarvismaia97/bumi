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
  /** Calendar month, 1-12, the daily has to have been played in. Any year counts. */
  dailyInMonth?: number;
}

export const THEME_REQUIREMENTS: Record<ThemeName, UnlockRequirement> = {
  classic: {},
  mint: { islands: 1 },
  violet: { achievements: 3 },
  navy: { islands: 3 },
  rose: { goldMedals: 25 },
  sun: { islands: 6 },
  // These two ask for the season they are named after rather than for a rung on the ladder:
  // being there in December, being there in October. That is a different axis from skill and
  // deliberately so — a seasonal theme means you turned up, which is the whole of what it
  // commemorates. Any year satisfies it, so the player who played one December keeps the
  // theme for good instead of losing it every January.
  natal: { dailyInMonth: 12 },
  halloween: { dailyInMonth: 10 },
};

export interface UnlockStats {
  islands: number;
  achievements: number;
  goldMedals: number;
  /** Every month the daily was ever played in, so a season unlocks retroactively too. */
  dailyMonths: number[];
}

/** `YYYYMMDD`, the shape `dailyCompletionDates` is stored and synced in. */
function monthOf(dateKey: string): number {
  return Number(dateKey.slice(4, 6));
}

export function getUnlockStats(stats: AchievementStats, dailyCompletionDates: readonly string[] = []): UnlockStats {
  return {
    islands: getCompletedIslandCount(stats.solvedMap),
    achievements: getAchievements(stats).filter(a => a.current >= a.target).length,
    goldMedals: Object.values(stats.levelMedals).filter(medal => medal === 'gold').length,
    dailyMonths: Array.from(new Set(dailyCompletionDates.map(monthOf))),
  };
}

export function isUnlocked(requirement: UnlockRequirement, stats: UnlockStats): boolean {
  return (
    stats.islands >= (requirement.islands ?? 0) &&
    stats.achievements >= (requirement.achievements ?? 0) &&
    stats.goldMedals >= (requirement.goldMedals ?? 0) &&
    (requirement.dailyInMonth === undefined || stats.dailyMonths.includes(requirement.dailyInMonth))
  );
}

export function isThemeUnlocked(name: ThemeName, stats: UnlockStats): boolean {
  return isUnlocked(THEME_REQUIREMENTS[name], stats);
}

/** How far off the player is, for the row that explains what the lock is waiting on. */
export function remainingFor(requirement: UnlockRequirement, stats: UnlockStats): UnlockRequirement {
  const monthMet = requirement.dailyInMonth !== undefined && stats.dailyMonths.includes(requirement.dailyInMonth);
  return {
    islands: Math.max(0, (requirement.islands ?? 0) - stats.islands) || undefined,
    achievements: Math.max(0, (requirement.achievements ?? 0) - stats.achievements) || undefined,
    goldMedals: Math.max(0, (requirement.goldMedals ?? 0) - stats.goldMedals) || undefined,
    // Binary, not a countdown: the month is either behind the player or still to come.
    dailyInMonth: monthMet ? undefined : requirement.dailyInMonth,
  };
}
