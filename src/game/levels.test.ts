import { describe, expect, it } from 'vitest';
import { DIFFS } from './difficulty';
import { getLevel, HARDCODED_LEVELS, LEVEL_META } from './levels';
import { checkWin } from './geometry';
import type { PlacedRect } from './types';

describe('LEVEL_META', () => {
  it('has one entry per level across all difficulty tiers', () => {
    const expectedTotal = DIFFS.reduce((sum, d) => sum + d.count, 0);
    expect(LEVEL_META).toHaveLength(expectedTotal);
  });
});

describe('getLevel', () => {
  it('returns the hardcoded level 0 unchanged', () => {
    expect(getLevel(0)).toEqual(HARDCODED_LEVELS[0]);
  });

  it('is deterministic across repeated calls (lazy cache)', () => {
    const a = getLevel(50);
    const b = getLevel(50);
    expect(a).toEqual(b);
  });

  it('generated levels are solvable by their own solution', () => {
    for (const idx of [1, 20, 100, 250, LEVEL_META.length - 1]) {
      const lvl = getLevel(idx);
      const placed: PlacedRect[] = lvl.solution.map((r, i) => ({ ...r, ci: i }));
      expect(checkWin(placed, lvl)).toBe(true);
    }
  });

  it('generated level size/hard matches its LEVEL_META entry', () => {
    const idx = 42;
    const lvl = getLevel(idx);
    expect(lvl.size).toBe(LEVEL_META[idx].size);
  });
});
