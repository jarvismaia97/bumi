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

/**
 * The day's puzzle: the date key is the seed, and the board size rotates through DAILY_SIZES on
 * the day of the year so consecutive days do not all feel alike.
 *
 * Both halves read nothing but the local year, month and day, so the level is a function of the
 * date key alone — that is the guarantee the whole daily rests on. The archive replays a day by
 * passing its local midnight and a shared link rebuilds one from the key it carries, while today
 * arrives as `new Date()` at whatever hour the player opened the app; all three have to land on
 * the same board, and friends comparing times on the leaderboard have to have solved it too.
 *
 * The day number used to be elapsed milliseconds since 31 December floored to days, which is not
 * the calendar day number: across a DST shift the elapsed total is off by an hour, so a single
 * local date gave one index before 01:00 and another after it, and the size — the whole level —
 * turned on the time of day. Lisbon on 2026-04-01 was 7x7 at midnight and 5x5 at noon under one
 * date key, and so was every date between the spring-forward and the fall-back. Differencing two
 * `Date.UTC` values keeps the subtraction in a zone that never shifts, so the count is calendar
 * days by construction; `Date.UTC(y, 0, 0)` is 31 December of the year before, which makes 1
 * January day 1.
 */
export function getDailyLevel(d: Date = new Date()): Level {
  const seed = parseInt(getDailyDateKey(d), 10);
  const doy = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000;
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
