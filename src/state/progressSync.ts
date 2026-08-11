import { useAuthStore } from './authStore';
import { useProgressStore } from './progressStore';
import type { Medal } from '@/game/medals';
import { utcOffsetMinutes } from '@/game/daily';
import { mergeProgress, type RemoteProgressState } from './progressMerge';
import { apiRequest } from '@/lib/apiClient';
import { useSyncStore } from '@/state/syncStore';
import { AppState, Platform } from 'react-native';

type RemoteState = RemoteProgressState;

async function pushProgress(): Promise<void> {
  const s = useProgressStore.getState();
  await apiRequest<{ ok: true }>('/api/progress', 'POST', {
    progress: {
      hints: s.hints,
      dailyCompletedDate: s.dailyCompletedDate,
      dailyCompletionDates: s.dailyCompletionDates,
      dailyDurations: s.dailyDurations,
      dailyHints: s.dailyHints,
      streakFreezes: s.streakFreezes,
      // Read at the moment of the post rather than held anywhere: a player who flies somewhere
      // is on the new clock as soon as their device is, and the dates above are already in it.
      utcOffsetMinutes: utcOffsetMinutes(),
    },
  });
}

async function pushSolvedLevels(levelIdxs: number[]): Promise<void> {
  if (!levelIdxs.length) return;
  await apiRequest<{ ok: true }>('/api/progress', 'POST', { solvedLevelIdxs: levelIdxs });
}

async function pushLevelMedals(levelMedals: Record<number, Medal>): Promise<void> {
  if (!Object.keys(levelMedals).length) return;
  await apiRequest<{ ok: true }>('/api/progress', 'POST', { levelMedals });
}

async function mergeFromRemote(): Promise<void> {
  const remote = await apiRequest<RemoteState>('/api/progress', 'GET');
  const merged = mergeProgress(useProgressStore.getState(), remote);
  const { newlyLocalSolved, newlyLocalMedals, ...state } = merged;

  useProgressStore.setState(state);

  await Promise.all([pushProgress(), pushSolvedLevels(newlyLocalSolved), pushLevelMedals(newlyLocalMedals)]);
}

let initialized = false;
let syncing = false;
let syncQueued = false;
let shouldMergeRemote = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function isNetworkAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return typeof navigator === 'undefined' || navigator.onLine;

  try {
    const Network = await import('expo-network');
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // Network inspection is optional. The request itself remains the final authority.
    return true;
  }
}

async function syncLocalState(): Promise<void> {
  const state = useProgressStore.getState();
  await Promise.all([
    pushProgress(),
    pushSolvedLevels(Object.keys(state.solvedMap).map(Number)),
    pushLevelMedals(state.levelMedals),
  ]);
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requestSync(true);
  }, 10_000);
}

function requestSync(mergeRemote = false): void {
  if (!useAuthStore.getState().user) return;
  syncQueued = true;
  shouldMergeRemote ||= mergeRemote;
  void flushSyncQueue();
}

async function flushSyncQueue(): Promise<void> {
  if (syncing || !syncQueued) return;

  if (!(await isNetworkAvailable())) {
    useSyncStore.getState().setOffline();
    scheduleRetry();
    return;
  }

  syncing = true;
  const mergeRemote = shouldMergeRemote;
  syncQueued = false;
  shouldMergeRemote = false;
  useSyncStore.getState().setSyncing();

  try {
    if (mergeRemote) await mergeFromRemote();
    else await syncLocalState();
    useSyncStore.getState().setSynced();
  } catch {
    useSyncStore.getState().setError();
    syncQueued = true;
    shouldMergeRemote = true;
    scheduleRetry();
  } finally {
    syncing = false;
    if (syncQueued && !retryTimer) void flushSyncQueue();
  }
}

// Call once (e.g. from the root layout) to wire auth <-> local progress syncing.
// Guest play is untouched: everything here is a no-op while signed out.
export function initProgressSync(): void {
  if (initialized) return;
  initialized = true;

  useAuthStore.subscribe((state, prevState) => {
    const userId = state.user?.id ?? null;
    if (userId && userId !== (prevState.user?.id ?? null)) {
      const progress = useProgressStore.getState();
      // Signing in hands the board on this device up to the account, which is what a guest who
      // signs in wants and how they keep what they played. It is only ever right for a board
      // nobody has claimed. One already carrying another account's name is not this player's to
      // give: `mergeFromRemote` counts everything the server lacks as newly local, so a second
      // account was being sent the first one's entire record and shown it as its own.
      //
      // Signing out empties the board and drops the name with it, so the ordinary path never
      // reaches this. What does is every way a session ends without being signed out of — an
      // expired one, a revoked one, a sign-out that failed at the request.
      if (progress.progressOwnerId && progress.progressOwnerId !== userId) {
        progress.clearAccountProgress();
      }
      useProgressStore.getState().setProgressOwner(userId);
      requestSync(true);
    }
    if (!userId && prevState.user) {
      useSyncStore.getState().reset();
    }
  });

  useProgressStore.subscribe((state, prevState) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    if (state.solvedMap !== prevState.solvedMap || state.solvedDateMap !== prevState.solvedDateMap) {
      requestSync();
    }

    if (state.levelMedals !== prevState.levelMedals) {
      requestSync();
    }

    if (
      state.hints !== prevState.hints ||
      state.dailyCompletedDate !== prevState.dailyCompletedDate ||
      state.dailyCompletionDates !== prevState.dailyCompletionDates ||
      // A replayed archive day can better a time without adding a date, and that improvement
      // is worth as much as the completion was.
      state.dailyDurations !== prevState.dailyDurations ||
      state.dailyHints !== prevState.dailyHints ||
      state.streakFreezes !== prevState.streakFreezes
    ) {
      requestSync();
    }
  });

  AppState.addEventListener('change', state => {
    if (state === 'active') requestSync(true);
  });

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => requestSync(true));
    return;
  }

  void import('expo-network').then(Network => {
    Network.addNetworkStateListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) requestSync(true);
    });
  });
}
