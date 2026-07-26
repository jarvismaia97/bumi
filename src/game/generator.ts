import { RNG } from './rng';
import type { Clue, HardLevel, Level, SolutionRect } from './types';

export const MAX_CLUE_VALUE = 16;

// How sharply the stopping probability decays once a region exceeds targetArea. Fitted
// against all 13 campaign tiers: at 2.2 the median piece count lands on each tier's target.
const TARGET_FALLOFF = 2.2;

// Odds of carving a region into a pinwheel rather than splitting it in two. Measured
// through the full selection pipeline: difficulty climbs with this value up to 0.8, then
// falls again — at 1.0 every region is a pinwheel, so layouts become uniform in a different
// way and the candidate pool loses the variety selection feeds on.
const PINWHEEL_CHANCE = 0.8;
// Smallest region worth pinwheeling. Below 6 the five pieces are slivers, and on a 4x4
// board there are only nine possible pinwheels at all — the Fácil tiers bump to hard=1 near
// their end, and at those odds every candidate collapsed onto the same few layouts, starving
// the campaign's distinct-solution dedupe.
const MIN_PINWHEEL_SIDE = 6;
/** Cut placements to try before giving up and falling back to an ordinary split. */
const PINWHEEL_CUT_ATTEMPTS = 6;

/**
 * Chance of stopping the recursion here and emitting this region as one piece.
 *
 * With a targetArea, the chance decays as the region grows past the target, so the piece
 * count distribution centres on the tier's band instead of sitting in its tail. Without one
 * (daily, infinite), the original hand-tuned ladder is used unchanged.
 */
function keepProbability(area: number, hard: HardLevel, targetArea?: number): number {
  if (targetArea !== undefined) {
    // Slivers are near-forced regardless of target — splitting them further buys nothing.
    if (area <= 2) return 0.95;
    return Math.min(1, (targetArea / area) ** TARGET_FALLOFF);
  }
  const keepBase = area <= 2 ? 0.95 : area <= 4 ? 0.8 : area <= 8 ? 0.65 : area <= 12 ? 0.5 : 0.74;
  return hard >= 2 ? keepBase * 0.55 : hard >= 1 ? keepBase * 0.7 : keepBase;
}

// Recursive space-partition generator.
//
// hard=0: random clue placement (easy)
// hard=1: max-ambiguity clue placement (forces deduction)
// hard=2: max-ambiguity + asymmetric splits (harder layout)
//
// targetArea (optional): average piece area to aim for. Campaign tiers pass this so their
// clue-count bands are hit by construction. Omitting it preserves the original behaviour.
//
// NOTE: this generator does not verify the resulting clue set has a unique solution —
// that verification is added by the solver (src/game/solver.ts) as a generation-time
// gate, not by changing this function.
export function genLevel(
  seed: number,
  size: number,
  maxArea: number,
  hard: HardLevel = 0,
  targetArea?: number,
): Level {
  const rng = new RNG(seed);
  const rects: (SolutionRect & { area: number; cr: number; cc: number })[] = [];

  // Returns the cell inside the rect that has the most possible covering rectangles
  // (maximises ambiguity — player can't easily guess the shape from the clue position)
  function hardestCell(r1: number, c1: number, r2: number, c2: number): [number, number] {
    const area = (r2 - r1) * (c2 - c1);
    const dims: [number, number][] = [];
    for (let w = 1; w <= area; w++) {
      if (area % w === 0) dims.push([w, area / w]);
    }
    let best: [number, number] = [r1, c1];
    let bestScore = -1;
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        let score = 0;
        for (const [w, h] of dims) {
          const rsMin = Math.max(0, r - h + 1);
          const rsMax = Math.min(size - h, r);
          const csMin = Math.max(0, c - w + 1);
          const csMax = Math.min(size - w, c);
          if (rsMax >= rsMin && csMax >= csMin) {
            score += (rsMax - rsMin + 1) * (csMax - csMin + 1);
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = [r, c];
        }
      }
    }
    return best;
  }

  function cluePos(r1: number, c1: number, r2: number, c2: number): [number, number] {
    if (hard >= 1) return hardestCell(r1, c1, r2, c2);
    return [rng.int(r1, r2 - 1), rng.int(c1, c2 - 1)];
  }

  /**
   * Carve a region into five pieces rotating around a centre, instead of cutting it in two.
   *
   *     +-------+---+
   *     |   A   | B |
   *     +---+---+   |
   *     | D | E |   |
   *     |   +---+---+
   *     |   |   C   |
   *     +---+-------+
   *
   * Recursive two-way splitting can only ever produce guillotine layouts — tilings where
   * some straight cut runs clean across the board. Those decompose: a player who resolves
   * one side learns nothing they needed from the other. A pinwheel admits no such cut. Its
   * five pieces constrain each other in a cycle, so none can be pinned down in isolation,
   * which is exactly the structure that forces the deeper deduction techniques.
   *
   * Returns false when the region is too small or the cuts would leave a 1x1 sliver, in
   * which case the caller falls back to an ordinary split.
   */
  function tryPinwheel(r1: number, c1: number, r2: number, c2: number): boolean {
    if (r2 - r1 < MIN_PINWHEEL_SIDE || c2 - c1 < MIN_PINWHEEL_SIDE) return false;

    for (let attempt = 0; attempt < PINWHEEL_CUT_ATTEMPTS; attempt++) {
      const y1 = rng.int(r1 + 1, r2 - 2);
      const y2 = rng.int(y1 + 1, r2 - 1);
      const x1 = rng.int(c1 + 1, c2 - 2);
      const x2 = rng.int(x1 + 1, c2 - 1);

      const pieces: [number, number, number, number][] = [
        [r1, c1, y1, x2], // A — top arm
        [r1, x2, y2, c2], // B — right arm
        [y2, x1, r2, c2], // C — bottom arm
        [y1, c1, r2, x1], // D — left arm
        [y1, x1, y2, x2], // E — centre
      ];
      if (pieces.some(([pr1, pc1, pr2, pc2]) => (pr2 - pr1) * (pc2 - pc1) < 2)) continue;

      for (const [pr1, pc1, pr2, pc2] of pieces) place(pr1, pc1, pr2, pc2);
      return true;
    }
    return false;
  }

  function place(r1: number, c1: number, r2: number, c2: number): void {
    const rows = r2 - r1;
    const cols = c2 - c1;
    const area = rows * cols;
    const canH = rows >= 2;
    const canV = cols >= 2;

    if (area <= maxArea && area <= MAX_CLUE_VALUE) {
      // The old code floored the keep chance at 0.6 for area>=15 on hard>=2, meaning the
      // top tiers stopped splitting their biggest regions. That produced *fewer, fatter*
      // pieces (Lenda averaged 30 clues on a 12x12) and made the last 200 campaign levels
      // measurably easier than the middle. Shikaku ambiguity comes from many interacting
      // mid-size pieces, not a handful of large ones, so the floor is gone.
      const keep = keepProbability(area, hard, targetArea);
      if (rng.next() < keep || (!canH && !canV)) {
        const [cr, cc] = cluePos(r1, c1, r2, c2);
        rects.push({ r1, c1, r2, c2, area, cr, cc });
        return;
      }
    }

    // Tiers past the tutorial get non-guillotine structure. Fácil stays on plain two-way
    // splits: its levels are meant to be readable at a glance.
    //
    // Applied at every scale, not just near the leaves. Restricting it to leaf-sized
    // regions was tried on the theory that only pinwheels between actual clues matter, and
    // it measured worse (T3+ 25.8% vs 35.0% at the same odds): pinwheeling high in the
    // recursion skews the arms into shapes ordinary splitting never makes, and those feed
    // the recursion below them too.
    if (hard >= 1 && rng.next() < PINWHEEL_CHANCE && tryPinwheel(r1, c1, r2, c2)) return;

    // Only split along an axis that won't produce a 1×1 sub-region.
    const safeH = canH && (cols >= 2 || rows >= 4);
    const safeV = canV && (rows >= 2 || cols >= 4);

    if (!safeH && !safeV) {
      const [cr, cc] = cluePos(r1, c1, r2, c2);
      rects.push({ r1, c1, r2, c2, area, cr, cc });
      return;
    }

    if (safeH && (!safeV || rng.next() < 0.5)) {
      const lo = r1 + (cols < 2 ? 2 : 1);
      const hi = r2 - (cols < 2 ? 2 : 1);
      let mid: number;
      if (hard >= 2 && hi > lo) {
        // Large late-game regions also use 5/7-ish splits, making 3x5 (15)
        // and 4x4 (16) rectangles available without exceeding a 12x12 board.
        const ratios = maxArea >= 15 ? [0.28, 0.42, 0.58, 0.72] : [0.28, 0.72];
        const q = ratios[Math.floor(rng.next() * ratios.length)];
        mid = Math.max(lo, Math.min(hi, r1 + Math.round((r2 - r1) * q)));
      } else {
        mid = rng.int(lo, hi);
      }
      place(r1, c1, mid, c2);
      place(mid, c1, r2, c2);
    } else {
      const lo = c1 + (rows < 2 ? 2 : 1);
      const hi = c2 - (rows < 2 ? 2 : 1);
      let mid: number;
      if (hard >= 2 && hi > lo) {
        const ratios = maxArea >= 15 ? [0.28, 0.42, 0.58, 0.72] : [0.28, 0.72];
        const q = ratios[Math.floor(rng.next() * ratios.length)];
        mid = Math.max(lo, Math.min(hi, c1 + Math.round((c2 - c1) * q)));
      } else {
        mid = rng.int(lo, hi);
      }
      place(r1, c1, r2, mid);
      place(r1, mid, r2, c2);
    }
  }

  place(0, 0, size, size);

  const clues: Clue[] = rects.map(r => ({ r: r.cr, c: r.cc, v: r.area }));
  const solution: SolutionRect[] = rects.map(({ r1, c1, r2, c2 }) => ({ r1, c1, r2, c2 }));
  return { size, clues, solution };
}
