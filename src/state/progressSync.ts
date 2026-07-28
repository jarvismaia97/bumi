import { useAuthStore } from './authStore';
import { useProgressStore } from './progressStore';
import type { Medal } from '@/game/medals';
import { mergeProgress, type RemoteProgressState } from './progressMerge';
import { authClient } from '@/lib/auth-client';
import { useSyncStore } from '@/state/syncStore';
import { AppState, Platform } from 'react-native';

type RemoteState = RemoteProgressState;

function apiUrl(): string {
  if (Platform.OS === 'web') return '/api/progress';
  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL;
  return base ? `${base.replace(/\/$/, '')}/api/progress` : '/api/progress';
}

async function apiRequest<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!useAuthStore.getState().session) throw new Error('Missing auth session');
  const cookie = Platform.OS === 'web' ? null : authClient.getCookie();

  const response = await fetch(apiUrl(), {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });

  if (!response.ok) {
    throw new Error(`Progress sync failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function pushProgress(): Promise<void> {
  const s = useProgressStore.getState();
  await apiRequest<{ ok: true }>('POST', {
    progress: {
      hints: s.hints,
      dailyCompletedDate: s.dailyCompletedDate,
      dailyCompletionDates: s.dailyCompletionDates,
    },
  });
}

async function pushSolvedLevels(levelIdxs: number[]): Promise<void> {
  if (!levelIdxs.length) return;
  await apiRequest<{ ok: true }>('POST', { solvedLevelIdxs: levelIdxs });
}

async function pushLevelMedals(levelMedals: Record<number, Medal>): Promise<void> {
  if (!Object.keys(levelMedals).length) return;
  await apiRequest<{ ok: true }>('POST', { levelMedals });
}

async function mergeFromRemote(): Promise<void> {
  const remote = await apiRequest<RemoteState>('GET');
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
      state.dailyCompletionDates !== prevState.dailyCompletionDates
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
