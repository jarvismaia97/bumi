import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { bestDuration, getDailyDateKey, getDailyStreak, hintsForBest } from '@/game/daily';
import { INITIAL_HINTS, isMilestoneLevel, MAX_HINTS, normalizeHintCount } from '@/game/hints';
import { goalRewardHints, goalsCompletedBy } from '@/game/goals';
import { claimFreeze } from '@/game/streakFreeze';
import { isBetterMedal, type Medal } from '@/game/medals';
import { hintBalance } from './progressMerge';

const CAMPAIGN_CATALOG_VERSION = 3;
const HINT_COUNTER_VERSION = 5;
const PROGRESS_STORE_VERSION = 5;

function migrateCampaignProgress(persistedState: unknown, version: number): unknown {
  if (version >= CAMPAIGN_CATALOG_VERSION || !persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as { solvedMap?: Record<number, true> };
  const solvedCount = Object.keys(state.solvedMap ?? {}).length;
  const solvedMap = Object.fromEntries(Array.from({ length: solvedCount }, (_, idx) => [idx, true])) as Record<number, true>;

  // The puzzles changed, but a player's campaign position should remain intact.
  // Medals depend on the exact puzzle and are reset for the new catalogue.
  return { ...state, solvedMap, levelMedals: {} };
}

/**
 * Turns the balance already on the device into the two counters that replaced it.
 *
 * Nothing on the device ever recorded what a balance cost to reach, so the whole of it is carried
 * over as earned and nothing as spent. That is the only reading with the property this has to
 * have — `hintsEarned - hintsSpent` is exactly the number the player had before the upgrade, so
 * nobody loses a hint and nobody gains one. It is also the reading `neon/schema.sql` backfills the
 * server's own column with, and the one the merge falls back to for a server answering without
 * counters, so a device and its account agree about the same number however they meet.
 *
 * A stored state with no `hints` at all is one that never got as far as writing it; the starting
 * grant is what that player would have been given anyway.
 */
function migrateHintCounters(persistedState: unknown, version: number): unknown {
  if (version >= HINT_COUNTER_VERSION || !persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as { hints?: unknown };
  const hints = normalizeHintCount(typeof state.hints === 'number' ? state.hints : INITIAL_HINTS);
  return { ...state, hints, hintsEarned: hints, hintsSpent: 0 };
}

/** Every migration this store has, in the order a device that skipped both needs them. */
function migrateProgress(persistedState: unknown, version: number): unknown {
  return migrateHintCounters(migrateCampaignProgress(persistedState, version), version);
}

/**
 * The two counters and the balance they describe, as one patch. This is the only place the
 * balance is computed on this side, so the three cannot drift apart.
 *
 * Earned is capped at `hintsSpent + MAX_HINTS` rather than left to run, and that is the cap's
 * behaviour rather than an accident of it: a grant made at the ceiling has always been forfeited
 * (`Math.min(MAX_HINTS, s.hints + 1)` did exactly this), and banking it in the counter instead
 * would hand it back later, one hint per spend, until the ceiling stopped meaning anything — the
 * ceiling being the whole reason the goals are worth finishing.
 *
 * It is also what keeps the merge sound. Every device holds `hintsEarned - hintsSpent <=
 * MAX_HINTS`, and a merge takes the larger of each: the larger spend is at least the spend that
 * belongs to the larger earn, so the merged pair keeps the same bound. Without the cap here two
 * devices could merge into a balance that the ceiling then silently swallowed, and the next spend
 * would cost the player nothing.
 */
function hintCounters(earned: number, spent: number): { hints: number; hintsEarned: number; hintsSpent: number } {
  const granted = Math.min(spent + MAX_HINTS, earned);
  return { hints: hintBalance(granted, spent), hintsEarned: granted, hintsSpent: spent };
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
  /**
   * The balance the game spends. Derived from the two counters below and stored beside them, so
   * the screens and the sync subscription can go on reading one number — but it is never the
   * thing that is merged, because a number that moves both ways cannot be.
   */
  hints: number;
  /**
   * Every hint this account has ever been granted, and every one it has ever spent. Two counters
   * rather than the balance because of what syncing has to do with them: a balance merged by the
   * higher side resurrects whatever was spent elsewhere, and merged by the later write discards
   * whatever was earned elsewhere. Counters only grow, `max` is the only merge either admits, and
   * neither failure can be expressed. See `mergeHintCounters` in progressMerge.ts.
   */
  hintsEarned: number;
  hintsSpent: number;
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
      hintsEarned: INITIAL_HINTS,
      hintsSpent: 0,
      dailyCompletedDate: null,
      dailyCompletionDates: [],
      dailyDurations: {},
      dailyHints: {},
      streakFreezes: [],
      levelMedals: {},
      iosInstallPromptSeen: false,
      dailyReminderEnabled: false,

      // The early return is the grant's only guard: a level already solved pays nothing, and it
      // has to be answered before the counter moves, because a milestone replayed is a milestone
      // that would otherwise mint a hint every time the board was cleared again.
      markSolved: idx => {
        const alreadySolved = !!get().solvedMap[idx];
        if (alreadySolved) return false;
        set(s => ({
          solvedMap: { ...s.solvedMap, [idx]: true },
          solvedDateMap: { ...s.solvedDateMap, [idx]: getDailyDateKey() },
          ...hintCounters(s.hintsEarned + (isMilestoneLevel(idx) ? 1 : 0), s.hintsSpent),
        }));
        return true;
      },

      /**
       * Refused at an empty balance rather than floored at it. The old line took
       * `normalizeHintCount(hints - 1)`, which quietly answered 0 with 0; a counter cannot be
       * quiet about it — a spend recorded with nothing to spend is permanent, and it would go on
       * eating the next hint this account earned, on every device, forever.
       */
      spendHint: () => set(s => (s.hints <= 0 ? {} : hintCounters(s.hintsEarned, s.hintsSpent + 1))),


      /**
       * `dateKey` is the puzzle's own date, not the day it was played: a completion belongs
       * to the day it solves. Catching up on a missed daily from the archive therefore counts
       * towards the month and can close a gap in the streak — the streak asks whether each
       * day's puzzle is done, not whether the app was opened that day.
       *
       * Safe to call again for a day already on file, and the archive means it will be: only a
       * date the list has never held can be paid for. The callers cannot see this rule and so
       * cannot be trusted with it — the win flow marks the daily done every time a board is
       * solved, and a replay is a fresh `loadLevel`, so nothing before this point knows the day
       * was finished months ago. A better time is another matter; that is the point of a replay
       * and is taken below whichever call sets it.
       */
      markDailyDone: (dateKey = getDailyDateKey(), durationMs?: number, hintsUsed?: number) => {
        set(s => {
          // Paid on the transition, like a milestone level, so no record of which goals were
          // already rewarded has to be kept or synced.
          const alreadyRecorded = s.dailyCompletionDates.includes(dateKey);
          const reward = alreadyRecorded ? 0 : goalRewardHints(goalsCompletedBy(s.dailyCompletionDates, dateKey));
          return {
            // Only today's puzzle changes what "done today" means.
            dailyCompletedDate: dateKey === getDailyDateKey() ? dateKey : s.dailyCompletedDate,
            dailyCompletionDates: Array.from(new Set([...s.dailyCompletionDates, dateKey])).sort(),
            // Hints first: it reads the time already on file to decide whether this solve is
            // the one whose count to keep, and the line below is about to replace it.
            dailyHints: hintsForBest(s.dailyDurations, s.dailyHints, dateKey, durationMs, hintsUsed),
            dailyDurations: bestDuration(s.dailyDurations, dateKey, durationMs),
            // A reward of zero still goes through here, and lands on the same numbers: the
            // counters are what decide whether anything was paid, not the call.
            ...hintCounters(s.hintsEarned + reward, s.hintsSpent),
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
        // Back to the starting grant, counters included: a lifetime total left behind would be
        // merged straight into the next account to sign in here, which is what these two clear.
        hints: INITIAL_HINTS,
        hintsEarned: INITIAL_HINTS,
        hintsSpent: 0,
        dailyCompletedDate: null,
        dailyCompletionDates: [],
        dailyDurations: {},
        dailyHints: {},
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
        hintsEarned: INITIAL_HINTS,
        hintsSpent: 0,
        dailyCompletedDate: null,
        dailyCompletionDates: [],
        dailyDurations: {},
        dailyHints: {},
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
      migrate: migrateProgress,
    },
  ),
);
