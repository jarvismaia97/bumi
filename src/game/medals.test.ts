import { describe, expect, it } from 'vitest';
import { getMedalForResult, getMistakeBudget, isBetterMedal } from './medals';

describe('level medals', () => {
  it('scales the mistake budget with the number of rectangles', () => {
    // Medians from the shipped catalogue: 6 rectangles at 4x4, 27 at 9x9, 47 at 12x12.
    expect(getMistakeBudget(6)).toEqual({ gold: 1, silver: 3 });
    expect(getMistakeBudget(27)).toEqual({ gold: 3, silver: 7 });
    expect(getMistakeBudget(47)).toEqual({ gold: 5, silver: 12 });
  });

  it('never drops the budget below the floor on a tiny board', () => {
    expect(getMistakeBudget(1)).toEqual({ gold: 1, silver: 3 });
    expect(getMistakeBudget(0)).toEqual({ gold: 1, silver: 3 });
  });

  it('awards gold for a hint-free solve inside the budget, however long it took', () => {
    expect(getMedalForResult({ hintsUsed: 0, mistakes: 0, rects: 47 })).toBe('gold');
    expect(getMedalForResult({ hintsUsed: 0, mistakes: 5, rects: 47 })).toBe('gold');
  });

  it('refuses gold to a solve that took a hint, clean or not', () => {
    expect(getMedalForResult({ hintsUsed: 1, mistakes: 0, rects: 47 })).toBe('silver');
  });

  it('drops to silver past the gold budget and to bronze past silver', () => {
    expect(getMedalForResult({ hintsUsed: 0, mistakes: 6, rects: 47 })).toBe('silver');
    expect(getMedalForResult({ hintsUsed: 0, mistakes: 13, rects: 47 })).toBe('bronze');
    expect(getMedalForResult({ hintsUsed: 2, mistakes: 0, rects: 47 })).toBe('bronze');
  });

  it('never replaces a higher medal with a lower one', () => {
    expect(isBetterMedal('silver', 'gold')).toBe(false);
    expect(isBetterMedal('gold', 'silver')).toBe(true);
  });
});
