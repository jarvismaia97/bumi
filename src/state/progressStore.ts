import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getDailyDateKey, getDailyStreak } from '@/game/daily';
import { INITIAL_HINTS, isMilestoneLevel, MAX_HINTS, normalizeHintCount } from '@/game/hints';
import { goalRewardHints, goalsCompletedBy } from '@/game/goals';
import { isBetterMedal, type Medal } from '@/game/medals';

const CAMPAIGN_CATALOG_VERSION = 3;
const PROGRESS_STORE_VERSION = 4;

function migrateCampaignProgress(persistedState: unknown, version: number): unknown {
  if (version >= CAMPAIGN_CATALOG_VERSION || !persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as { solvedMap?: Record<number, true> };
  const solvedCount = Object.keys(state.solvedMap ?? {}).length;
  const solvedMap = Object.fromEntries(Array.from({ length: solvedCount }, (_, idx) => [idx, true])) as Record<number, true>;

  // The puzzles changed, but a player's campaign position should remain intact.
  // Medals depend on the exact puzzle and are reset for the new catalogue.
  return { ...state, solvedMap, levelMedals: {} };
}

interface ProgressState {
  solvedMap: Record<number, true>;
  solvedDateMap: Record<number, string>;
  hints: number;
  infiniteBest: number;
  dailyCompletedDate: string | null;
  dailyCompletionDates: string[];
  levelMedals: Record<number, Medal>;
  iosInstallPromptSeen: boolean;
  dailyReminderEnabled: boolean;
  markSolved: (idx: number) => boolean; // returns true if this was a new solve
  spendHint: () => void;
  setInfiniteBest: (count: number) => void;
  markDailyDone: () => void;
  isDailyDoneToday: () => boolean;
  dailyStreak: () => number;
  setLevelMedal: (idx: number, medal: Medal) => boolean;
  getLevelMedal: (idx: number) => Medal | undefined;
  isSolved: (idx: number) => boolean;
  solvedCount: () => number;
  markIOSInstallPromptSeen: () => void;
  setDailyReminderEnabled: (enabled: boolean) => void;
  reset: () => void;
}

// This is the fix for the original prototype's core bug: `solved`, `hints`, and
// `infiniteCount` used to be plain in-memory JS variables that reset on every reload.
export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      solvedMap: {},
      solvedDateMap: {},
      hints: INITIAL_HINTS,
      infiniteBest: 0,
      dailyCompletedDate: null,
      dailyCompletionDates: [],
      levelMedals: {},
      iosInstallPromptSeen: false,
      dailyReminderEnabled: false,

      markSolved: idx => {
        const alreadySolved = !!get().solvedMap[idx];
        if (alreadySolved) return false;
        set(s => ({
          solvedMap: { ...s.solvedMap, [idx]: true },
          solvedDateMap: { ...s.solvedDateMap, [idx]: getDailyDateKey() },
          hints: isMilestoneLevel(idx) ? Math.min(MAX_HINTS, s.hints + 1) : s.hints,
        }));
        return true;
      },

      spendHint: () => set(s => ({ hints: normalizeHintCount(s.hints - 1) })),

      setInfiniteBest: count => set(s => ({ infiniteBest: Math.max(s.infiniteBest, count) })),

      markDailyDone: () => {
        const today = getDailyDateKey();
        set(s => {
          // Paid on the transition, like a milestone level, so no record of which goals were
          // already rewarded has to be kept or synced.
          const reward = goalRewardHints(goalsCompletedBy(s.dailyCompletionDates, today));
          return {
            dailyCompletedDate: today,
            dailyCompletionDates: Array.from(new Set([...s.dailyCompletionDates, today])).sort(),
            hints: normalizeHintCount(s.hints + reward),
          };
        });
      },

      isDailyDoneToday: () => get().dailyCompletedDate === getDailyDateKey(),

      dailyStreak: () => getDailyStreak(get().dailyCompletionDates),

      setLevelMedal: (idx, medal) => {
        const current = get().levelMedals[idx];
        if (!isBetterMedal(medal, current)) return false;
        set(s => ({ levelMedals: { ...s.levelMedals, [idx]: medal } }));
        return true;
      },

      getLevelMedal: idx => get().levelMedals[idx],

      isSolved: idx => !!get().solvedMap[idx],

      solvedCount: () => Object.keys(get().solvedMap).length,

      markIOSInstallPromptSeen: () => set({ iosInstallPromptSeen: true }),

      setDailyReminderEnabled: enabled => set({ dailyReminderEnabled: enabled }),

      reset: () => set({
        solvedMap: {},
        solvedDateMap: {},
        hints: INITIAL_HINTS,
        infiniteBest: 0,
        dailyCompletedDate: null,
        dailyCompletionDates: [],
        levelMedals: {},
        iosInstallPromptSeen: false,
        dailyReminderEnabled: false,
      }),
    }),
    {
      name: 'bumi-progress-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: PROGRESS_STORE_VERSION,
      migrate: migrateCampaignProgress,
    },
  ),
);
