import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  hasPendingChanges: boolean;
  lastSyncedAt: number | null;
  setSyncing: () => void;
  setSynced: () => void;
  setOffline: () => void;
  setError: () => void;
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
  reset: () => set({ status: 'idle', hasPendingChanges: false, lastSyncedAt: null }),
}));
