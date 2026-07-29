import { create } from 'zustand';
import { checkWin, rectOk, rectsOverlap } from '../game/geometry';
import type { Level, PlacedRect, RectColors, SolutionRect } from '../game/types';
import { playHaptic } from '../lib/haptics';

interface GameState {
  level: Level | null;
  placed: PlacedRect[];
  colorN: number;
  won: boolean;
  startedAt: number;
  hintsUsed: number;
  mistakes: number;
  loadLevel: (level: Level) => void;
  /** Starts the result clock on the player's first action, and is a no-op after that. */
  startClock: () => void;
  elapsedMs: () => number;
  placeRect: (rect: SolutionRect) => boolean;
  removeRectAt: (index: number) => void;
  undo: () => void;
  clear: () => void;
  hint: () => SolutionRect | null;
}

/**
 * Every mutation stops at `won`. The win sheet leaves the top of the board uncovered, so a
 * solved puzzle used to accept fresh rectangles: taking one apart flipped `won` back to
 * false, and re-solving it ran the win flow again — which paid the weekly and monthly goal
 * bonus a second time, since `goalsCompletedBy` reports the transition regardless of whether
 * that day was already recorded. Locking the board is the fix; the level ends with the solve.
 */
export const useGameStore = create<GameState>((set, get) => ({
  level: null,
  placed: [],
  colorN: 0,
  won: false,
  startedAt: 0,
  hintsUsed: 0,
  mistakes: 0,

  // `startedAt: 0` means "not started". The clock used to run from the moment the level
  // appeared, so reading the grid counted against the result; it now starts on the first
  // thing the player does to the board.
  loadLevel: level => set({ level, placed: [], colorN: 0, won: false, startedAt: 0, hintsUsed: 0, mistakes: 0 }),

  startClock: () => {
    if (get().startedAt) return;
    set({ startedAt: Date.now() });
  },

  elapsedMs: () => {
    const { startedAt } = get();
    return startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  },

  placeRect: rect => {
    const { placed, level, colorN, won: alreadyWon } = get();
    if (!level || alreadyWon) return false;
    get().startClock();
    if (placed.some(p => rectsOverlap(p, rect)) || !rectOk(rect, level)) {
      set(s => ({ mistakes: s.mistakes + 1 }));
      playHaptic('error');
      return false;
    }
    const next = [...placed, { ...rect, ci: colorN, colors: getRectColors(level, rect) }];
    const won = checkWin(next, level);
    set({ placed: next, colorN: colorN + 1, won });
    playHaptic(won ? 'success' : 'selection');
    return true;
  },

  removeRectAt: index => {
    const { placed, level, won } = get();
    if (won) return;
    get().startClock();
    const next = placed.filter((_, i) => i !== index);
    set({ placed: next, won: level ? checkWin(next, level) : false });
    playHaptic('selection');
  },

  undo: () => {
    const { placed, level, won } = get();
    if (won || !placed.length) return;
    const next = placed.slice(0, -1);
    set({ placed: next, won: level ? checkWin(next, level) : false });
    playHaptic('selection');
  },

  clear: () => {
    if (get().won) return;
    set({ placed: [], colorN: 0, won: false });
  },

  hint: () => {
    const { level, placed, colorN, won: alreadyWon } = get();
    if (!level || alreadyWon) return null;
    get().startClock();
    const avail = level.solution.filter(sol => !placed.some(p => sameRect(p, sol)) && !placed.some(p => rectsOverlap(p, sol)));
    if (!avail.length) return null;
    const pick = avail[0];
    const next = [...placed, { ...pick, ci: colorN, colors: getRectColors(level, pick) }];
    const won = checkWin(next, level);
    set({ placed: next, colorN: colorN + 1, hintsUsed: get().hintsUsed + 1, won });
    playHaptic(won ? 'success' : 'selection');
    return pick;
  },
}));

function sameRect(a: SolutionRect, b: SolutionRect): boolean {
  return a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
}

function getRectColors(level: Level, rect: SolutionRect): RectColors | undefined {
  const index = level.solution.findIndex(solution => sameRect(solution, rect));
  return index === -1 ? undefined : level.solutionColors?.[index];
}
