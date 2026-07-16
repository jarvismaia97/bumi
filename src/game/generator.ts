import { RNG } from './rng';
import type { Clue, HardLevel, Level, SolutionRect } from './types';

// Recursive space-partition generator, ported verbatim from the original prototype.
//
// hard=0: random clue placement (easy)
// hard=1: max-ambiguity clue placement (forces deduction)
// hard=2: max-ambiguity + asymmetric splits (harder layout)
//
// NOTE: this generator does not verify the resulting clue set has a unique solution —
// that verification is added by the solver (src/game/solver.ts) as a generation-time
// gate, not by changing this function. Kept unchanged here deliberately so Milestone 1
// ships with identical puzzle behavior to the original prototype.
export function genLevel(seed: number, size: number, maxArea: number, hard: HardLevel = 0): Level {
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

  function place(r1: number, c1: number, r2: number, c2: number): void {
    const rows = r2 - r1;
    const cols = c2 - c1;
    const area = rows * cols;
    const canH = rows >= 2;
    const canV = cols >= 2;

    if (area <= maxArea && area <= 14) {
      const keep = area <= 2 ? 0.95 : area <= 4 ? 0.8 : area <= 8 ? 0.65 : 0.5;
      if (rng.next() < keep || (!canH && !canV)) {
        const [cr, cc] = cluePos(r1, c1, r2, c2);
        rects.push({ r1, c1, r2, c2, area, cr, cc });
        return;
      }
    }

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
        // Asymmetric cut: ~25% or ~75% — creates more ambiguous layouts
        const q = rng.next() < 0.5 ? 0.28 : 0.72;
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
        const q = rng.next() < 0.5 ? 0.28 : 0.72;
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
