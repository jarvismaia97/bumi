import { gradeLevel, type LogicGrade } from './logicSolver';
import type { Clue, Level } from './types';

// Clue-position hill climbing.
//
// The generator decides where each number sits with `hardestCell` (generator.ts): for each
// rectangle independently, the cell covered by the most board-legal placements. That
// optimises a proxy — placements that fit between the board edges — and it does so blind to
// every other clue, in generation order, without ever revisiting a choice. Two neighbouring
// clues can each be individually "hardest" while jointly collapsing in a single deduction.
//
// This pass keeps the tiling frozen and moves clues around inside their own rectangles,
// keeping any move that raises the measured grade. Every candidate position is legal by
// construction: the clue never leaves its rectangle, so the solution, the piece count, and
// the clue values are all unchanged — only ambiguity moves. Unlike `hardestCell` it
// optimises the real metric rather than a stand-in for it.

/** Sweeps over every clue before giving up. Gains flatten quickly; 4 is well past the knee. */
const MAX_PASSES = 4;

/**
 * Returns a level with the same solution and the same clue values, with clue positions
 * chosen to maximise `gradeLevel`'s score. Levels that already need a guess are returned
 * untouched — there is nothing to preserve, and the caller should be rejecting them.
 */
export function refineCluePositions(level: Level): Level {
  let bestGrade = gradeLevel(level);
  if (bestGrade.needsGuess) return level;

  let bestClues = level.clues;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let ci = 0; ci < bestClues.length; ci++) {
      const rect = level.solution[ci];

      for (let r = rect.r1; r < rect.r2; r++) {
        for (let c = rect.c1; c < rect.c2; c++) {
          // Re-read each time: an accepted move earlier in this rectangle changes it.
          const current = bestClues[ci];
          if (r === current.r && c === current.c) continue;

          const clues: Clue[] = bestClues.slice();
          clues[ci] = { r, c, v: current.v };
          const candidate: Level = { ...level, clues };

          const grade: LogicGrade = gradeLevel(candidate);
          // A move that costs fairness is never worth taking, however well it scores.
          if (!grade.solvedByLogic || grade.score <= bestGrade.score) continue;

          bestClues = clues;
          bestGrade = grade;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return bestClues === level.clues ? level : { ...level, clues: bestClues };
}
