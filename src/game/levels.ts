import { getCampaignLevelMeta } from './difficulty';
import { CAMPAIGN_LEVELS } from './levels.data';
import type { Level, LevelMeta } from './types';

// Build level metadata array (0-indexed), one entry per campaign level across all tiers.
export const LEVEL_META: LevelMeta[] = getCampaignLevelMeta();

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

const LOGO_BLUE = '#a8b9d8';
const LOGO_YELLOW = { fill: '#f6ed94', border: '#d7cb62' };
const LOGO_WHITE = { fill: '#fffefd', border: '#7894c7' };
const LOGO_GREEN = { fill: '#9fcf9b', border: '#6eaf6d' };

export const TUTORIAL_LEVELS: Level[] = [
  {
    size: 2,
    rows: 1,
    columns: 2,
    clues: [{ r: 0, c: 0, v: 2 }],
    solution: [{ r1: 0, c1: 0, r2: 1, c2: 2 }],
    solutionColors: [LOGO_YELLOW],
    emptyFillColor: LOGO_BLUE,
    requiresExactSolution: true,
  },
  {
    size: 2,
    clues: [{ r: 0, c: 0, v: 4 }],
    solution: [{ r1: 0, c1: 0, r2: 2, c2: 2 }],
    solutionColors: [LOGO_WHITE],
    emptyFillColor: LOGO_BLUE,
    requiresExactSolution: true,
  },
  {
    size: 3,
    clues: [{ r: 0, c: 0, v: 2 }, { r: 1, c: 0, v: 4 }, { r: 0, c: 2, v: 3 }],
    solution: [
      { r1: 0, c1: 0, r2: 1, c2: 2 },
      { r1: 1, c1: 0, r2: 3, c2: 2 },
      { r1: 0, c1: 2, r2: 3, c2: 3 },
    ],
    solutionColors: [LOGO_YELLOW, LOGO_WHITE, LOGO_GREEN],
    emptyFillColor: LOGO_BLUE,
    requiresExactSolution: true,
  },
];

export const TUTORIAL_LEVEL = TUTORIAL_LEVELS[0];

// Campaign levels are precomputed offline (scripts/generateLevels.ts) with a
// uniqueness-verifying solver gate and baked into levels.data.ts.
export function getLevel(idx: number): Level {
  return HARDCODED_LEVELS[idx] ?? CAMPAIGN_LEVELS[idx];
}
