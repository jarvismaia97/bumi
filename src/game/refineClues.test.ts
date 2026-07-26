import { describe, expect, it } from 'vitest';
import { getSolutionFingerprint } from './catalog';
import { genLevel } from './generator';
import { gradeLevel } from './logicSolver';
import { refineCluePositions } from './refineClues';
import { countSolutions } from './solver';
import type { HardLevel, Level } from './types';

function fairSamples(count: number, size: number, maxArea: number, hard: HardLevel, targetArea: number): Level[] {
  const out: Level[] = [];
  for (let seed = 0; out.length < count && seed < count * 20; seed++) {
    const level = genLevel(seed * 104_729 + 7, size, maxArea, hard, targetArea);
    if (gradeLevel(level).solvedByLogic) out.push(level);
  }
  return out;
}

describe('refineCluePositions', () => {
  const cases: { size: number; maxArea: number; hard: HardLevel; targetArea: number }[] = [
    { size: 9, maxArea: 8, hard: 1, targetArea: 2.8 },
    { size: 11, maxArea: 9, hard: 1, targetArea: 3.0 },
    { size: 12, maxArea: 12, hard: 2, targetArea: 2.9 },
  ];

  for (const { size, maxArea, hard, targetArea } of cases) {
    // The pass only moves clues inside the rectangles they already sit in, so the puzzle it
    // returns must be the same puzzle: same tiling, same numbers, still fair.
    it(`preserves the solution, the clue values and fairness (${size}x${size}, hard=${hard})`, () => {
      for (const level of fairSamples(8, size, maxArea, hard, targetArea)) {
        const refined = refineCluePositions(level);

        expect(getSolutionFingerprint(refined)).toBe(getSolutionFingerprint(level));
        expect(refined.clues.map(c => c.v)).toEqual(level.clues.map(c => c.v));
        expect(gradeLevel(refined).solvedByLogic).toBe(true);
        expect(countSolutions(refined, 2)).toBe(1);
      }
    });

    it(`keeps every clue inside its own rectangle (${size}x${size}, hard=${hard})`, () => {
      for (const level of fairSamples(8, size, maxArea, hard, targetArea)) {
        const refined = refineCluePositions(level);
        refined.clues.forEach((clue, ci) => {
          const rect = refined.solution[ci];
          expect(clue.r).toBeGreaterThanOrEqual(rect.r1);
          expect(clue.r).toBeLessThan(rect.r2);
          expect(clue.c).toBeGreaterThanOrEqual(rect.c1);
          expect(clue.c).toBeLessThan(rect.c2);
          expect((rect.r2 - rect.r1) * (rect.c2 - rect.c1)).toBe(clue.v);
        });
      }
    });

    it(`never lowers the grade (${size}x${size}, hard=${hard})`, () => {
      for (const level of fairSamples(8, size, maxArea, hard, targetArea)) {
        const before = gradeLevel(level).score;
        const after = gradeLevel(refineCluePositions(level)).score;
        expect(after).toBeGreaterThanOrEqual(before);
      }
    });
  }

  it('leaves a level that needs guessing untouched', () => {
    const ambiguous: Level = {
      size: 2,
      clues: [
        { r: 0, c: 0, v: 2 },
        { r: 1, c: 1, v: 2 },
      ],
      solution: [
        { r1: 0, c1: 0, r2: 1, c2: 2 },
        { r1: 1, c1: 0, r2: 2, c2: 2 },
      ],
    };
    expect(refineCluePositions(ambiguous)).toBe(ambiguous);
  });

  it('is deterministic', () => {
    const level = fairSamples(1, 11, 9, 1, 3.0)[0];
    expect(refineCluePositions(level)).toEqual(refineCluePositions(level));
  });

  it('actually finds better clue positions than the generator picked', () => {
    const levels = fairSamples(12, 12, 12, 2, 2.9);
    const improved = levels.filter(l => gradeLevel(refineCluePositions(l)).score > gradeLevel(l).score);
    expect(improved.length).toBeGreaterThan(levels.length / 2);
  });
});
