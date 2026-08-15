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

  it('keeps saying whose board it is when the server cannot be reached', async () => {
    // The whole point of persisting the user: a player with 471 levels and a 16-day streak
    // opening the app on a plane is not somebody who signed out.
    const known = { id: 'u', name: 'Ana', email: 'a@b.c' };
    useAuthStore.setState({ user: known });
    getSession.mockRejectedValueOnce(new Error('Network request failed'));

    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));

    expect(useAuthStore.getState().user).toEqual(known);
  });

  it('does let go once the server says there is nobody', async () => {
    // A reachable server answering "no session" is the one thing that means signed out.
    useAuthStore.setState({ user: { id: 'u', name: 'Ana', email: 'a@b.c' } });
    getSession.mockResolvedValueOnce({ data: null, error: null });

    useAuthStore.getState().init();
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));

    expect(useAuthStore.getState().user).toBeNull();
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

  it('joins the request already in flight instead of starting another', async () => {
    // The guard only closed once an answer had arrived, so a request still on its way was no
    // guard at all: `init` runs on every resume, and a flapping connection started one per
    // foreground. They then landed in whatever order they liked, and the last to land won.
    let answer: ((session: unknown) => void) | undefined;
    getSession.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }),
    );

    useAuthStore.getState().init();
    useAuthStore.getState().init();
    useAuthStore.getState().init();

    expect(getSession).toHaveBeenCalledTimes(1);

    answer?.({ data: null, error: null });
    await vi.waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
  });

  it('hands every caller the same answer to wait on', async () => {
    let answer: ((session: unknown) => void) | undefined;
    getSession.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }),
    );

    const first = useAuthStore.getState().init();
    const second = useAuthStore.getState().init();
    answer?.({
      data: { session: { id: 's', userId: 'u', expiresAt: new Date() }, user: { id: 'u', name: 'Ana', email: 'a@b.c' } },
      error: null,
    });
    await Promise.all([first, second]);

    expect(useAuthStore.getState().user?.name).toBe('Ana');
  });

  it('asks again after a failure, once that request is out of the way', async () => {
    // The in-flight guard must not become the permanent one: a launch whose request failed has
    // no answer, and the next resume is exactly when it should ask again.
    getSession.mockRejectedValueOnce(new Error('Network request failed'));
    await useAuthStore.getState().init();

    getSession.mockResolvedValueOnce({ data: null, error: null });
    await useAuthStore.getState().init();

    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
