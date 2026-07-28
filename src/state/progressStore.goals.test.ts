import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MONTHLY_REWARD_HINTS, MONTHLY_TARGET, WEEKLY_REWARD_HINTS, WEEKLY_TARGET } from '@/game/goals';
import { INITIAL_HINTS } from '@/game/hints';
import { useProgressStore } from './progressStore';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

/** Dailies completed on consecutive days ending yesterday, so today can be the one that pays. */
function priorDays(count: number, now: Date): string[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (count - i));
    return `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
  });
}

beforeEach(() => {
  useProgressStore.setState({ hints: INITIAL_HINTS, dailyCompletionDates: [], dailyCompletedDate: null });
});

describe('daily goals paying out in hints', () => {
  it('pays nothing for a daily that leaves the week unfinished', () => {
    useProgressStore.getState().markDailyDone();
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS);
  });

  it('pays the weekly reward on the daily that completes the week', () => {
    // Mid-month Wednesday: far enough in that the prior days sit in the same week and month.
    const now = new Date(2026, 6, 15);
    vi.setSystemTime(now);
    useProgressStore.setState({ dailyCompletionDates: priorDays(WEEKLY_TARGET - 1, now) });

    useProgressStore.getState().markDailyDone();
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS + WEEKLY_REWARD_HINTS);
    vi.useRealTimers();
  });

  it('does not pay the same week twice', () => {
    // Friday, with Monday to Thursday already done: the week was finished before today, so
    // today's daily adds to the streak and nothing else. Dates are spelled out because
    // counting backwards from a Wednesday walks into the previous week.
    vi.setSystemTime(new Date(2026, 6, 17));
    useProgressStore.setState({ dailyCompletionDates: ['20260713', '20260714', '20260715', '20260716'] });

    useProgressStore.getState().markDailyDone();
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS);
    vi.useRealTimers();
  });

  it('pays more for the month than for the week', () => {
    expect(MONTHLY_REWARD_HINTS).toBeGreaterThan(WEEKLY_REWARD_HINTS);
    expect(MONTHLY_TARGET).toBeGreaterThan(WEEKLY_TARGET);
  });
});
