import { describe, expect, it } from 'vitest';
import {
  getMonthlyProgress,
  getWeeklyProgress,
  goalRewardHints,
  goalsCompletedBy,
  isStreakMilestone,
  MONTHLY_TARGET,
  STREAK_MILESTONES,
  WEEKLY_TARGET,
} from './goals';

// A Wednesday, so the week has days on both sides of it.
const WEDNESDAY = new Date(2026, 6, 15);

describe('weekly goal', () => {
  it('counts only the dailies inside the current Monday-to-Sunday week', () => {
    const dates = ['20260712', '20260713', '20260715']; // Sunday before, then Mon and Wed
    expect(getWeeklyProgress(dates, WEDNESDAY).done).toBe(2);
  });

  it('completes at the target and reports the days still available', () => {
    const week = ['20260713', '20260714', '20260715'];
    const progress = getWeeklyProgress(week, WEDNESDAY);
    expect(progress.done).toBe(WEEKLY_TARGET);
    expect(progress.complete).toBe(true);
    expect(progress.daysLeft).toBe(5); // Wednesday through Sunday
  });

  it('ignores a duplicate completion of the same day', () => {
    expect(getWeeklyProgress(['20260715', '20260715'], WEDNESDAY).done).toBe(1);
  });
});

describe('monthly goal', () => {
  it('counts the whole calendar month, including days still to come', () => {
    const dates = ['20260630', '20260701', '20260715', '20260731'];
    expect(getMonthlyProgress(dates, WEDNESDAY).done).toBe(3);
  });

  it('needs more than a single week of play', () => {
    expect(MONTHLY_TARGET).toBeGreaterThan(WEEKLY_TARGET * 2);
  });

  it('counts the rest of the month as still available', () => {
    expect(getMonthlyProgress([], WEDNESDAY).daysLeft).toBe(17); // 15th to 31st
  });
});

describe('paying out on the transition', () => {
  it('pays the week only on the completion that finishes it', () => {
    const beforeLast = ['20260713', '20260714'];
    expect(goalsCompletedBy(beforeLast, '20260715', WEDNESDAY).weekly).toBe(true);
    // The fourth daily of the same week must not pay again.
    expect(goalsCompletedBy([...beforeLast, '20260715'], '20260716', WEDNESDAY).weekly).toBe(false);
  });

  it('pays nothing for a day that leaves the goal unfinished', () => {
    expect(goalsCompletedBy([], '20260715', WEDNESDAY)).toEqual({ weekly: false, monthly: false });
  });

  it('can pay both at once when the same daily closes the week and the month', () => {
    const month = Array.from({ length: MONTHLY_TARGET - 1 }, (_, i) => `202607${String(i + 1).padStart(2, '0')}`);
    const closing = goalsCompletedBy(month, '20260715', WEDNESDAY);
    expect(closing.monthly).toBe(true);
    expect(goalRewardHints(closing)).toBeGreaterThan(goalRewardHints({ weekly: true, monthly: false }));
  });

  it('rewards nothing when nothing completed', () => {
    expect(goalRewardHints({ weekly: false, monthly: false })).toBe(0);
  });
});

describe('streak milestones', () => {
  it('marks only the lengths worth saying out loud', () => {
    expect(STREAK_MILESTONES).toEqual([30, 50, 100, 365]);
    for (const streak of STREAK_MILESTONES) expect(isStreakMilestone(streak)).toBe(true);
  });

  it('stays quiet on the days around one', () => {
    // A streak that celebrates often stops being an achievement.
    for (const streak of [1, 7, 29, 31, 49, 99, 101, 364, 366]) {
      expect(isStreakMilestone(streak)).toBe(false);
    }
  });

  it('never fires before the first milestone is reachable', () => {
    for (let streak = 0; streak < STREAK_MILESTONES[0]; streak++) {
      expect(isStreakMilestone(streak)).toBe(false);
    }
  });
});
