import { create } from 'zustand';
import { checkWin, rectsOverlap } from '@/game/geometry';
import type { Level, PlacedRect, SolutionRect } from '@/game/types';

interface GameState {
  level: Level | null;
  placed: PlacedRect[];
  colorN: number;
  won: boolean;
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

  loadLevel: level => set({ level, placed: [], colorN: 0, won: false }),

  placeRect: rect => {
    const { placed, level, colorN } = get();
    if (!level) return false;
    if (placed.some(p => rectsOverlap(p, rect))) return false;
    const next = [...placed, { ...rect, ci: colorN }];
    set({ placed: next, colorN: colorN + 1, won: checkWin(next, level) });
    return true;
  },

  removeRectAt: index => {
    const { placed, level } = get();
    const next = placed.filter((_, i) => i !== index);
    set({ placed: next, won: level ? checkWin(next, level) : false });
  },

  undo: () => {
    const { placed, level } = get();
    if (!placed.length) return;
    const next = placed.slice(0, -1);
    set({ placed: next, won: level ? checkWin(next, level) : false });
  },

  clear: () => set({ placed: [], colorN: 0, won: false }),

  hint: () => {
    const { level, placed, colorN } = get();
    if (!level) return null;
    const avail = level.solution.filter(sol => !placed.some(p => rectsOverlap(p, sol)));
    if (!avail.length) return null;
    const pick = avail[Math.floor(Math.random() * avail.length)];
    const next = [...placed, { ...pick, ci: colorN }];
    set({ placed: next, colorN: colorN + 1, won: checkWin(next, level) });
    return pick;
  },
}));
