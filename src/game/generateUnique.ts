import { genLevel } from './generator';
import { gradeLevel, type LogicGrade } from './logicSolver';
import { refineCluePositions } from './refineClues';
import { isUnique } from './solver';
import type { ChallengeProfile, HardLevel, Level } from './types';

// Difficulty is measured with the human-technique solver (logicSolver.ts), not with the
// backtracking solver's node count. Two reasons:
//
//  - Fairness. A level the rules can't finish is one the player can only finish by guessing.
//    Those are now rejected outright rather than shipped because they happened to be unique.
//  - Range. Node count measures machine search and barely moves: across the 500 baked levels
//    it never separated tiers by more than board size. The technique ladder is a real scale —
//    the hardest rule a level forces you to reach is the same thing a player feels as hard.
//
// hard=0 with no challenge profile: take the first fair candidate — keeps early tiers gentle.
// Everything else: search the pool and keep the highest-graded candidate.
export interface GenerateOptions {
  maxAttempts?: number;
  /** Piece count to aim for. Campaign tiers set this; daily/infinite leave it off. */
  clueTarget?: number;
  /** Reject levels whose piece count falls outside [min, max]. */
  clueRange?: readonly [number, number];
  /**
   * Hill-climb the winning level's clue positions before returning it. Costs roughly 100ms
   * per level, so the baked campaign turns it on and the on-device modes do not.
   */
  refine?: boolean;
}

export function genUniqueLevel(
  seed: number,
  size: number,
  maxArea: number,
  hard: HardLevel = 0,
  challenge: ChallengeProfile = 0,
  options: GenerateOptions = {},
): Level {
  const { maxAttempts, clueTarget, clueRange, refine } = options;
  const attempts = maxAttempts ?? (challenge === 3 ? 180 : challenge === 2 ? 130 : challenge === 1 ? 80 : hard === 0 ? 40 : hard === 1 ? 100 : 160);
  const targetArea = clueTarget ? (size * size) / clueTarget : undefined;

  let lastAttempt: Level = genLevel(seed, size, maxArea, hard, targetArea);
  let best: Level | null = null;
  let bestScore = -Infinity;
  // Used only if nothing in the pool is solvable by logic: a unique-but-guessy level still
  // beats one with multiple solutions, which would be outright broken.
  let uniqueFallback: Level | null = null;

  for (let i = 0; i < attempts; i++) {
    const attempt = genLevel(seed + i * 7919, size, maxArea, hard, targetArea);
    lastAttempt = attempt;

    // Cheapest filter first — a level outside the tier's piece band is wrong for this slot
    // regardless of how well it grades.
    if (clueRange && (attempt.clues.length < clueRange[0] || attempt.clues.length > clueRange[1])) {
      continue;
    }

    const grade = gradeLevel(attempt);
    if (grade.needsGuess) {
      if (!uniqueFallback && isUnique(attempt)) uniqueFallback = attempt;
      continue;
    }
    // A level the rules solve outright is unique by construction — every step was forced,
    // so no second solution can exist. No separate uniqueness check needed here.

    if (hard === 0 && challenge === 0) return refine ? refineCluePositions(attempt) : attempt;

    const score = grade.score + challengeBonus(grade, challenge);
    if (score > bestScore) {
      best = attempt;
      bestScore = score;
    }
  }

  const winner = best ?? uniqueFallback ?? lastAttempt;
  // Refine only the winner, never every candidate — the hill climb costs about as much as
  // grading the whole pool, so running it inside the loop would be orders of magnitude
  // slower for no extra reach.
  return refine && best ? refineCluePositions(winner) : winner;
}

// Challenge profiles bias selection toward levels with more genuinely competing shapes per
// clue. `candidatesPerClue` is that count, measured by enumerating each clue's legal
// rectangles — it replaces the old hardcoded "ambiguous areas" list, which scored by clue
// value alone and so rated area 16 (three legal shapes on a 12-board) as highly as area 12
// (six). Weights sit below logicSolver's depth weight on purpose: reaching a harder
// technique always outranks having more candidates to sift.
function challengeBonus(grade: LogicGrade, challenge: ChallengeProfile): number {
  if (challenge === 0) return 0;
  const weight = challenge === 1 ? 60 : challenge === 2 ? 120 : 200;
  return grade.candidatesPerClue * weight;
}
