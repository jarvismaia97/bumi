import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteProgressState } from './progressMerge';

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
  AUTH_STORAGE_KEYS: [],
  authClient: { getCookie: () => null, getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));

/** What is on the device: a played account, read back slowly. */
const PERSISTED_PROGRESS = {
  state: {
    progressOwnerId: 'u1',
    solvedMap: { 0: true, 1: true, 2: true },
    solvedDateMap: {},
    hints: 7,
    dailyCompletedDate: '20260810',
    dailyCompletionDates: ['20260808', '20260809', '20260810'],
    dailyDurations: {},
    dailyHints: {},
    streakFreezes: [],
    levelMedals: { 0: 'gold' },
    iosInstallPromptSeen: false,
    dailyReminderEnabled: false,
  },
  version: 4,
};

/** Held open by the test rather than by a timer, so the ordering under test is not a race. */
const board = vi.hoisted(() => {
  let open!: () => void;
  const readable = new Promise<void>(resolve => {
    open = resolve;
  });
  return { readable, open: () => open() };
});

/**
 * The ordering the app gets right by accident today: `progressStore` is imported by `authStore`,
 * so its read starts first and usually finishes first. Nothing enforces it, and a device where
 * the board is the bigger read — which it is, once there are hundreds of levels in it — is one
 * scheduling accident away from merging against the defaults. Here the board is made the slower
 * of the two on purpose, which is the only way to see whether the sync waits for it.
 */
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (key !== 'bumi-progress-store') return null;
      await board.readable;
      return JSON.stringify(PERSISTED_PROGRESS);
    },
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com' };
const SESSION = { id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86_400_000) };

const REMOTE: RemoteProgressState = {
  progress: {
    hints: 2,
    dailyCompletedDate: null,
    dailyCompletionDates: [],
  },
  solvedLevelIdxs: [],
  solvedLevelDates: {},
  levelMedals: {},
};

type FetchCall = [string, { method?: string; body?: string } | undefined];

function stubServer() {
  const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) => ({
    ok: true,
    status: 200,
    json: async () => (init?.method === 'POST' ? { ok: true } : REMOTE),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function postedProgress(fetchMock: ReturnType<typeof stubServer>) {
  return (fetchMock.mock.calls as unknown as FetchCall[])
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(init?.body ?? '{}') as { progress?: { hints: number; dailyCompletionDates: string[] } })
    .find(body => body.progress)?.progress;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a sync that starts before the board has been read back', () => {
  it('merges against what is on the device, not against the defaults', async () => {
    // Unguarded, the merge ran against `hints: 3` and no completions, posted that as this
    // device's side of the account, and was then quietly overwritten by rehydration — so the
    // store looked right afterwards and the server had been told the wrong thing.
    vi.resetModules();
    const [{ useAuthStore }, { useProgressStore }, { initProgressSync }] = await Promise.all([
      import('./authStore'),
      import('./progressStore'),
      import('./progressSync'),
    ]);
    initProgressSync();
    const fetchMock = stubServer();

    expect(useProgressStore.persist.hasHydrated()).toBe(false);
    useAuthStore.setState({ session: SESSION, user: USER, loading: false, error: null });
    for (let turn = 0; turn < 6; turn++) await new Promise(resolve => setTimeout(resolve, 0));

    // Nothing at all goes out while the board is still unknown — not even the GET, whose answer
    // would be merged against defaults the moment it arrived.
    expect(fetchMock).not.toHaveBeenCalled();

    board.open();
    await vi.waitFor(() => expect(postedProgress(fetchMock)).toBeDefined());

    const posted = postedProgress(fetchMock);
    expect(posted?.hints).toBe(7);
    expect(posted?.dailyCompletionDates).toEqual(['20260808', '20260809', '20260810']);
    // And the merge kept the higher of the two balances rather than the server's.
    expect(useProgressStore.getState().hints).toBe(7);
  });
});
