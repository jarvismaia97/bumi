export type Medal = 'gold' | 'silver' | 'bronze';

export interface LevelResult {
  hintsUsed: number;
  mistakes: number;
  /** How many rectangles the solution has, which is what the mistake budget scales with. */
  rects: number;
}

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

/**
 * Medals used to be gated on time: 60s plus 12s per size step. The rectangle count grows far
 * faster than that allowance, so the target tightened as levels grew — 10s per rectangle on a
 * 4x4, 3.3s on a 12x12, reading the grid included. Gold was effectively closed on the large
 * levels, and a careful, hint-free solve scored bronze for being slow, which is the opposite
 * of what the medal should say.
 *
 * What it says now is how cleanly the puzzle was solved. Time is still recorded and shown; it
 * just no longer decides. A hint hands the player a whole rectangle, so gold still refuses one.
 */
const GOLD_MISTAKE_SHARE = 0.1;
const SILVER_MISTAKE_SHARE = 0.25;
const GOLD_MISTAKE_FLOOR = 1;
const SILVER_MISTAKE_FLOOR = 3;

export interface MistakeBudget {
  gold: number;
  silver: number;
}

/**
 * A flat budget would be severe on a 12x12 — 47 rectangles, three mistakes — and generous on
 * a 4x4, where three is half the board. Scaling by rectangle count keeps the same demand on
 * both: 1 mistake at 4x4, 5 at 12x12.
 */
export function getMistakeBudget(rects: number): MistakeBudget {
  const pieces = Math.max(1, rects);
  return {
    gold: Math.max(GOLD_MISTAKE_FLOOR, Math.round(pieces * GOLD_MISTAKE_SHARE)),
    silver: Math.max(SILVER_MISTAKE_FLOOR, Math.round(pieces * SILVER_MISTAKE_SHARE)),
  };
}

export function getMedalForResult({ hintsUsed, mistakes, rects }: LevelResult): Medal {
  const budget = getMistakeBudget(rects);
  if (hintsUsed === 0 && mistakes <= budget.gold) return 'gold';
  if (hintsUsed <= 1 && mistakes <= budget.silver) return 'silver';
  return 'bronze';
}

export function isBetterMedal(next: Medal, current?: Medal): boolean {
  return !current || MEDAL_RANK[next] > MEDAL_RANK[current];
}

export function formatResultDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}
