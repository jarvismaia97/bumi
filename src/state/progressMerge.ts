import { isBetterMedal, type Medal } from '@/game/medals';
import { normalizeHintCount } from '@/game/hints';

/**
 * The merge is pure and lives apart from the syncing around it, because this is the code
 * that can lose a player's progress: it runs when a device that has been played offline
 * meets whatever the server has, and every rule in it is a decision about which side wins.
 *
 * The rule throughout is that nothing already earned is ever taken away.
 */
export interface LocalProgress {
  solvedMap: Record<number, true>;
  solvedDateMap: Record<number, string>;
  /**
   * The balance the game spends, derived from the two counters below and carried beside them so
   * everything that only wants a number can go on reading one. It is never merged; it is what
   * the merged counters come to.
   */
  hints: number;
  /** Every hint this account has ever been granted, and every one it has ever spent. */
  hintsEarned: number;
  hintsSpent: number;
  dailyCompletedDate: string | null;
  dailyCompletionDates: string[];
  dailyDurations: Record<string, number>;
  dailyHints: Record<string, number>;
  streakFreezes: string[];
  levelMedals: Record<number, Medal>;
}

export interface RemoteProgressState {
  progress: {
    /** The balance the server derives. Read only when it answers without the counters. */
    hints: number;
    hintsEarned?: number;
    hintsSpent?: number;
    dailyCompletedDate: string | null;
    dailyCompletionDates: string[];
    dailyDurations?: Record<string, number>;
    dailyHints?: Record<string, number>;
    streakFreezes?: string[];
  } | null;
  solvedLevelIdxs: number[];
  solvedLevelDates: Record<number, string>;
  levelMedals: Record<number, Medal>;
}

export interface MergeResult extends LocalProgress {
  /** Levels the server has not been told about yet. */
  newlyLocalSolved: number[];
  /** Medals the server either lacks or has a worse one for. */
  newlyLocalMedals: Record<number, Medal>;
}

/**
 * The balance two counters describe. Floored at zero and capped at the game's own ceiling, so a
 * pair that somehow arrived the wrong way round reads as an empty balance rather than a negative
 * one, and a pair that outran the cap reads as full.
 */
export function hintBalance(earned: number, spent: number): number {
  return normalizeHintCount(earned - spent);
}

/** A counter as it can be used: whole, never below zero, and zero for anything that is not a number. */
function toCounter(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

/** An older client stored only the last completion, so fall back to it when the list is empty. */
function dailyDatesOf(dates: string[] | undefined, last: string | null): string[] {
  if (dates?.length) return dates;
  return last ? [last] : [];
}

/**
 * The faster time wins per day, which is the only rule that never takes a record away. A day one
 * side has no time for keeps the side that does: a completion without a clock is older
 * information, not a claim that the puzzle took forever.
 */
function mergeDurations(
  local: Record<string, number>,
  remote: Record<string, number> | undefined,
): Record<string, number> {
  const merged = { ...(remote ?? {}) };
  for (const [date, ms] of Object.entries(local)) {
    if (!Number.isFinite(ms) || ms <= 0) continue;
    const known = merged[date];
    if (known === undefined || ms < known) merged[date] = ms;
  }
  return merged;
}

/**
 * Hints go with whichever side's time won above, because that is what they are a count of. The
 * cheaper count is not the better record: taking the smaller of the two would let a slow, clean
 * replay on one device attach its zero to a fast, hinted solve on the other.
 *
 * A day only one side has a time for keeps that side's hints, and a day neither timed keeps
 * whichever count exists, local first — the same rule the durations follow.
 */
function mergeHints(local: LocalProgress, remote: RemoteProgressState): Record<string, number> {
  const localDurations = local.dailyDurations;
  const remoteDurations = remote.progress?.dailyDurations ?? {};
  const localHints = local.dailyHints;
  const remoteHints = remote.progress?.dailyHints ?? {};

  const merged: Record<string, number> = {};
  for (const date of new Set([...Object.keys(localHints), ...Object.keys(remoteHints)])) {
    const mine = localDurations[date];
    const theirs = remoteDurations[date];
    // The remote count only takes the day off a timed local solve by having beaten it, and off
    // an untimed one by being timed at all. Everything else stays with the device in hand.
    const remoteWins = theirs !== undefined && (mine === undefined || theirs < mine);
    const winner = remoteWins ? remoteHints[date] : localHints[date];
    const fallback = remoteWins ? localHints[date] : remoteHints[date];
    const count = winner ?? fallback;
    if (count !== undefined) merged[date] = count;
  }
  return merged;
}

/**
 * The two counters, each taken at its larger side.
 *
 * Hints are counted rather than balanced because of what a merge has to do with them, and no rule
 * for merging a single balance survives it. Taking the higher balance resurrected every hint ever
 * spent: spend four on the phone and the tablet's untouched ten put them back at the next merge,
 * for as long as the two devices kept meeting. Taking the last one written traded that for the
 * opposite loss — a phone offline since Tuesday overwriting every hint earned on the tablet since.
 * Either rule is a claim about which side is more recent, and neither side knows.
 *
 * Two counters that only ever grow have no such claim to make. `max` is the only merge each one
 * admits, it is what both sides would compute in either order, and the balance falls out of them.
 * Two devices that each spend while apart converge on the larger spend, so the player is left with
 * the smaller balance — which is the direction to be wrong in about a currency.
 *
 * A server answering without the counters predates them: an API rolled back under a newer client.
 * Its balance is read the way the migration backfills the column — all earned, nothing spent — so
 * it can still raise what this device has earned, and it cannot lower the spend that protects it.
 */
function mergeHintCounters(local: LocalProgress, remote: RemoteProgressState): { hintsEarned: number; hintsSpent: number } {
  const progress = remote.progress;
  const remoteEarned = toCounter(progress?.hintsEarned ?? progress?.hints ?? 0);
  const remoteSpent = toCounter(progress?.hintsSpent ?? 0);

  return {
    hintsEarned: Math.max(toCounter(local.hintsEarned), remoteEarned),
    hintsSpent: Math.max(toCounter(local.hintsSpent), remoteSpent),
  };
}

export function mergeProgress(local: LocalProgress, remote: RemoteProgressState): MergeResult {
  const remoteSolvedMap: Record<number, true> = {};
  remote.solvedLevelIdxs.forEach(idx => {
    remoteSolvedMap[idx] = true;
  });

  const mergedDailyDates = Array.from(
    new Set([
      ...dailyDatesOf(local.dailyCompletionDates, local.dailyCompletedDate),
      ...dailyDatesOf(remote.progress?.dailyCompletionDates, remote.progress?.dailyCompletedDate ?? null),
    ]),
  ).sort();

  const levelMedals = { ...remote.levelMedals };
  for (const [idx, medal] of Object.entries(local.levelMedals)) {
    const levelIdx = Number(idx);
    if (isBetterMedal(medal, levelMedals[levelIdx])) levelMedals[levelIdx] = medal;
  }

  const { hintsEarned, hintsSpent } = mergeHintCounters(local, remote);

  return {
    solvedMap: { ...local.solvedMap, ...remoteSolvedMap },
    solvedDateMap: { ...local.solvedDateMap, ...remote.solvedLevelDates },
    hintsEarned,
    hintsSpent,
    // Derived, never merged: the two counters above are the state, and this is what they say.
    hints: hintBalance(hintsEarned, hintsSpent),
    dailyCompletedDate: mergedDailyDates.at(-1) ?? null,
    dailyCompletionDates: mergedDailyDates,
    dailyDurations: mergeDurations(local.dailyDurations, remote.progress?.dailyDurations),
    dailyHints: mergeHints(local, remote),
    // Union, like the completions above: a freeze already spent on one device was spent, and
    // dropping it here would quietly break a streak the player was told was safe.
    streakFreezes: Array.from(new Set([...local.streakFreezes, ...(remote.progress?.streakFreezes ?? [])])).sort(),
    levelMedals,
    newlyLocalSolved: Object.keys(local.solvedMap)
      .map(Number)
      .filter(idx => !remoteSolvedMap[idx]),
    newlyLocalMedals: Object.fromEntries(
      Object.entries(local.levelMedals).filter(([idx, medal]) => isBetterMedal(medal, remote.levelMedals[Number(idx)])),
    ) as Record<number, Medal>,
  };
}
