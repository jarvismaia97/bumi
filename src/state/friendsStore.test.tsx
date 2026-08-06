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
