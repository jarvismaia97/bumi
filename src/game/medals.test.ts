import { describe, expect, it } from 'vitest';
import { getGoldTimeLimitMs, getMedalForResult, isBetterMedal } from './medals';

describe('level medals', () => {
  it('awards gold for a clean result within the time target', () => {
    expect(getGoldTimeLimitMs(4)).toBe(60_000);
    expect(getGoldTimeLimitMs(6)).toBe(84_000);
    expect(getMedalForResult({ durationMs: getGoldTimeLimitMs(6), hintsUsed: 0, mistakes: 0, size: 6 })).toBe('gold');
  });

  it('does not award gold above the tighter time target', () => {
    expect(getMedalForResult({ durationMs: getGoldTimeLimitMs(6) + 1, hintsUsed: 0, mistakes: 0, size: 6 })).not.toBe('gold');
  });

  it('awards silver when the result is within the allowance', () => {
    expect(getMedalForResult({ durationMs: 160_000, hintsUsed: 1, mistakes: 2, size: 6 })).toBe('silver');
  });

  it('awards bronze for a completed level outside the higher targets', () => {
    expect(getMedalForResult({ durationMs: 211_000, hintsUsed: 0, mistakes: 0, size: 6 })).toBe('bronze');
  });

  it('never replaces a higher medal with a lower one', () => {
    expect(isBetterMedal('silver', 'gold')).toBe(false);
    expect(isBetterMedal('gold', 'silver')).toBe(true);
  });
});
