import { describe, expect, it } from 'vitest';
import { rectOk, rectsOverlap } from './geometry';
import { genLevel } from './generator';
import type { HardLevel } from './types';

// These tests document the generator's baseline self-consistency contract: the solution
// it builds must exactly tile the grid with no gaps/overlaps, and each solution rect must
// satisfy its own derived clue. They deliberately do NOT assert the puzzle has a unique
// solution — genLevel doesn't check that yet. Verifying/enforcing uniqueness is the job of
// the solver added in a later milestone, as a generation-time gate around this function.
describe('genLevel', () => {
  const cases: Array<{ size: number; maxArea: number; hard: HardLevel }> = [
    { size: 4, maxArea: 8, hard: 0 },
    { size: 6, maxArea: 12, hard: 0 },
    { size: 8, maxArea: 9, hard: 0 },
    { size: 9, maxArea: 8, hard: 1 },
    { size: 11, maxArea: 10, hard: 2 },
    { size: 14, maxArea: 14, hard: 2 },
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
});
