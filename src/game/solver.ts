import type { Level } from './types';

export interface SolveInfo {
  count: number;
  // Backtrack nodes visited to reach `count`. A puzzle the solver has to explore more
  // to rule out alternatives is, in practice, one that takes more deduction from a human
  // too — used as a real difficulty signal in generateUnique.ts, not just a uniqueness gate.
  nodes: number;
}

// Backtracking Shikaku solver: counts distinct solutions up to `cap`, used as a
// generation-time gate (see generateUnique.ts) to reject ambiguous puzzles.
// Strategy: always resolve the first uncovered cell — it must belong to exactly one
// still-unplaced clue's rectangle, so branching only happens on genuinely ambiguous cells.
export function solve(level: Level, cap = 2, nodeBudget = 400_000): SolveInfo {
  const { size, clues } = level;
  const n = clues.length;
  const covered: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const used: boolean[] = Array(n).fill(false);
  let count = 0;
  let nodes = 0;

  function firstEmpty(): [number, number] | null {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!covered[r][c]) return [r, c];
      }
    }
    return null;
  }

  function fits(r1: number, c1: number, r2: number, c2: number): boolean {
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        if (covered[r][c]) return false;
      }
    }
    return true;
  }

  function paint(r1: number, c1: number, r2: number, c2: number, mark: boolean): void {
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) covered[r][c] = mark;
    }
  }

  function backtrack(): void {
    if (count >= cap || nodes++ > nodeBudget) return;
    const cell = firstEmpty();
    if (!cell) {
      count++;
      return;
    }
    const [er, ec] = cell;

    for (let ci = 0; ci < n; ci++) {
      if (used[ci]) continue;
      const clue = clues[ci];
      const area = clue.v;

      for (let w = 1; w <= area; w++) {
        if (area % w !== 0) continue;
        const h = area / w;
        if (w > size || h > size) continue;

        const r1min = Math.max(0, clue.r - h + 1, er - h + 1);
        const r1max = Math.min(size - h, clue.r, er);
        const c1min = Math.max(0, clue.c - w + 1, ec - w + 1);
        const c1max = Math.min(size - w, clue.c, ec);

        for (let r1 = r1min; r1 <= r1max; r1++) {
          const r2 = r1 + h;
          for (let c1 = c1min; c1 <= c1max; c1++) {
            const c2 = c1 + w;
            if (!(clue.r >= r1 && clue.r < r2 && clue.c >= c1 && clue.c < c2)) continue;
            if (!(er >= r1 && er < r2 && ec >= c1 && ec < c2)) continue;
            if (!fits(r1, c1, r2, c2)) continue;

            let otherClueInside = false;
            for (let cj = 0; cj < n; cj++) {
              if (cj === ci) continue;
              const o = clues[cj];
              if (o.r >= r1 && o.r < r2 && o.c >= c1 && o.c < c2) {
                otherClueInside = true;
                break;
              }
            }
            if (otherClueInside) continue;

            used[ci] = true;
            paint(r1, c1, r2, c2, true);
            backtrack();
            paint(r1, c1, r2, c2, false);
            used[ci] = false;
            if (count >= cap) return;
          }
        }
      }
    }
  }

  backtrack();
  return { count, nodes };
}

export function countSolutions(level: Level, cap = 2, nodeBudget = 400_000): number {
  return solve(level, cap, nodeBudget).count;
}

export function isUnique(level: Level): boolean {
  return countSolutions(level, 2) === 1;
}
