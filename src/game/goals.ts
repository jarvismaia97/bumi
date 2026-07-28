import { getDailyDateKey } from './daily';

/**
 * Weekly and monthly goals are derived from the daily completions the app already stores and
 * syncs, so neither needs a column of its own. That also means they are retroactive and can
 * never disagree with the calendar the player sees.
 */
export const WEEKLY_TARGET = 3;
export const MONTHLY_TARGET = 12;

/** Hints, not cosmetics: the player who keeps showing up is the one who wants help. */
export const WEEKLY_REWARD_HINTS = 1;
export const MONTHLY_REWARD_HINTS = 3;

export interface GoalProgress {
  done: number;
  target: number;
  complete: boolean;
  /** Days left in the period, today included. */
  daysLeft: number;
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Weeks run Monday to Sunday, matching the existing weekly count. */
function startOfWeek(now: Date): Date {
  const today = startOfDay(now);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return monday;
}

function countBetween(completedDates: readonly string[], from: Date, to: Date): number {
  const first = getDailyDateKey(from);
  const last = getDailyDateKey(to);
  return new Set(completedDates.filter(date => date >= first && date <= last)).size;
}

export function getWeeklyProgress(completedDates: readonly string[], now: Date = new Date()): GoalProgress {
  const monday = startOfWeek(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const done = countBetween(completedDates, monday, sunday);

  return {
    done,
    target: WEEKLY_TARGET,
    complete: done >= WEEKLY_TARGET,
    daysLeft: 7 - ((now.getDay() + 6) % 7),
  };
}

export function getMonthlyProgress(completedDates: readonly string[], now: Date = new Date()): GoalProgress {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const done = countBetween(completedDates, first, last);

  return {
    done,
    target: MONTHLY_TARGET,
    complete: done >= MONTHLY_TARGET,
    daysLeft: last.getDate() - now.getDate() + 1,
  };
}

/**
 * Whether this particular completion is the one that finished the goal. The store grants the
 * reward on that transition, the same way a milestone level does, so nothing has to remember
 * which goals were already paid out.
 */
export function goalsCompletedBy(
  completedDates: readonly string[],
  justCompleted: string,
  now: Date = new Date(),
): { weekly: boolean; monthly: boolean } {
  const before = completedDates.filter(date => date !== justCompleted);
  const after = [...before, justCompleted];

  return {
    weekly: !getWeeklyProgress(before, now).complete && getWeeklyProgress(after, now).complete,
    monthly: !getMonthlyProgress(before, now).complete && getMonthlyProgress(after, now).complete,
  };
}

export function goalRewardHints(completed: { weekly: boolean; monthly: boolean }): number {
  return (completed.weekly ? WEEKLY_REWARD_HINTS : 0) + (completed.monthly ? MONTHLY_REWARD_HINTS : 0);
}
