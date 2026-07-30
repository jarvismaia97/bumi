import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { newFriends, useFriendsStore, type LeaderboardEntry } from './friendsStore';

vi.mock('@/lib/auth-client', () => ({
  authClient: { getCookie: () => null, getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    code: '7K3QF2',
    addedAt: '2026-07-30T10:00:00.000Z',
    artist: 0,
    points: 12,
    medals: { gold: 2, silver: 0, bronze: 2 },
    solved: 4,
    streak: 1,
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

describe('new friends since the last visit', () => {
  const self = entry({ isSelf: true, code: 'MYCODE', addedAt: null });
  const older = entry({ code: 'AAAAAA', addedAt: '2026-07-29T10:00:00.000Z' });
  const newer = entry({ code: 'BBBBBB', addedAt: '2026-07-30T10:00:00.000Z' });

  it('counts only what arrived after the mark', () => {
    expect(newFriends([self, older, newer], '2026-07-29T12:00:00.000Z').map(row => row.code)).toEqual(['BBBBBB']);
  });

  it('counts everyone on a board the player has never opened', () => {
    expect(newFriends([self, older, newer], null).map(row => row.code)).toEqual(['AAAAAA', 'BBBBBB']);
  });

  it('never counts the player themselves', () => {
    expect(newFriends([self], null)).toEqual([]);
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
