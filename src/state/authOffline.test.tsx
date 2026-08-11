import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: { getSession, getCookie: () => null, signOut: vi.fn(), deleteUser: vi.fn() },
  AUTH_STORAGE_KEYS: [],
}));
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

const { useAuthStore, resetAuthStoreForTests } = await import('./authStore');

describe('opening the app with no network', () => {
  beforeEach(() => {
    resetAuthStoreForTests();
    getSession.mockReset();
  });

  afterEach(() => {
    resetAuthStoreForTests();
  });

  it('leaves the boot screen even when the session request never lands', async () => {
    // `getSession` rejects rather than resolving with an error when the network is gone, and an
    // unhandled rejection used to leave `loading` true forever — the app never opened.
    getSession.mockRejectedValueOnce(new Error('Network request failed'));

    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
  });

  it('treats an unreachable server as unknown rather than as signed out', async () => {
    getSession.mockRejectedValueOnce(new Error('Network request failed'));

    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));

    // No session, but no error shouted at a player who simply has no signal.
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('asks again the next time it is called, having never got an answer', async () => {
    getSession.mockRejectedValueOnce(new Error('Network request failed'));
    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));

    getSession.mockResolvedValueOnce({
      data: { session: { id: 's', userId: 'u', expiresAt: new Date() }, user: { id: 'u', name: 'Ana', email: 'a@b.c' } },
      error: null,
    });
    useAuthStore.getState().init();

    await vi.waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Ana'));
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('stops asking once the server has answered', async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    useAuthStore.getState().init();

    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
