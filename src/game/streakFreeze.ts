import { getDailyDateKey } from './daily';

/**
 * One missed day a month does not end a streak.
 *
 * The day after breaking a long run is the day players stop coming back, and the streak is the
 * one number in Bumi that only punishes. A freeze is earned rather than bought and buys nothing
 * but forgiveness: it cannot be spent on a hint, it never touches a medal, and it cannot open a
 * theme — see `game/unlocks.ts` for why that separation is kept.
 *
 * The rule is deliberately dull so a player can hold it in their head: **one freeze per calendar
 * month, spent automatically on the gap it covers**. It is claimed after the fact, when the app
 * next looks at the streak, so a player who simply lived their life is handed it rather than
 * asked to arm it in advance.
 */

/** A freeze belongs to the month of the day it covers, which is what makes one per month true. */
function monthOf(dateKey: string): string {
  return dateKey.slice(0, 6);
}

export function hasFreezeForMonth(frozenDates: readonly string[], dateKey: string): boolean {
  return frozenDates.some(frozen => monthOf(frozen) === monthOf(dateKey));
}

function keyOfDaysAgo(now: Date, days: number): string {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cursor.setDate(cursor.getDate() - days);
  return getDailyDateKey(cursor);
}

/**
 * The day a freeze would have to cover to keep a run alive, or null when there is nothing to
 * save. That is yesterday, and only yesterday: today is still open and cannot be missed yet,
 * and a gap two days wide is a streak that has already ended — a freeze is forgiveness for
 * forgetting once, not a way to be away for a week and come back to an intact number.
 *
 * There must also be a run to protect. Freezing the day before a player's very first daily
 * would invent a streak they never had.
 */
export function freezableDate(
  completedDates: readonly string[],
  frozenDates: readonly string[],
  now: Date = new Date(),
): string | null {
  const completed = new Set([...completedDates, ...frozenDates]);
  const yesterday = keyOfDaysAgo(now, 1);
  const dayBefore = keyOfDaysAgo(now, 2);

  if (completed.has(yesterday)) return null;
  if (!completed.has(dayBefore)) return null;
  if (hasFreezeForMonth(frozenDates, yesterday)) return null;

  return yesterday;
}

/**
 * The frozen days after taking whatever this month still allows. Pure and idempotent: calling
 * it twice in a day changes nothing, which is what lets it run on every app resume.
 */
export function claimFreeze(
  completedDates: readonly string[],
  frozenDates: readonly string[],
  now: Date = new Date(),
): string[] {
  const date = freezableDate(completedDates, frozenDates, now);
  if (!date) return frozenDates as string[];
  return [...frozenDates, date].sort();
}

/**
 * Whether a freeze is holding the current run up, which is the only time it is worth saying so.
 * A freeze spent weeks ago on a streak that has since ended is history, not news.
 */
export function isFreezeProtecting(
  completedDates: readonly string[],
  frozenDates: readonly string[],
  now: Date = new Date(),
): boolean {
  if (!frozenDates.length) return false;
  const completed = new Set(completedDates);
  const all = new Set([...completedDates, ...frozenDates]);
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!all.has(getDailyDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  // Walk the run the player currently has and ask whether any day in it was forgiven.
  while (all.has(getDailyDateKey(cursor))) {
    if (!completed.has(getDailyDateKey(cursor))) return true;
    cursor.setDate(cursor.getDate() - 1);
  }
  return false;
}
