import type { Level, PlacedRect, SolutionRect } from './types';

// A rect is "ok" if it contains exactly one clue and its area matches that clue's value.
export function rectOk(rect: SolutionRect, lvl: Level): boolean {
  const { r1, c1, r2, c2 } = rect;
  const area = (r2 - r1) * (c2 - c1);
  let n = 0;
  let v = 0;
  for (const cl of lvl.clues) {
    if (cl.r >= r1 && cl.r < r2 && cl.c >= c1 && cl.c < c2) {
      n++;
      v = cl.v;
    }
  }
  return n === 1 && area === v;
}

export function rectsOverlap(a: SolutionRect, b: SolutionRect): boolean {
  return !(a.r2 <= b.r1 || b.r2 <= a.r1 || a.c2 <= b.c1 || b.c2 <= a.c1);
}

export function checkWin(placed: PlacedRect[], lvl: Level): boolean {
  if (!placed.length) return false;
  const { size } = lvl;
  const cov: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  for (const rect of placed) {
    if (!rectOk(rect, lvl)) return false;
    const { r1, c1, r2, c2 } = rect;
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        cov[r][c] = true;
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!cov[r][c]) return false;
    }
  }
  return true;
}
