import { describe, expect, it } from 'vitest';
import { findRepeatedSolutionIndexes } from './catalog';
import { DIFFS, getCampaignLevelMeta } from './difficulty';
import { getLevel, HARDCODED_LEVELS, LEVEL_META } from './levels';
import { checkWin } from './geometry';
import type { PlacedRect } from './types';

describe('LEVEL_META', () => {
  it('has one entry per level across all difficulty tiers', () => {
    const expectedTotal = DIFFS.reduce((sum, d) => sum + d.count, 0);
    expect(LEVEL_META).toHaveLength(expectedTotal);
  });

  it('makes every tenth campaign level an extra-hard milestone', () => {
    expect(LEVEL_META).toEqual(getCampaignLevelMeta());
    LEVEL_META.forEach((level, idx) => {
      expect(level.milestone).toBe((idx + 1) % 10 === 0);
      if (level.milestone) expect(level.hard).toBe(2);
    });
  });

  // Levels 1-70 are the teaching run: all of Fácil plus the first Médio tier. Challenge
  // profiles bias generation toward the hardest candidate in the pool, which is wrong for
  // levels a new player meets first.
  it('introduces the advanced challenge profile from level 71 onward', () => {
    expect(LEVEL_META.slice(0, 70).every(level => level.challenge === 0)).toBe(true);
    expect(LEVEL_META[70].challenge).toBe(1);
    expect(LEVEL_META[99].challenge).toBe(3);
    expect(LEVEL_META[199].challenge).toBe(3);
    expect(LEVEL_META.at(-1)?.challenge).toBe(3);
  });

  it('gives every tier a reachable piece-count band', () => {
    LEVEL_META.forEach(level => {
      const [min, max] = level.clueRange;
      expect(min).toBeLessThanOrEqual(level.clueTarget);
      expect(max).toBeGreaterThanOrEqual(level.clueTarget);
      // A band demanding more pieces than the board has cells is unsatisfiable — the
      // degenerate case that a single shared band across board sizes produces.
      expect(max).toBeLessThan(level.size * level.size);
    });
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

  it('never repeats a solved rectangle layout in the campaign', () => {
    const campaign = Array.from({ length: LEVEL_META.length }, (_, idx) => getLevel(idx));
    expect(findRepeatedSolutionIndexes(campaign)).toEqual([]);
  });

  it('keeps all campaign boards at a touch-friendly 12x12 maximum', () => {
    expect(Math.max(...LEVEL_META.map(level => level.size))).toBe(12);
  });

  it('includes the 15 and 16 clue values in the late campaign', () => {
    const values = new Set(Array.from({ length: LEVEL_META.length }, (_, idx) => getLevel(idx)).flatMap(level => level.clues.map(clue => clue.v)));
    expect(values.has(15)).toBe(true);
    expect(values.has(16)).toBe(true);
  });
});
