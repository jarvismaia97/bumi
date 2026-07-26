import { describe, expect, it } from 'vitest';
import { checkWin, rectOk, rectsOverlap } from './geometry';
import { TUTORIAL_LEVELS } from './levels';
import type { PlacedRect } from './types';

describe('rectOk', () => {
  it('is true for a rect containing exactly one clue matching its area', () => {
    const rect = { r1: 0, c1: 0, r2: 1, c2: 2 };
    expect(rectOk(rect, TUTORIAL_LEVELS[0])).toBe(true);
  });

  it('is false when area does not match the clue value', () => {
    const rect = { r1: 0, c1: 0, r2: 1, c2: 1 };
    expect(rectOk(rect, TUTORIAL_LEVELS[0])).toBe(false);
  });

  it('is false when the rect contains no clue', () => {
    const rect = { r1: 2, c1: 2, r2: 3, c2: 3 };
    expect(rectOk(rect, TUTORIAL_LEVELS[2])).toBe(false);
  });

  it('requires the taught orientation in tutorial levels', () => {
    const rect = { r1: 0, c1: 0, r2: 2, c2: 1 };
    expect(rectOk(rect, TUTORIAL_LEVELS[0])).toBe(false);
  });
});

describe('rectsOverlap', () => {
  it('detects overlapping rects', () => {
    expect(rectsOverlap({ r1: 0, c1: 0, r2: 2, c2: 2 }, { r1: 1, c1: 1, r2: 3, c2: 3 })).toBe(true);
  });

  it('detects non-overlapping rects', () => {
    expect(rectsOverlap({ r1: 0, c1: 0, r2: 2, c2: 2 }, { r1: 2, c1: 2, r2: 4, c2: 4 })).toBe(false);
  });

  it('treats edge-adjacent rects as non-overlapping', () => {
    expect(rectsOverlap({ r1: 0, c1: 0, r2: 2, c2: 2 }, { r1: 0, c1: 2, r2: 2, c2: 4 })).toBe(false);
  });
});

describe('checkWin', () => {
  it('is true when the solution rects are placed', () => {
    const placed: PlacedRect[] = TUTORIAL_LEVELS[0].solution.map((r, i) => ({ ...r, ci: i }));
    expect(checkWin(placed, TUTORIAL_LEVELS[0])).toBe(true);
  });

  it('is false with no placed rects', () => {
    expect(checkWin([], TUTORIAL_LEVELS[0])).toBe(false);
  });

  it('is false when the grid is only partially covered', () => {
    const placed: PlacedRect[] = [{ ...TUTORIAL_LEVELS[2].solution[0], ci: 0 }];
    expect(checkWin(placed, TUTORIAL_LEVELS[2])).toBe(false);
  });

  it('is false when a placed rect does not satisfy its clue', () => {
    const placed: PlacedRect[] = [
      { r1: 0, c1: 0, r2: 1, c2: 1, ci: 0 },
      { ...TUTORIAL_LEVELS[0].solution[1], ci: 1 },
    ];
    expect(checkWin(placed, TUTORIAL_LEVELS[0])).toBe(false);
  });

  it('completes the logo tutorial by covering its 3 by 3 board', () => {
    const logo = TUTORIAL_LEVELS[2];
    const placed: PlacedRect[] = logo.solution.map((rect, ci) => ({ ...rect, ci }));
    expect(checkWin(placed, logo)).toBe(true);
  });
});
