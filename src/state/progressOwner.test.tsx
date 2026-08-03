import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/state/authStore';
import { useProgressStore } from '@/state/progressStore';
import { initProgressSync } from '@/state/progressSync';

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
  AUTH_STORAGE_KEYS: ['bumi_cookie', 'bumi_session_data'],
  authClient: { getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));
// The sync itself needs a network and an account; these tests are about what the store holds
// at the moment a different account arrives, before anything is sent anywhere.
vi.mock('@/lib/apiClient', () => ({ apiRequest: vi.fn().mockRejectedValue(new Error('offline')) }));

const ACCOUNT_A = { id: 'user-a', name: 'A', email: 'a@example.com' };
const ACCOUNT_B = { id: 'user-b', name: 'B', email: 'b@example.com' };

function signedInProgress() {
  return {
    solvedMap: { 0: true, 1: true, 2: true } as Record<number, true>,
    levelMedals: { 0: 'gold' } as Record<number, 'gold'>,
    dailyCompletionDates: ['20260801', '20260802'],
    dailyCompletedDate: '20260802',
  };
}

describe('whose progress this device is holding', () => {
  beforeEach(() => {
    initProgressSync();
    useAuthStore.setState({ session: null, user: null, loading: false, error: null });
    useProgressStore.getState().clearAccountProgress();
  });

  it('drops a board belonging to someone else before a second account arrives', () => {
    // What happened on a real phone: a session that ended without being signed out of, then a
    // sign-in with another account. `mergeFromRemote` treats everything the server lacks as
    // newly local, so a fresh account was sent 392 solved levels that were not its own.
    useProgressStore.setState({ ...signedInProgress(), progressOwnerId: ACCOUNT_A.id });

    useAuthStore.setState({ user: ACCOUNT_B, loading: false });

    const progress = useProgressStore.getState();
    expect(progress.solvedMap).toEqual({});
    expect(progress.levelMedals).toEqual({});
    expect(progress.dailyCompletionDates).toEqual([]);
    expect(progress.progressOwnerId).toBe(ACCOUNT_B.id);
  });

  it('keeps a guest board, which is the whole point of merging on sign-in', () => {
    // Nobody has claimed this one, so it is the player's to bring with them.
    useProgressStore.setState({ ...signedInProgress(), progressOwnerId: null });

    useAuthStore.setState({ user: ACCOUNT_A, loading: false });

    const progress = useProgressStore.getState();
    expect(progress.solvedMap).toEqual({ 0: true, 1: true, 2: true });
    expect(progress.progressOwnerId).toBe(ACCOUNT_A.id);
  });

  it('leaves the board alone when the same account signs in again', () => {
    useProgressStore.setState({ ...signedInProgress(), progressOwnerId: ACCOUNT_A.id });

    useAuthStore.setState({ user: ACCOUNT_A, loading: false });

    expect(useProgressStore.getState().solvedMap).toEqual({ 0: true, 1: true, 2: true });
  });
});
