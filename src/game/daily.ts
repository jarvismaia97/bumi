import { genUniqueLevel } from './generateUnique';
import type { Level } from './types';

const DAILY_SIZES = [5, 6, 6, 7, 5, 6, 7];

export function getDailyDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Records a daily's time, keeping the better of the two when one is already there. Replaying a
 * day from the archive should be able to improve a time and never to spoil one, and a call with
 * no time at all — an older screen, a path that does not measure — must leave the record alone.
 */
export function bestDuration(
  durations: Record<string, number>,
  dateKey: string,
  durationMs: number | undefined,
): Record<string, number> {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) return durations;
  const rounded = Math.round(durationMs);
  const current = durations[dateKey];
  if (current !== undefined && current <= rounded) return durations;
  return { ...durations, [dateKey]: rounded };
}

/**
 * The hint count that belongs with the recorded time. Hints follow the time rather than being
 * minimised on their own: the record for a day is its fastest solve, and the count that belongs
 * to it is what that solve spent. A slower replay that used fewer would otherwise lend its
 * number to a time it did not set.
 *
 * Call it before `bestDuration` writes the new time — it reads the old one to decide.
 */
export function hintsForBest(
  durations: Record<string, number>,
  hints: Record<string, number>,
  dateKey: string,
  durationMs: number | undefined,
  hintsUsed: number | undefined,
): Record<string, number> {
  if (hintsUsed === undefined || !Number.isFinite(hintsUsed) || hintsUsed < 0) return hints;
  const rounded = Math.round(hintsUsed);
  // Nothing recorded for the day yet, so this solve is the record whether or not it was timed.
  if (hints[dateKey] === undefined) return { ...hints, [dateKey]: rounded };
  // Otherwise only a time that beat the one on file takes the count with it.
  if (bestDuration(durations, dateKey, durationMs) === durations) return hints;
  return { ...hints, [dateKey]: rounded };
}

/**
 * Minutes east of UTC on this device — the sign the server wants, and the opposite of the one
 * `getTimezoneOffset` gives. Sent with progress so the friends board can work out which day a
 * date key meant instead of reading them all at UTC.
 */
export function utcOffsetMinutes(d: Date = new Date()): number {
  return -d.getTimezoneOffset();
}

/**
 * Consecutive days ending today, or ending yesterday while today is still open. Counting
 * strictly from today read zero every morning: a player on an eight-day run opened the app and
 * was told to start a streak, and it only came back once they had played. The reminder the app
 * sends at seven says the streak ends at midnight, which is the promise the count now keeps —
 * it breaks when a day closes without it, not when a day opens.
 */
export function getDailyStreak(completedDates: readonly string[], now: Date = new Date()): number {
  const completed = new Set(completedDates);
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!completed.has(getDailyDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (completed.has(getDailyDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getDailyLevel(d: Date = new Date()): Level {
  const seed = parseInt(getDailyDateKey(d), 10);
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const size = DAILY_SIZES[doy % DAILY_SIZES.length];
  return genUniqueLevel(seed, size, 9);
}

export function getNextDailyInMs(now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
