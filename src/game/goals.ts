import { getDailyDateKey } from './daily';

/**
 * Weekly and monthly goals are derived from the daily completions the app already stores and
 * syncs, so neither needs a column of its own. That also means they are retroactive and can
 * never disagree with the calendar the player sees.
 */
export const WEEKLY_TARGET = 3;
export const MONTHLY_TARGET = 12;

/**
 * Streak lengths worth marking. Deliberately sparse and far apart: a streak that celebrates
 * every week stops being an achievement, and these are the only numbers a player is likely
 * to say out loud.
 */
export const STREAK_MILESTONES = [30, 50, 100, 365] as const;

export function isStreakMilestone(streak: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(streak);
}

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
 *
 * `recordedDates` is the list as it stands before the completion, and a day that is already in
 * it finished nothing: it is a replay from the archive, which loads the level afresh and so
 * runs the win flow again. This used to subtract `justCompleted` out of the list first, which
 * manufactured a transition for a day already on file — with the month sitting exactly on
 * twelve, re-solving any day of it minted three hints, repeatably. Taking the untouched list
 * and answering nothing for a day it already contains is what makes that unsayable.
 */
export function goalsCompletedBy(
  recordedDates: readonly string[],
  justCompleted: string,
  now: Date = new Date(),
): { weekly: boolean; monthly: boolean } {
  if (recordedDates.includes(justCompleted)) return { weekly: false, monthly: false };
  const after = [...recordedDates, justCompleted];

  return {
    weekly: !getWeeklyProgress(recordedDates, now).complete && getWeeklyProgress(after, now).complete,
    monthly: !getMonthlyProgress(recordedDates, now).complete && getMonthlyProgress(after, now).complete,
  };
}

export function goalRewardHints(completed: { weekly: boolean; monthly: boolean }): number {
  return (completed.weekly ? WEEKLY_REWARD_HINTS : 0) + (completed.monthly ? MONTHLY_REWARD_HINTS : 0);
}
