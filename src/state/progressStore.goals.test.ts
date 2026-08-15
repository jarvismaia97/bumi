import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MONTHLY_REWARD_HINTS, MONTHLY_TARGET, WEEKLY_REWARD_HINTS, WEEKLY_TARGET } from '@/game/goals';
import { INITIAL_HINTS, MAX_HINTS, MILESTONE_INTERVAL } from '@/game/hints';
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

/** The first `count` days of August 2026, which is enough of a month to close the monthly goal. */
function augustDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `202608${String(i + 1).padStart(2, '0')}`);
}

beforeEach(() => {
  useProgressStore.setState({
    hints: INITIAL_HINTS,
    hintsEarned: INITIAL_HINTS,
    hintsSpent: 0,
    solvedMap: {},
    solvedDateMap: {},
    dailyCompletionDates: [],
    dailyCompletedDate: null,
    dailyDurations: {},
    dailyHints: {},
  });
});

afterEach(() => {
  vi.useRealTimers();
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

/**
 * The archive hands back a day that is already on file, and the win flow marks it done again.
 * `gameStore` locks a solved board, but a replay loads the level afresh, so nothing upstream
 * stops the second call. A period sitting exactly on its target then paid its bonus once per
 * replay, over and over, and hints are the only thing the game lets a player earn.
 */
describe('replaying a daily that is already recorded', () => {
  it('pays nothing when the month is already at its target', () => {
    vi.setSystemTime(new Date(2026, 7, 15));
    useProgressStore.setState({ dailyCompletionDates: augustDays(MONTHLY_TARGET) });

    useProgressStore.getState().markDailyDone('20260804');
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS);
  });

  it('pays nothing when the week is already at its target', () => {
    // Saturday, with Monday to Wednesday of the same week done. Three days finish the week
    // and are nowhere near the month, so the weekly bonus is the only one in reach.
    vi.setSystemTime(new Date(2026, 7, 15));
    useProgressStore.setState({ dailyCompletionDates: ['20260810', '20260811', '20260812'] });

    useProgressStore.getState().markDailyDone('20260811');
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS);
  });

  it('still takes a better time and the hints that solve spent', () => {
    // Beating your own time is why the archive is replayable at all, and the friends board
    // reads these two. Only the reward is once per day.
    useProgressStore.setState({
      dailyCompletionDates: ['20260811'],
      dailyDurations: { '20260811': 90_000 },
      dailyHints: { '20260811': 2 },
    });

    useProgressStore.getState().markDailyDone('20260811', 60_000, 0);
    expect(useProgressStore.getState().dailyDurations['20260811']).toBe(60_000);
    expect(useProgressStore.getState().dailyHints['20260811']).toBe(0);

    // A slower replay leaves the record where it is, hint count included.
    useProgressStore.getState().markDailyDone('20260811', 120_000, 1);
    expect(useProgressStore.getState().dailyDurations['20260811']).toBe(60_000);
    expect(useProgressStore.getState().dailyHints['20260811']).toBe(0);
  });

  it('pays a genuinely new day, and pays it only the first time', () => {
    // Thursday the 20th: the eleven days on file are all earlier in the month and none of
    // them fall in this week, so the day that lands is the twelfth and closes the month.
    vi.setSystemTime(new Date(2026, 7, 20));
    useProgressStore.setState({ dailyCompletionDates: augustDays(MONTHLY_TARGET - 1) });

    useProgressStore.getState().markDailyDone('20260820');
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS + MONTHLY_REWARD_HINTS);

    useProgressStore.getState().markDailyDone('20260820');
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS + MONTHLY_REWARD_HINTS);
  });

  it('records the reward as earned rather than as a balance, and the replay as nothing at all', () => {
    // What the sync actually carries. A reward that moved the balance without moving the counter
    // would be invisible to the server, and one that moved the counter twice would be minted.
    vi.setSystemTime(new Date(2026, 7, 20));
    useProgressStore.setState({ dailyCompletionDates: augustDays(MONTHLY_TARGET - 1) });

    useProgressStore.getState().markDailyDone('20260820');
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS + MONTHLY_REWARD_HINTS);
    expect(useProgressStore.getState().hintsSpent).toBe(0);

    useProgressStore.getState().markDailyDone('20260820');
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS + MONTHLY_REWARD_HINTS);
  });
});

/**
 * The counters only ever grow, which is what makes `max` the right merge for each of them — so
 * every path that used to move the balance has to move a counter instead, and exactly once.
 */
describe('hints as two counters', () => {
  /** The first level whose solve pays the milestone hint. */
  const MILESTONE = MILESTONE_INTERVAL - 1;

  it('spends by counting the spend, not by lowering the balance', () => {
    useProgressStore.getState().spendHint();
    expect(useProgressStore.getState().hintsSpent).toBe(1);
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS);
    expect(useProgressStore.getState().hints).toBe(INITIAL_HINTS - 1);
  });

  it('refuses a spend at an empty balance instead of flooring it', () => {
    // The old line took `normalizeHintCount(hints - 1)` and answered 0 with 0, which cost
    // nothing. A counter cannot be quiet about it: a spend recorded with nothing to spend is
    // permanent and would eat the next hint this account earned, on every device it reached.
    useProgressStore.setState({ hints: 0, hintsEarned: 5, hintsSpent: 5 });
    useProgressStore.getState().spendHint();
    expect(useProgressStore.getState().hintsSpent).toBe(5);
    expect(useProgressStore.getState().hints).toBe(0);
  });

  it('pays the milestone hint once, and pays nothing for a level already solved', () => {
    expect(useProgressStore.getState().markSolved(MILESTONE)).toBe(true);
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS + 1);

    // A replay loads the level afresh, so nothing upstream of the store knows it is a repeat.
    expect(useProgressStore.getState().markSolved(MILESTONE)).toBe(false);
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS + 1);
  });

  it('leaves the counters alone for a level that is not a milestone', () => {
    useProgressStore.getState().markSolved(MILESTONE - 1);
    expect(useProgressStore.getState().hintsEarned).toBe(INITIAL_HINTS);
    expect(useProgressStore.getState().hintsSpent).toBe(0);
  });

  it('forfeits a grant made at the cap rather than banking it for later', () => {
    // The cap has always worked this way — `Math.min(MAX_HINTS, s.hints + 1)` dropped the hint —
    // and it has to keep working this way, because a counter that grew past the ceiling would
    // hand the hint back on the next spend and the ceiling would stop meaning anything.
    useProgressStore.setState({ hints: MAX_HINTS, hintsEarned: MAX_HINTS, hintsSpent: 0 });

    useProgressStore.getState().markSolved(MILESTONE);
    expect(useProgressStore.getState().hintsEarned).toBe(MAX_HINTS);
    expect(useProgressStore.getState().hints).toBe(MAX_HINTS);

    // And the hint stays forfeited: spending one gives back what was spent and no more.
    useProgressStore.getState().spendHint();
    expect(useProgressStore.getState().hints).toBe(MAX_HINTS - 1);
  });

  it('holds the bound that keeps the merge sound: earned is never more than spent plus the cap', () => {
    // Every device holding this is what lets the merge take the larger of each counter and still
    // land on a balance the pair justifies — the larger spend is at least the spend belonging to
    // the larger earn, so the bound survives the merge.
    useProgressStore.setState({ hints: MAX_HINTS, hintsEarned: MAX_HINTS, hintsSpent: 0 });
    vi.setSystemTime(new Date(2026, 7, 20));
    useProgressStore.setState({ dailyCompletionDates: augustDays(MONTHLY_TARGET - 1) });

    useProgressStore.getState().markDailyDone('20260820');
    const { hintsEarned, hintsSpent } = useProgressStore.getState();
    expect(hintsEarned - hintsSpent).toBeLessThanOrEqual(MAX_HINTS);
  });
});

/**
 * Every device already out there holds a persisted balance and no counters. The upgrade has to
 * leave the number the player sees exactly where it was — losing one is a theft and gaining one
 * is a mint that then syncs to every other device on the account.
 */
describe('the persisted balance becoming counters', () => {
  const migrate = useProgressStore.persist.getOptions().migrate!;

  it('carries a stored balance over whole, as earned and nothing spent', () => {
    const migrated = migrate({ hints: 7, solvedMap: { 0: true } }, 4) as {
      hints: number;
      hintsEarned: number;
      hintsSpent: number;
    };
    expect(migrated.hints).toBe(7);
    expect(migrated.hintsEarned).toBe(7);
    expect(migrated.hintsSpent).toBe(0);
  });

  it('gives a device that never stored a balance the starting grant', () => {
    const migrated = migrate({}, 4) as { hints: number; hintsEarned: number };
    expect(migrated.hints).toBe(INITIAL_HINTS);
    expect(migrated.hintsEarned).toBe(INITIAL_HINTS);
  });

  it('still runs the campaign migration a device on version 2 needs', () => {
    const migrated = migrate({ hints: 4, solvedMap: { 3: true, 9: true }, levelMedals: { 3: 'gold' } }, 2) as {
      hints: number;
      hintsEarned: number;
      solvedMap: Record<number, true>;
      levelMedals: Record<number, string>;
    };
    expect(migrated.solvedMap).toEqual({ 0: true, 1: true });
    expect(migrated.levelMedals).toEqual({});
    expect(migrated.hintsEarned).toBe(4);
  });

  it('leaves a device that already has counters alone', () => {
    const state = { hints: 2, hintsEarned: 9, hintsSpent: 7 };
    expect(migrate(state, 5)).toEqual(state);
  });
});
