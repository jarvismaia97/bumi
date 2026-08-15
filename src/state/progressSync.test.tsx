import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteProgressState } from './progressMerge';

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
  AUTH_STORAGE_KEYS: [],
  authClient: { getCookie: () => null, getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));

const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com' };
const SESSION = { id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86_400_000) };

/** A server that has never heard of this account, so everything local is newly local. */
const EMPTY_REMOTE: RemoteProgressState = {
  progress: null,
  solvedLevelIdxs: [],
  solvedLevelDates: {},
  levelMedals: {},
};

type FetchCall = [string, { method?: string; body?: string } | undefined];

function stubServer(remote: RemoteProgressState = EMPTY_REMOTE) {
  const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) => ({
    ok: true,
    status: 200,
    json: async () => (init?.method === 'POST' ? { ok: true } : remote),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsOf(fetchMock: ReturnType<typeof stubServer>, method: 'GET' | 'POST'): FetchCall[] {
  return (fetchMock.mock.calls as unknown as FetchCall[]).filter(([, init]) => init?.method === method);
}

function postedBodies(fetchMock: ReturnType<typeof stubServer>): Record<string, unknown>[] {
  return callsOf(fetchMock, 'POST').map(([, init]) => JSON.parse(init?.body ?? '{}') as Record<string, unknown>);
}

/** Long enough for anything the sync queue chains onto itself to have run and been counted. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 6; turn++) await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * A launch of its own per test. Everything the queue remembers between syncs — whether one is
 * in flight, what is still owed — is module state, so a test that shares it with the last one
 * is not testing a launch.
 */
async function launch() {
  vi.resetModules();
  const [{ useAuthStore }, { useProgressStore }, { useSyncStore }, { initProgressSync }] = await Promise.all([
    import('./authStore'),
    import('./progressStore'),
    import('./syncStore'),
    import('./progressSync'),
  ]);
  initProgressSync();
  useAuthStore.setState({ session: null, user: null, loading: false, error: null });
  await vi.waitFor(() => expect(useProgressStore.persist.hasHydrated()).toBe(true));
  return { useAuthStore, useProgressStore, useSyncStore };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what a sign-in merge sends', () => {
  it('sends each part of the board once, not twice', async () => {
    // `mergeFromRemote` writes the merged board into the store, and the store subscription
    // below it counts that write as a local change worth pushing. The queued sync ran the
    // moment the merge finished, so one sign-in posted the progress, the solved levels and
    // the medal map twice each: six posts where three say everything. For a 500-level account
    // that is the whole solved array and the whole medal map, on every foreground.
    const { useAuthStore, useProgressStore } = await launch();
    useProgressStore.setState({ solvedMap: { 0: true, 1: true }, levelMedals: { 0: 'gold' } });
    const fetchMock = stubServer();

    useAuthStore.setState({ session: SESSION, user: USER });
    await settle();

    expect(callsOf(fetchMock, 'GET')).toHaveLength(1);
    expect(callsOf(fetchMock, 'POST')).toHaveLength(3);
  });

  it('still sends all three parts, so nothing is lost by sending them once', async () => {
    const { useAuthStore, useProgressStore } = await launch();
    useProgressStore.setState({ solvedMap: { 4: true }, levelMedals: { 4: 'silver' } });
    const fetchMock = stubServer();

    useAuthStore.setState({ session: SESSION, user: USER });
    await settle();

    const bodies = postedBodies(fetchMock);
    expect(bodies.some(body => 'progress' in body)).toBe(true);
    expect(bodies.some(body => JSON.stringify(body.solvedLevelIdxs) === '[4]')).toBe(true);
    expect(bodies.some(body => JSON.stringify(body.levelMedals) === '{"4":"silver"}')).toBe(true);
  });

  it('keeps sending a later local solve, so the quiet is not the subscription being deaf', async () => {
    const { useAuthStore, useProgressStore } = await launch();
    const fetchMock = stubServer();
    useAuthStore.setState({ session: SESSION, user: USER });
    await settle();
    fetchMock.mockClear();

    useProgressStore.getState().markSolved(7);
    await settle();

    expect(postedBodies(fetchMock).some(body => JSON.stringify(body.solvedLevelIdxs) === '[7]')).toBe(true);
  });
});

describe('a cold launch that has a player but not yet a session', () => {
  it('waits instead of reporting an error nobody can act on', async () => {
    // `user` is persisted and `session` deliberately is not, so the rehydrated player arrives
    // seconds before `getSession` answers. `apiRequest` refuses to send without a session, and
    // the refusal used to land in the catch that sets the badge to `error` — for the ten
    // seconds until the retry, on every launch of a signed-in app.
    const { useAuthStore, useSyncStore } = await launch();
    const fetchMock = stubServer();

    useAuthStore.setState({ user: USER });
    await settle();

    expect(useSyncStore.getState().status).not.toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs as soon as the session does resolve', async () => {
    const { useAuthStore, useSyncStore } = await launch();
    const fetchMock = stubServer();

    useAuthStore.setState({ user: USER });
    await settle();
    useAuthStore.setState({ session: SESSION });
    await settle();

    expect(useSyncStore.getState().status).toBe('synced');
    // The merge the rehydrated user asked for, not the plain push it would have fallen back to.
    expect(callsOf(fetchMock, 'GET')).toHaveLength(1);
  });

  it('says there is something outstanding while it waits', async () => {
    const { useAuthStore, useSyncStore } = await launch();
    stubServer();

    useAuthStore.setState({ user: USER });
    await settle();

    expect(useSyncStore.getState().hasPendingChanges).toBe(true);
  });
});
