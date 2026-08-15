import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { newFriends, sortForView, useFriendsStore, type LeaderboardEntry } from './friendsStore';

vi.mock('@/lib/auth-client', () => ({
  authClient: { getCookie: () => null, getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    code: '7K3QF2',
    addedAt: '2026-07-30T10:00:00.000Z',
    name: null,
    artist: 0,
    points: 12,
    medals: { gold: 2, silver: 0, bronze: 2 },
    solved: 4,
    streak: 1,
    dailyDone: false,
    dailyMs: null,
    dailyHints: null,
    isSelf: false,
    ...overrides,
  };
}

function respond(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
}

describe('friends who arrived today', () => {
  // Local time, because the day boundary is the daily challenge's own — midnight where the
  // player is, not midnight in UTC.
  const NOW = new Date(2026, 7, 4, 11, 0, 0);
  const self = entry({ isSelf: true, code: 'MYCODE', addedAt: new Date(2026, 7, 4, 9, 0, 0).toISOString() });
  const today = entry({ code: 'AAAAAA', addedAt: new Date(2026, 7, 4, 2, 0, 0).toISOString() });
  const yesterday = entry({ code: 'BBBBBB', addedAt: new Date(2026, 7, 3, 23, 30, 0).toISOString() });

  it('badges the ones added today', () => {
    expect(newFriends([self, today, yesterday], NOW).map(row => row.code)).toEqual(['AAAAAA']);
  });

  it('drops the badge once the day turns, which is what makes it clear itself', () => {
    const tomorrow = new Date(2026, 7, 5, 0, 30, 0);
    expect(newFriends([self, today, yesterday], tomorrow)).toEqual([]);
  });

  it('never counts the player themselves, however recently the row was made', () => {
    expect(newFriends([self], NOW)).toEqual([]);
  });

  it('ignores a row with no arrival time rather than treating it as new', () => {
    expect(newFriends([entry({ code: 'CCCCCC', addedAt: null })], NOW)).toEqual([]);
  });
});

describe('friends store', () => {
  beforeEach(() => {
    useFriendsStore.getState().reset();
    // The request refuses to fire without a session, which is what a signed-out player has.
    useAuthStore.setState({ session: { id: 's', userId: 'u', expiresAt: new Date() }, user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the board and keeps the order the server sent', async () => {
    const entries = [entry({ points: 20, code: 'AAAAAA' }), entry({ points: 5, code: 'BBBBBB' })];
    vi.stubGlobal('fetch', respond({ code: 'MYCODE', entries }));

    await useFriendsStore.getState().load();

    expect(useFriendsStore.getState().code).toBe('MYCODE');
    expect(useFriendsStore.getState().entries.map(row => row.code)).toEqual(['AAAAAA', 'BBBBBB']);
    expect(useFriendsStore.getState().error).toBeNull();
  });

  it('rejects a malformed code without spending a request', async () => {
    const fetchMock = respond({ code: 'MYCODE', entries: [] });
    vi.stubGlobal('fetch', fetchMock);

    expect(await useFriendsStore.getState().addFriend('nope')).toBe(false);
    expect(useFriendsStore.getState().error).toBe('invalid_code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses the player their own code before the server has to', async () => {
    const fetchMock = respond({ code: '7K3QF2', entries: [] });
    vi.stubGlobal('fetch', fetchMock);
    await useFriendsStore.getState().load();
    fetchMock.mockClear();

    expect(await useFriendsStore.getState().addFriend('7k3-qf2')).toBe(false);
    expect(useFriendsStore.getState().error).toBe('own_code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the reason the server gave for refusing an add', async () => {
    vi.stubGlobal('fetch', respond({ error: 'unknown_code' }, 404));

    expect(await useFriendsStore.getState().addFriend('7K3QF2')).toBe(false);
    expect(useFriendsStore.getState().error).toBe('unknown_code');
  });

  it('calls anything else offline rather than inventing a reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network request failed')));

    await useFriendsStore.getState().load();

    expect(useFriendsStore.getState().error).toBe('offline');
    expect(useFriendsStore.getState().loading).toBe(false);
  });

  it('does not let a load in flight paint over the board an add just returned', async () => {
    // The two are guarded by different flags, so they overlap freely. The load went out first
    // and landed last, and the friend the player had just added disappeared off the board until
    // the sheet was closed and opened again.
    const before = { code: 'MYCODE', entries: [entry({ code: 'OLD' })] };
    const after = { code: 'MYCODE', entries: [entry({ code: 'OLD' }), entry({ code: 'ADDED' })] };
    let releaseLoad: (() => void) | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') return { ok: true, status: 200, json: async () => after };
        await new Promise<void>(resolve => {
          releaseLoad = resolve;
        });
        return { ok: true, status: 200, json: async () => before };
      }),
    );

    const loading = useFriendsStore.getState().load();
    await vi.waitFor(() => expect(releaseLoad).toBeDefined());
    await useFriendsStore.getState().addFriend('AAAAAA');
    releaseLoad?.();
    await loading;

    expect(useFriendsStore.getState().entries.map(row => row.code)).toEqual(['OLD', 'ADDED']);
    // The overtaken request still has to let go of its own flag, or nothing can load again.
    expect(useFriendsStore.getState().loading).toBe(false);
  });

  it('does not let a load in flight bring back a friend the player removed', async () => {
    const before = { code: 'MYCODE', entries: [entry({ code: 'KEPT' }), entry({ code: 'GONE' })] };
    const after = { code: 'MYCODE', entries: [entry({ code: 'KEPT' })] };
    let releaseLoad: (() => void) | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') return { ok: true, status: 200, json: async () => after };
        await new Promise<void>(resolve => {
          releaseLoad = resolve;
        });
        return { ok: true, status: 200, json: async () => before };
      }),
    );

    const loading = useFriendsStore.getState().load();
    await vi.waitFor(() => expect(releaseLoad).toBeDefined());
    await useFriendsStore.getState().removeFriend('GONE');
    releaseLoad?.();
    await loading;

    expect(useFriendsStore.getState().entries.map(row => row.code)).toEqual(['KEPT']);
  });

  it('names a row for removal by its handle, and sends it as the server reads it', async () => {
    // The board no longer carries anybody's friend code: a row is named by an opaque per-viewer
    // handle, which is not normalised or validated here because only the server can read it.
    const handle = 'a3f19c04b8e7d2610f5a8c94d17be265';
    const fetchMock = respond({ code: 'MYCODE', entries: [] });
    vi.stubGlobal('fetch', fetchMock);

    await useFriendsStore.getState().removeFriend(handle);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ action: 'remove', code: handle });
  });

  it('ignores a board that arrives after the account has gone', async () => {
    // Signing out mid-request: the answer belongs to the account that just left.
    let releaseLoad: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await new Promise<void>(resolve => {
          releaseLoad = resolve;
        });
        return { ok: true, status: 200, json: async () => ({ code: 'MYCODE', entries: [entry()] }) };
      }),
    );

    const loading = useFriendsStore.getState().load();
    await vi.waitFor(() => expect(releaseLoad).toBeDefined());
    useFriendsStore.getState().reset();
    releaseLoad?.();
    await loading;

    expect(useFriendsStore.getState().entries).toEqual([]);
    expect(useFriendsStore.getState().code).toBeNull();
  });

  it('drops the board on reset, so the next account starts empty', async () => {
    vi.stubGlobal('fetch', respond({ code: 'MYCODE', entries: [entry()] }));
    await useFriendsStore.getState().load();

    useFriendsStore.getState().reset();

    expect(useFriendsStore.getState().code).toBeNull();
    expect(useFriendsStore.getState().entries).toEqual([]);
  });
});

describe('the board sorted by today', () => {
  it('puts the fastest first', () => {
    const rows = [
      entry({ code: 'SLOW', dailyDone: true, dailyMs: 90_000 }),
      entry({ code: 'FAST', dailyDone: true, dailyMs: 30_000 }),
    ];
    expect(sortForView(rows, 'daily').map(row => row.code)).toEqual(['FAST', 'SLOW']);
  });

  it('ranks a finish with no recorded time behind every finish that has one', () => {
    // Completions predate the clock, and they still beat not having played at all.
    const rows = [
      entry({ code: 'NOTIME', dailyDone: true, dailyMs: null }),
      entry({ code: 'PENDING', dailyDone: false, dailyMs: null }),
      entry({ code: 'TIMED', dailyDone: true, dailyMs: 120_000 }),
    ];
    expect(sortForView(rows, 'daily').map(row => row.code)).toEqual(['TIMED', 'NOTIME', 'PENDING']);
  });

  it('breaks a tie among the unplayed by points, so the tail is not arbitrary', () => {
    const rows = [entry({ code: 'LOW', points: 3 }), entry({ code: 'HIGH', points: 90 })];
    expect(sortForView(rows, 'daily').map(row => row.code)).toEqual(['HIGH', 'LOW']);
  });

  it('leaves the points view exactly as the server ordered it', () => {
    const rows = [entry({ code: 'A' }), entry({ code: 'B' })];
    expect(sortForView(rows, 'points')).toBe(rows);
  });
});
