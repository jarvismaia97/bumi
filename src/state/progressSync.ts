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
      // The two counters are what the server merges; `hints` goes with them because it is what a
      // server that predates them stores, and sending it costs a field. See `mergeHintCounters`
      // in progressMerge.ts for why a balance on its own cannot be synced at all.
      hintsEarned: s.hintsEarned,
      hintsSpent: s.hintsSpent,
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

  applyingRemote = true;
  try {
    useProgressStore.setState(state);
  } finally {
    // The subscription runs inside `setState`, synchronously, so the flag covers exactly this
    // one write however the write goes.
    applyingRemote = false;
  }

  // Progress goes first and alone. It is the only post carrying `utcOffsetMinutes`, and the
  // server derives the poster's day from that stored column to decide whether a notification has
  // already gone out today. A medal post that overtook it would be judged against UTC and stamp
  // the notice date a day early for anyone far enough west, silencing the overtaken push until
  // their own date caught up. One round trip in sequence buys that ordering; the doubling this
  // file fixed was three posts sent twice, not three posts sent at once.
  await pushProgress();
  await Promise.all([pushSolvedLevels(newlyLocalSolved), pushLevelMedals(newlyLocalMedals)]);
}

let initialized = false;
let syncing = false;
let syncQueued = false;
let shouldMergeRemote = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Set while the merged board is being written back into the store. The subscription below reads
 * every write as a local change worth pushing, and the merge is the one write that is not: the
 * three posts on the next line are that same board, already on its way.
 *
 * Without this the subscription queued a second sync during the first, and the `finally` at the
 * bottom of `flushSyncQueue` ran it the moment the merge finished — so one sign-in sent the
 * progress, the solved levels and the medal map twice each, six posts where three say
 * everything. The same doubling happened on every resume and every network-regained event,
 * which for a 500-level account is the whole solved array and the whole medal map, twice.
 */
let applyingRemote = false;

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
  // Ordered for the same reason as the merge path above: the offset this post carries is what
  // the server measures the other two against.
  await pushProgress();
  await Promise.all([
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

/** Runs once the board has been read back off the device, or now if it already has. */
function whenProgressHydrated(run: () => void): void {
  const stop = useProgressStore.persist.onFinishHydration(() => {
    stop();
    run();
  });
}

/**
 * Queues a sync, and holds it back when the app is not yet in a state to send one.
 *
 * Two things have to be true before a sync means anything, and neither is true at the instant a
 * cold launch believes it has a player:
 *
 * `session` is deliberately not persisted while `user` is (see authStore), so a launch rehydrates
 * whose board this is seconds before `getSession` answers for them. `apiRequest` refuses to send
 * without a session, and that refusal used to arrive as a thrown request — straight into the
 * catch that sets the badge to `error`, where it sat for the ten seconds until the retry, on
 * every launch of a signed-in app. Not being ready yet is not a failure.
 *
 * The persisted board is the other. `mergeFromRemote` reads the store directly, so merging before
 * AsyncStorage has been read back merges the server against the defaults — three hints, nothing
 * played — and posts that as this device's side of the account. Rehydration then lands on top and
 * puts the store right, which is what made it invisible: only the server was told the wrong thing.
 *
 * Neither case drops the work. It stays on the queue, and the subscriptions below flush it when
 * the session arrives or the read completes.
 */
function requestSync(mergeRemote = false): void {
  if (!useAuthStore.getState().user) return;
  syncQueued = true;
  shouldMergeRemote ||= mergeRemote;

  if (!useAuthStore.getState().session) {
    useSyncStore.getState().setPending();
    return;
  }

  if (!useProgressStore.persist.hasHydrated()) {
    useSyncStore.getState().setPending();
    whenProgressHydrated(() => void flushSyncQueue());
    return;
  }

  void flushSyncQueue();
}

async function flushSyncQueue(): Promise<void> {
  if (syncing || !syncQueued) return;
  // Claimed before the first `await`, not after: the network check below is asynchronous, and
  // two callers that both got past this line would each send the whole board.
  syncing = true;

  try {
    await runSync();
  } finally {
    syncing = false;
    if (syncQueued && !retryTimer) void flushSyncQueue();
  }
}

async function runSync(): Promise<void> {
  if (!(await isNetworkAvailable())) {
    useSyncStore.getState().setOffline();
    scheduleRetry();
    return;
  }

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
  }
}

// Call once (e.g. from the root layout) to wire auth <-> local progress syncing.
// Guest play is untouched: everything here is a no-op while signed out.
export function initProgressSync(): void {
  if (initialized) return;
  initialized = true;

  useAuthStore.subscribe((state, prevState) => {
    const userId = state.user?.id ?? null;
    const newAccount = !!userId && userId !== (prevState.user?.id ?? null);
    // The session arriving for a player the app already had is the cold launch: `user` comes
    // back from storage and `session` never does, so this is the edge on which a sync queued by
    // the rehydrated user can finally be sent. Without it that sync waited for the next resume,
    // because nothing else about the account had changed.
    const sessionArrived = !!userId && !!state.session && !prevState.session;

    if (newAccount) {
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
    }

    // One call however both land on the same turn: a second would only race the first.
    if (newAccount || sessionArrived) requestSync(true);

    if (!userId && prevState.user) {
      useSyncStore.getState().reset();
    }
  });

  useProgressStore.subscribe((state, prevState) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    // The merge writes the server's own answer back into the store and posts it itself. Reading
    // that write as a local change is what made every sync send the board twice.
    if (applyingRemote) return;

    if (state.solvedMap !== prevState.solvedMap || state.solvedDateMap !== prevState.solvedDateMap) {
      requestSync();
    }

    if (state.levelMedals !== prevState.levelMedals) {
      requestSync();
    }

    if (
      // The counters and not the balance they derive: these are what the post carries and what
      // the server merges, so a change worth sending is a change in one of them.
      state.hintsEarned !== prevState.hintsEarned ||
      state.hintsSpent !== prevState.hintsSpent ||
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
