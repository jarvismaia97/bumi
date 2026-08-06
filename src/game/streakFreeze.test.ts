import { describe, expect, it } from 'vitest';
import { getDailyStreak } from './daily';
import { claimFreeze, freezableDate, isFreezeProtecting } from './streakFreeze';

/** Local dates, because the daily's day boundary is midnight where the player is. */
const NOW = new Date(2026, 7, 7, 10, 0, 0);
const TODAY = '20260807';
const YESTERDAY = '20260806';
const TWO_DAYS = '20260805';
const THREE_DAYS = '20260804';

describe('what a freeze can cover', () => {
  it('covers yesterday when a run was going and yesterday was missed', () => {
    expect(freezableDate([THREE_DAYS, TWO_DAYS], [], NOW)).toBe(YESTERDAY);
  });

  it('has nothing to do while the run is unbroken', () => {
    expect(freezableDate([TWO_DAYS, YESTERDAY, TODAY], [], NOW)).toBeNull();
    expect(freezableDate([TWO_DAYS, YESTERDAY], [], NOW)).toBeNull();
  });

  it('refuses a gap two days wide, which is a streak that already ended', () => {
    // Forgiveness for forgetting once, not a way to be away for a week.
    expect(freezableDate([THREE_DAYS], [], NOW)).toBeNull();
  });

  it('refuses to invent a streak nobody had', () => {
    expect(freezableDate([], [], NOW)).toBeNull();
    expect(freezableDate([TODAY], [], NOW)).toBeNull();
  });

  it('allows one per calendar month and no more', () => {
    const spent = claimFreeze([THREE_DAYS, TWO_DAYS], [], NOW);
    expect(spent).toEqual([YESTERDAY]);
    // A second gap in the same month finds the month already spent.
    expect(freezableDate([THREE_DAYS, TWO_DAYS], spent, NOW)).toBeNull();
  });

  it('hands the next month its own freeze', () => {
    const september = new Date(2026, 8, 3, 10, 0, 0);
    expect(freezableDate(['20260901'], ['20260806'], september)).toBe('20260902');
  });
});

describe('claiming is safe to repeat', () => {
  it('changes nothing on the second call the same day', () => {
    const once = claimFreeze([THREE_DAYS, TWO_DAYS], [], NOW);
    const twice = claimFreeze([THREE_DAYS, TWO_DAYS], once, NOW);
    expect(twice).toBe(once);
  });

  it('returns the same array when there is nothing to claim, so no write is triggered', () => {
    const held: string[] = [];
    expect(claimFreeze([TODAY], held, NOW)).toBe(held);
  });
});

describe('what the freeze is worth', () => {
  it('keeps the run alive across the day it covered', () => {
    const played = [THREE_DAYS, TWO_DAYS, TODAY];
    expect(getDailyStreak(played, NOW)).toBe(1);
    const frozen = claimFreeze(played, [], NOW);
    expect(getDailyStreak([...played, ...frozen], NOW)).toBe(4);
  });

  it('is announced only while it is holding the current run up', () => {
    const played = [THREE_DAYS, TWO_DAYS, TODAY];
    expect(isFreezeProtecting(played, [YESTERDAY], NOW)).toBe(true);
    // A freeze spent on a run that has since ended is history, not news.
    expect(isFreezeProtecting([TODAY], ['20260701'], NOW)).toBe(false);
    expect(isFreezeProtecting(played, [], NOW)).toBe(false);
  });
});
