import { describe, expect, it } from 'vitest';
import { rectOk, rectsOverlap } from './geometry';
import { genLevel, MAX_CLUE_VALUE } from './generator';
import type { HardLevel, SolutionRect } from './types';

// These tests document the generator's baseline self-consistency contract: the solution
// it builds must exactly tile the grid with no gaps/overlaps, and each solution rect must
// satisfy its own derived clue. They deliberately do NOT assert the puzzle has a unique
// solution — genLevel doesn't check that yet. Verifying/enforcing uniqueness is the job of
// the solver added in a later milestone, as a generation-time gate around this function.
describe('genLevel', () => {
  const cases: { size: number; maxArea: number; hard: HardLevel }[] = [
    { size: 4, maxArea: 8, hard: 0 },
    { size: 6, maxArea: 12, hard: 0 },
    { size: 8, maxArea: 9, hard: 0 },
    { size: 9, maxArea: 8, hard: 1 },
    { size: 11, maxArea: 10, hard: 2 },
    { size: 12, maxArea: 16, hard: 2 },
  ];

  for (const { size, maxArea, hard } of cases) {
    it(`tiles a ${size}x${size} grid exactly with no gaps/overlaps (hard=${hard})`, () => {
      for (let seed = 0; seed < 5; seed++) {
        const lvl = genLevel(seed * 1031 + 7, size, maxArea, hard);
        expect(lvl.size).toBe(size);

        const cov: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
        for (const rect of lvl.solution) {
          for (let r = rect.r1; r < rect.r2; r++) {
            for (let c = rect.c1; c < rect.c2; c++) {
              expect(cov[r][c]).toBe(false); // no overlap
              cov[r][c] = true;
            }
          }
        }
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            expect(cov[r][c]).toBe(true); // no gaps
          }
        }
      }
    });

    it(`every solution rect satisfies rectOk against its own clue (hard=${hard})`, () => {
      const lvl = genLevel(size * 1031 + 7, size, maxArea, hard);
      for (const rect of lvl.solution) {
        expect(rectOk(rect, lvl)).toBe(true);
      }
    });

    it(`solution rects pairwise don't overlap (hard=${hard})`, () => {
      const lvl = genLevel(size * 1031 + 7, size, maxArea, hard);
      for (let i = 0; i < lvl.solution.length; i++) {
        for (let j = i + 1; j < lvl.solution.length; j++) {
          expect(rectsOverlap(lvl.solution[i], lvl.solution[j])).toBe(false);
        }
      }
    });
  }

  it('is deterministic for a given seed', () => {
    const a = genLevel(12345, 8, 9, 1);
    const b = genLevel(12345, 8, 9, 1);
    expect(a).toEqual(b);
  });

  it('every rect has exactly one clue at its declared position', () => {
    const lvl = genLevel(555, 7, 10, 0);
    for (const rect of lvl.solution) {
      const cluesInside = lvl.clues.filter(
        cl => cl.r >= rect.r1 && cl.r < rect.r2 && cl.c >= rect.c1 && cl.c < rect.c2,
      );
      expect(cluesInside).toHaveLength(1);
    }
  });

  // A tiling is guillotine when some straight cut crosses the whole region without
  // splitting a piece, and each half is guillotine in turn. Recursive two-way splitting can
  // only produce these; a pinwheel cannot be cut this way at any level.
  function isGuillotine(rects: SolutionRect[], r1: number, c1: number, r2: number, c2: number): boolean {
    const inside = rects.filter(x => x.r1 >= r1 && x.c1 >= c1 && x.r2 <= r2 && x.c2 <= c2);
    if (inside.length <= 1) return true;

    for (let r = r1 + 1; r < r2; r++) {
      if (inside.some(x => x.r1 < r && x.r2 > r)) continue;
      return isGuillotine(inside, r1, c1, r, c2) && isGuillotine(inside, r, c1, r2, c2);
    }
    for (let c = c1 + 1; c < c2; c++) {
      if (inside.some(x => x.c1 < c && x.c2 > c)) continue;
      return isGuillotine(inside, r1, c1, r2, c) && isGuillotine(inside, r1, c, r2, c2);
    }
    return false;
  }

  it('produces non-guillotine layouts once the tier allows pinwheels (hard>=1)', () => {
    const levels = Array.from({ length: 60 }, (_, seed) => genLevel(seed * 104_729 + 7, 11, 9, 1));
    const pinwheeled = levels.filter(l => !isGuillotine(l.solution, 0, 0, l.size, l.size));
    expect(pinwheeled.length).toBeGreaterThan(0);
  });

  it('keeps Fácil layouts guillotine so early levels stay readable (hard=0)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const level = genLevel(seed * 104_729 + 7, 8, 9, 0);
      expect(isGuillotine(level.solution, 0, 0, level.size, level.size)).toBe(true);
    }
  });

  it('allows clue values through 16 when the tier permits them', () => {
    const values = new Set<number>();
    for (let seed = 0; seed < 120; seed++) {
      genLevel(seed * 104_729 + 7, 12, MAX_CLUE_VALUE, 2).clues.forEach(clue => values.add(clue.v));
    }
    expect(MAX_CLUE_VALUE).toBe(16);
    expect(values.has(15) || values.has(16)).toBe(true);
  });
});
