import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getDailyDateKey } from '@/game/daily';

interface ProgressState {
  solvedMap: Record<number, true>;
  hints: number;
  infiniteBest: number;
  dailyCompletedDate: string | null;
  markSolved: (idx: number) => boolean; // returns true if this was a new solve
  spendHint: () => void;
  setInfiniteBest: (count: number) => void;
  markDailyDone: () => void;
  isDailyDoneToday: () => boolean;
  isSolved: (idx: number) => boolean;
  solvedCount: () => number;
}

// This is the fix for the original prototype's core bug: `solved`, `hints`, and
// `infiniteCount` used to be plain in-memory JS variables that reset on every reload.
export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      solvedMap: {},
      hints: 3,
      infiniteBest: 0,
      dailyCompletedDate: null,

      markSolved: idx => {
        const alreadySolved = !!get().solvedMap[idx];
        if (alreadySolved) return false;
        set(s => ({
          solvedMap: { ...s.solvedMap, [idx]: true },
          hints: idx > 0 ? s.hints + 1 : s.hints,
        }));
        return true;
      },

      spendHint: () => set(s => ({ hints: Math.max(0, s.hints - 1) })),

      setInfiniteBest: count => set(s => ({ infiniteBest: Math.max(s.infiniteBest, count) })),

      markDailyDone: () => set({ dailyCompletedDate: getDailyDateKey() }),

      isDailyDoneToday: () => get().dailyCompletedDate === getDailyDateKey(),

      isSolved: idx => !!get().solvedMap[idx],

      solvedCount: () => Object.keys(get().solvedMap).length,
    }),
    {
      name: 'bumi-progress-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
