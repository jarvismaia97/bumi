import { DIFFS } from './difficulty';
import { genLevel } from './generator';
import type { Level, LevelMeta } from './types';

// Build level metadata array (0-indexed), one entry per campaign level across all tiers.
export const LEVEL_META: LevelMeta[] = [];
DIFFS.forEach(d => {
  for (let i = 0; i < d.count; i++) {
    LEVEL_META.push({ label: d.label, size: d.size, maxArea: d.maxArea, hard: d.hard });
  }
});

// Hardcoded clean puzzle to avoid a bad generated seed at level 1.
export const HARDCODED_LEVELS: Record<number, Level> = {
  0: {
    size: 4,
    clues: [
      { r: 0, c: 2, v: 4 },
      { r: 1, c: 0, v: 4 },
      { r: 2, c: 3, v: 4 },
      { r: 3, c: 1, v: 4 },
    ],
    solution: [
      { r1: 0, c1: 0, r2: 1, c2: 4 },
      { r1: 1, c1: 0, r2: 3, c2: 2 },
      { r1: 1, c1: 2, r2: 3, c2: 4 },
      { r1: 3, c1: 0, r2: 4, c2: 4 },
    ],
  },
};

export const TUTORIAL_LEVEL: Level = {
  size: 3,
  clues: [
    { r: 0, c: 1, v: 3 },
    { r: 1, c: 0, v: 4 },
    { r: 1, c: 2, v: 2 },
  ],
  solution: [
    { r1: 0, c1: 0, r2: 1, c2: 3 },
    { r1: 1, c1: 0, r2: 3, c2: 2 },
    { r1: 1, c1: 2, r2: 3, c2: 3 },
  ],
};

const LEVEL_CACHE: Record<number, Level> = {};

// Generates campaign levels lazily and caches them, deterministic by index (seed = idx*1031+7).
export function getLevel(idx: number): Level {
  if (HARDCODED_LEVELS[idx]) return HARDCODED_LEVELS[idx];
  if (!LEVEL_CACHE[idx]) {
    const m = LEVEL_META[idx];
    LEVEL_CACHE[idx] = genLevel(idx * 1031 + 7, m.size, m.maxArea, m.hard);
  }
  return LEVEL_CACHE[idx];
}
