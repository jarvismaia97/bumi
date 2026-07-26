import { create } from 'zustand';
import { checkWin, rectOk, rectsOverlap } from '../game/geometry';
import type { Level, PlacedRect, RectColors, SolutionRect } from '../game/types';
import { playGameHaptic } from '../lib/gameHaptics';

interface GameState {
  level: Level | null;
  placed: PlacedRect[];
  colorN: number;
  won: boolean;
  startedAt: number;
  hintsUsed: number;
  mistakes: number;
  loadLevel: (level: Level) => void;
  placeRect: (rect: SolutionRect) => boolean;
  removeRectAt: (index: number) => void;
  undo: () => void;
  clear: () => void;
  hint: () => SolutionRect | null;
}

export const useGameStore = create<GameState>((set, get) => ({
  level: null,
  placed: [],
  colorN: 0,
  won: false,
  startedAt: 0,
  hintsUsed: 0,
  mistakes: 0,

  loadLevel: level => set({ level, placed: [], colorN: 0, won: false, startedAt: Date.now(), hintsUsed: 0, mistakes: 0 }),

  placeRect: rect => {
    const { placed, level, colorN } = get();
    if (!level) return false;
    if (placed.some(p => rectsOverlap(p, rect)) || !rectOk(rect, level)) {
      set(s => ({ mistakes: s.mistakes + 1 }));
      playGameHaptic('error');
      return false;
    }
    const next = [...placed, { ...rect, ci: colorN, colors: getRectColors(level, rect) }];
    const won = checkWin(next, level);
    set({ placed: next, colorN: colorN + 1, won });
    playGameHaptic(won ? 'success' : 'selection');
    return true;
  },

  removeRectAt: index => {
    const { placed, level } = get();
    const next = placed.filter((_, i) => i !== index);
    set({ placed: next, won: level ? checkWin(next, level) : false });
    playGameHaptic('selection');
  },

  undo: () => {
    const { placed, level } = get();
    if (!placed.length) return;
    const next = placed.slice(0, -1);
    set({ placed: next, won: level ? checkWin(next, level) : false });
    playGameHaptic('selection');
  },

  clear: () => set({ placed: [], colorN: 0, won: false }),

  hint: () => {
    const { level, placed, colorN } = get();
    if (!level) return null;
    const avail = level.solution.filter(sol => !placed.some(p => sameRect(p, sol)) && !placed.some(p => rectsOverlap(p, sol)));
    if (!avail.length) return null;
    const pick = avail[0];
    const next = [...placed, { ...pick, ci: colorN, colors: getRectColors(level, pick) }];
    const won = checkWin(next, level);
    set({ placed: next, colorN: colorN + 1, hintsUsed: get().hintsUsed + 1, won });
    playGameHaptic(won ? 'success' : 'selection');
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
