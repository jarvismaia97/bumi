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
  hints: number;
  dailyCompletedDate: string | null;
  dailyCompletionDates: string[];
  dailyDurations: Record<string, number>;
  levelMedals: Record<number, Medal>;
}

export interface RemoteProgressState {
  progress: {
    hints: number;
    dailyCompletedDate: string | null;
    dailyCompletionDates: string[];
    dailyDurations?: Record<string, number>;
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

  return {
    solvedMap: { ...local.solvedMap, ...remoteSolvedMap },
    solvedDateMap: { ...local.solvedDateMap, ...remote.solvedLevelDates },
    // Hints are a balance, not a tally, so the higher side wins rather than the sum: adding
    // them would mint a hint on every merge.
    hints: normalizeHintCount(Math.max(local.hints, remote.progress?.hints ?? 0)),
    dailyCompletedDate: mergedDailyDates.at(-1) ?? null,
    dailyCompletionDates: mergedDailyDates,
    dailyDurations: mergeDurations(local.dailyDurations, remote.progress?.dailyDurations),
    levelMedals,
    newlyLocalSolved: Object.keys(local.solvedMap)
      .map(Number)
      .filter(idx => !remoteSolvedMap[idx]),
    newlyLocalMedals: Object.fromEntries(
      Object.entries(local.levelMedals).filter(([idx, medal]) => isBetterMedal(medal, remote.levelMedals[Number(idx)])),
    ) as Record<number, Medal>,
  };
}
