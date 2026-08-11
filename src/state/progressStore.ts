import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { bestDuration, getDailyDateKey, getDailyStreak, hintsForBest } from '@/game/daily';
import { INITIAL_HINTS, isMilestoneLevel, MAX_HINTS, normalizeHintCount } from '@/game/hints';
import { goalRewardHints, goalsCompletedBy } from '@/game/goals';
import { claimFreeze } from '@/game/streakFreeze';
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
  /**
   * Who the board on this device belongs to, or `null` while nobody has claimed it — which is
   * what guest play looks like, and what signing out leaves behind.
   *
   * Signing in merges whatever is here up into the account, and that is the point: a guest who
   * signs in keeps what they played. It is only right while the board has no owner. Carried
   * into a second account it hands over the first one's record, and `mergeFromRemote` counts
   * everything the server lacks as newly local — so a fresh account was sent all of it.
   */
  progressOwnerId: string | null;
  solvedMap: Record<number, true>;
  solvedDateMap: Record<number, string>;
  hints: number;
  dailyCompletedDate: string | null;
  dailyCompletionDates: string[];
  /**
   * How long each daily took, keyed by the puzzle's own date. Sparse against
   * `dailyCompletionDates`: days solved before the clock was kept, or by a client that did not
   * send one, are completions with no time and stay that way.
   */
  dailyDurations: Record<string, number>;
  /**
   * Hints spent on each daily, keyed the same way and sparse for the same reason. It is what
   * separates two times on a puzzle everybody solved: the friends board compares the daily
   * because it is the one thing played in common, and a hinted solve set against a clean one
   * is exactly where that stops being true.
   */
  dailyHints: Record<string, number>;
  /**
   * Days a freeze covered. Counted by the streak and by nothing else: they are not in
   * `dailyCompletionDates` because a frozen day was forgiven, not played, and the weekly and
   * monthly goals pay hints for days that were played.
   */
  streakFreezes: string[];
  levelMedals: Record<number, Medal>;
  iosInstallPromptSeen: boolean;
  dailyReminderEnabled: boolean;
  markSolved: (idx: number) => boolean; // returns true if this was a new solve
  spendHint: () => void;
  markDailyDone: (dateKey?: string, durationMs?: number, hintsUsed?: number) => void;
  isDailyDoneToday: () => boolean;
  dailyStreak: () => number;
  /** Returns whether a freeze was taken, so the caller can say so. */
  claimStreakFreeze: () => boolean;
  setLevelMedal: (idx: number, medal: Medal) => boolean;
  getLevelMedal: (idx: number) => Medal | undefined;
  isSolved: (idx: number) => boolean;
  solvedCount: () => number;
  markIOSInstallPromptSeen: () => void;
  setDailyReminderEnabled: (enabled: boolean) => void;
  setProgressOwner: (userId: string | null) => void;
  clearAccountProgress: () => void;
  reset: () => void;
}

// This is the fix for the original prototype's core bug: `solved` and `hints` used to be
// plain in-memory JS variables that reset on every reload.
export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progressOwnerId: null,
      solvedMap: {},
      solvedDateMap: {},
      hints: INITIAL_HINTS,
      dailyCompletedDate: null,
      dailyCompletionDates: [],
      dailyDurations: {},
      streakFreezes: [],
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


      /**
       * `dateKey` is the puzzle's own date, not the day it was played: a completion belongs
       * to the day it solves. Catching up on a missed daily from the archive therefore counts
       * towards the month and can close a gap in the streak — the streak asks whether each
       * day's puzzle is done, not whether the app was opened that day.
       */
      markDailyDone: (dateKey = getDailyDateKey(), durationMs?: number, hintsUsed?: number) => {
        set(s => {
          // Paid on the transition, like a milestone level, so no record of which goals were
          // already rewarded has to be kept or synced.
          const reward = goalRewardHints(goalsCompletedBy(s.dailyCompletionDates, dateKey));
          return {
            // Only today's puzzle changes what "done today" means.
            dailyCompletedDate: dateKey === getDailyDateKey() ? dateKey : s.dailyCompletedDate,
            dailyCompletionDates: Array.from(new Set([...s.dailyCompletionDates, dateKey])).sort(),
            // Hints first: it reads the time already on file to decide whether this solve is
            // the one whose count to keep, and the line below is about to replace it.
            dailyHints: hintsForBest(s.dailyDurations, s.dailyHints, dateKey, durationMs, hintsUsed),
            dailyDurations: bestDuration(s.dailyDurations, dateKey, durationMs),
            hints: normalizeHintCount(s.hints + reward),
          };
        });
      },

      isDailyDoneToday: () => get().dailyCompletedDate === getDailyDateKey(),

      // Frozen days count here and only here, which is the whole of what a freeze buys.
      dailyStreak: () => getDailyStreak([...get().dailyCompletionDates, ...get().streakFreezes]),

      /**
       * Takes the month's freeze if a gap has opened that it can cover. Idempotent, so the app
       * can call it on every resume without having to remember whether it already did.
       */
      claimStreakFreeze: () => {
        const { dailyCompletionDates, streakFreezes } = get();
        const claimed = claimFreeze(dailyCompletionDates, streakFreezes);
        if (claimed === streakFreezes) return false;
        set({ streakFreezes: claimed });
        return true;
      },

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

      // What the account earned, which the server has a copy of and the next person to sign in
      // on this device has no business seeing. Signing out uses this; deleting the account uses
      // `reset`, which goes further.
      clearAccountProgress: () => set({
        solvedMap: {},
        solvedDateMap: {},
        hints: INITIAL_HINTS,
        dailyCompletedDate: null,
        dailyCompletionDates: [],
        dailyDurations: {},
        streakFreezes: [],
        levelMedals: {},
        progressOwnerId: null,
      }),

      setProgressOwner: userId => set({ progressOwnerId: userId }),

      // The two below are the device's, not the account's: whether this phone was offered the
      // install prompt, and whether it rings at seven. Only leaving for good takes them.
      reset: () => set({
        solvedMap: {},
        solvedDateMap: {},
        hints: INITIAL_HINTS,
        dailyCompletedDate: null,
        dailyCompletionDates: [],
        dailyDurations: {},
        streakFreezes: [],
        levelMedals: {},
        iosInstallPromptSeen: false,
        dailyReminderEnabled: false,
        progressOwnerId: null,
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
