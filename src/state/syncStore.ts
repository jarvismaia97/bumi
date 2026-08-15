import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  /**
   * Whether there is work the server has not taken yet. Set wherever a sync is queued and cannot
   * be sent — no signal, an attempt that failed, and now the two states a launch passes through
   * before it can send anything at all: a session that has not resolved, and a board that has not
   * been read back off the device.
   *
   * Deliberately not set by an ordinary local write, which is the reading the name invites. The
   * settings sheet turns this flag into "offline" or "retrying", and a solve whose sync is in
   * flight and about to land is neither of those; saying so would put a warning under every
   * puzzle solved. `status` already carries that half of the story.
   */
  hasPendingChanges: boolean;
  lastSyncedAt: number | null;
  setSyncing: () => void;
  setSynced: () => void;
  setOffline: () => void;
  setError: () => void;
  /** Queued, but not sendable yet. Leaves `status` alone: nothing has been tried or has failed. */
  setPending: () => void;
  reset: () => void;
}

// This state is deliberately not persisted. Local game progress is persisted separately;
// the badge only describes the current connection and sync attempt.
export const useSyncStore = create<SyncState>()(set => ({
  status: 'idle',
  hasPendingChanges: false,
  lastSyncedAt: null,
  setSyncing: () => set({ status: 'syncing' }),
  setSynced: () => set({ status: 'synced', hasPendingChanges: false, lastSyncedAt: Date.now() }),
  setOffline: () => set({ status: 'offline', hasPendingChanges: true }),
  setError: () => set({ status: 'error', hasPendingChanges: true }),
  setPending: () => set({ hasPendingChanges: true }),
  reset: () => set({ status: 'idle', hasPendingChanges: false, lastSyncedAt: null }),
}));
