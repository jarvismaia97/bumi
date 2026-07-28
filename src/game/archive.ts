import { getDailyDateKey } from './daily';

/**
 * The game could always open any day's puzzle — that is how a shared daily link works — but
 * there was no way to reach one from inside the app, so a missed day was gone for good. The
 * archive is the current calendar month, which is also the window the monthly goal counts.
 */
export type ArchiveDayState = 'done' | 'available' | 'future';

export interface ArchiveDay {
  dateKey: string;
  day: number;
  state: ArchiveDayState;
}

export function getArchiveMonth(completedDates: readonly string[], now: Date = new Date()): ArchiveDay[] {
  const done = new Set(completedDates);
  const today = getDailyDateKey(now);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const dateKey = getDailyDateKey(new Date(now.getFullYear(), now.getMonth(), day));
    return {
      dateKey,
      day,
      // A future puzzle is not generated yet, and today's counts as available until solved.
      state: done.has(dateKey) ? 'done' : dateKey > today ? 'future' : 'available',
    };
  });
}

/** How many days of this month are still open, which is what the archive is worth opening for. */
export function countMissedDays(completedDates: readonly string[], now: Date = new Date()): number {
  return getArchiveMonth(completedDates, now).filter(day => day.state === 'available').length;
}

/** The blank cells before the 1st, so the grid lines up under the weekday it falls on. */
export function leadingBlanks(now: Date = new Date()): number {
  // Weeks run Monday to Sunday, matching the weekly goal.
  return (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
}
