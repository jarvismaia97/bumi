import { describe, expect, it } from 'vitest';
import { getSolutionFingerprint } from './catalog';
import { genLevel } from './generator';
import { GUESS_REQUIRED, gradeLevel, solveByLogic } from './logicSolver';
import { countSolutions } from './solver';
import type { HardLevel, Level } from './types';

function sample(count: number, size: number, maxArea: number, hard: HardLevel): Level[] {
  return Array.from({ length: count }, (_, seed) => genLevel(seed * 104_729 + 7, size, maxArea, hard));
}

describe('gradeLevel', () => {
  const cases: { size: number; maxArea: number; hard: HardLevel }[] = [
    { size: 4, maxArea: 8, hard: 0 },
    { size: 7, maxArea: 10, hard: 0 },
    { size: 9, maxArea: 8, hard: 1 },
    { size: 12, maxArea: 16, hard: 2 },
  ];

  for (const { size, maxArea, hard } of cases) {
    // Soundness is the whole contract: the rules must only ever make forced deductions. If
    // they derive a tiling at all it has to be *the* tiling, and the puzzle has to be unique.
    it(`derives the generator's own solution whenever it solves (${size}x${size}, hard=${hard})`, () => {
      for (const level of sample(25, size, maxArea, hard)) {
        const derived = solveByLogic(level);
        if (!derived) continue;
        expect(getSolutionFingerprint({ size: level.size, solution: derived })).toBe(
          getSolutionFingerprint(level),
        );
      }
    });

    it(`only claims solvable for puzzles the backtracking solver agrees are unique (${size}x${size}, hard=${hard})`, () => {
      for (const level of sample(25, size, maxArea, hard)) {
        if (!gradeLevel(level).solvedByLogic) continue;
        expect(countSolutions(level, 2)).toBe(1);
      }
    });
  }

  it('reports GUESS_REQUIRED and no solution when the rules stall', () => {
    // A level with multiple solutions can never be resolved by forced deduction alone.
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
    expect(countSolutions(ambiguous, 3)).toBeGreaterThan(1);

    const grade = gradeLevel(ambiguous);
    expect(grade.needsGuess).toBe(true);
    expect(grade.solvedByLogic).toBe(false);
    expect(grade.deepest).toBe(GUESS_REQUIRED);
    expect(solveByLogic(ambiguous)).toBeNull();
  });

  it('grades a single-clue board as needing no deduction beyond the forced shape', () => {
    const trivial: Level = {
      size: 2,
      clues: [{ r: 0, c: 0, v: 4 }],
      solution: [{ r1: 0, c1: 0, r2: 2, c2: 2 }],
    };
    const grade = gradeLevel(trivial);
    expect(grade.solvedByLogic).toBe(true);
    expect(grade.deepest).toBe(1);
    expect(grade.steps[0]).toBe(1);
  });

  it('is deterministic', () => {
    const level = genLevel(4242, 9, 9, 1);
    expect(gradeLevel(level)).toEqual(gradeLevel(level));
  });

  it('measures more candidates per clue on a loose board than a tight one', () => {
    const loose = sample(20, 12, 16, 2);
    const tight = sample(20, 12, 6, 2);
    const mean = (levels: Level[]) =>
      levels.reduce((sum, l) => sum + gradeLevel(l, { lookahead: false }).candidatesPerClue, 0) / levels.length;
    expect(mean(loose)).toBeGreaterThan(mean(tight));
  });

  it('scores a deeper technique above any amount of shallower work', () => {
    const shallow = { deepest: 2, steps: [200, 200, 0, 0] as [number, number, number, number] };
    const deep = { deepest: 3, steps: [1, 1, 1, 0] as [number, number, number, number] };
    // Mirrors logicSolver's weighting: depth dominates, step counts only break ties.
    const score = (g: typeof shallow) =>
      g.deepest * 10_000 + g.steps[3] * 60 + g.steps[2] * 12 + g.steps[1] * 4 + g.steps[0];
    expect(score(deep)).toBeGreaterThan(score(shallow));
  });
});
