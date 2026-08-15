import { create } from 'zustand';
import { apiRequest } from '@/lib/apiClient';
import { getDailyDateKey } from '@/game/daily';
import { normalizeFriendCode } from '@/lib/friendCode';

/**
 * What names a row when the player removes it. Opaque here by design: the server derives it per
 * viewer and the device only ever hands it back, so nothing on this side may parse it, compare
 * it to a friend code, or show it to anybody.
 *
 * It used to be the friend's own add-code, which is why `LeaderboardEntry.code` is still called
 * that — the field name is the wire name, and both change together or neither does.
 */
export type RemovalHandle = string;

/** One row of the board. `artist` indexes ARTISTS, so the nickname is built on the device. */
export interface LeaderboardEntry {
  /** This row's removal handle, or null for the player's own row, which cannot be removed. */
  code: RemovalHandle | null;
  /** ISO timestamp of when the pair was made, or null for the player's own row. */
  addedAt: string | null;
  /** The account's display name, or null when it has none and the painter stands in. */
  name: string | null;
  artist: number;
  points: number;
  medals: { gold: number; silver: number; bronze: number };
  solved: number;
  streak: number;
  /** Whether today's daily is done, and how long it took when a time was recorded. */
  dailyDone: boolean;
  dailyMs: number | null;
  /**
   * Hints that time cost. Null where nobody counted — every day recorded before the count was
   * kept — which is not a claim that the solve was clean, so the row says nothing rather than
   * showing a zero it cannot stand behind.
   */
  dailyHints: number | null;
  isSelf: boolean;
}

/**
 * The board's two contests. Points are the whole record, which a friend who joined today can
 * never win; today's daily is the same puzzle for everyone and starts level every morning,
 * which is the only version of the board a new player has a reason to open.
 */
export type BoardView = 'points' | 'daily';

/**
 * Fastest first, then the ones who finished without a recorded time, then everyone still to
 * play — sorted among themselves by points, so the tail is not arbitrary.
 */
export function sortForView(entries: LeaderboardEntry[], view: BoardView): LeaderboardEntry[] {
  if (view === 'points') return entries;
  return [...entries].sort((a, b) => {
    if (a.dailyDone !== b.dailyDone) return a.dailyDone ? -1 : 1;
    if (a.dailyMs !== null && b.dailyMs !== null) return a.dailyMs - b.dailyMs;
    if (a.dailyMs !== b.dailyMs) return a.dailyMs === null ? 1 : -1;
    return b.points - a.points;
  });
}

/** The reasons an add can fail that the player can do something about. */
export type FriendsError = 'invalid_code' | 'unknown_code' | 'own_code' | 'too_many_friends' | 'too_many_attempts' | 'offline' | 'stale_row';

interface FriendsState {
  code: string | null;
  entries: LeaderboardEntry[];
  /**
   * How many friendships the account actually has, and whether the board on screen is short of
   * them. Adding is capped, but the insert writes both directions — so a player whose code has
   * gone around can be carried past the cap by other people, and the board would otherwise just
   * end, with no way to tell the missing rows from having no more friends.
   */
  friendCount: number;
  truncated: boolean;
  loading: boolean;
  busy: boolean;
  error: FriendsError | null;
  load: () => Promise<void>;
  addFriend: (code: string) => Promise<boolean>;
  /** Takes the row's own handle, never a friend code: adding and removing name rows differently. */
  removeFriend: (handle: RemovalHandle) => Promise<void>;
  rotateCode: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

/**
 * Friends who arrived today. Their own row never counts.
 *
 * This used to be "since you last looked", which needed a persisted mark of the last visit —
 * and that mark is wiped by `reset` on every sign-out, so changing account made every friend
 * new again. A day needs nothing remembered: it is read off the clock, it clears itself at
 * midnight, and there is no state left to get out of step.
 *
 * The day is `getDailyDateKey`, the same boundary the daily challenge turns on, so the app has
 * one idea of when a day ends rather than two.
 *
 * The trade is real: a friend added while the app sits unopened for two days is never badged.
 * The push sent when someone uses your code is what carries that news now.
 */
export function newFriends(entries: LeaderboardEntry[], now: Date = new Date()): LeaderboardEntry[] {
  const today = getDailyDateKey(now);
  return entries.filter(
    entry => !entry.isSelf && entry.addedAt && getDailyDateKey(new Date(entry.addedAt)) === today,
  );
}

type BoardResponse = { code: string; entries: LeaderboardEntry[]; friendCount: number; truncated: boolean };

const KNOWN_ERRORS: FriendsError[] = ['invalid_code', 'unknown_code', 'own_code', 'too_many_friends', 'too_many_attempts'];

function toFriendsError(error: unknown): FriendsError {
  const message = error instanceof Error ? error.message : '';
  return KNOWN_ERRORS.find(known => known === message) ?? 'offline';
}

/**
 * Which answer the board is allowed to believe.
 *
 * Every call here returns a whole board and writes it over the one on screen, and they were
 * guarded by two separate flags — `loading` for the fetch, `busy` for the three mutations — so
 * the two could always be in flight together. A `load` that went out before an add and came back
 * after it painted the pre-add board over the post-add one, and the friend the player had just
 * added vanished until they closed the sheet and opened it again. Removals came back the same
 * way, which is worse: a row the player had deleted was standing there again.
 *
 * A counter settles it without having to reason about which pairs can overlap. Every request
 * takes the next number, and only the newest may write the board — a request that has been
 * overtaken still clears its own flag and still reports its own error, because whether it was
 * superseded says nothing about whether it worked.
 */
let latestRequest = 0;

function claimRequest(): number {
  return ++latestRequest;
}

function isNewest(token: number): boolean {
  return token === latestRequest;
}

// Nothing here outlives the app any more: the board is refetched on every visit, and "new"
// is now read off the clock rather than off a remembered visit.
export const useFriendsStore = create<FriendsState>()((set, get) => ({
  code: null,
  entries: [],
  friendCount: 0,
  truncated: false,
  loading: false,
  busy: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    const token = claimRequest();
    set({ loading: true, error: null });
    try {
      const board = await apiRequest<BoardResponse>('/api/friends', 'GET');
      set({ ...(isNewest(token) ? board : {}), loading: false });
    } catch (error) {
      // The flag clears either way — this request is over however it ended — but the message
      // only belongs on screen if this request is still the one the screen is waiting for.
      // Sign-out invalidates in flight work and then clears the board, and the rejection that
      // follows (`apiRequest` refuses without a session) would otherwise write a failure across
      // a store that has already moved on.
      set({ loading: false, ...(isNewest(token) ? { error: toFriendsError(error) } : {}) });
    }
  },

  addFriend: async input => {
    // Checked here as well as on the server, so a typo never costs a round trip.
    const code = normalizeFriendCode(input);
    if (!code) {
      set({ error: 'invalid_code' });
      return false;
    }
    if (code === get().code) {
      set({ error: 'own_code' });
      return false;
    }

    const token = claimRequest();
    set({ busy: true, error: null });
    try {
      const board = await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'add', code });
      set({ ...(isNewest(token) ? board : {}), busy: false });
      return true;
    } catch (error) {
      set({ busy: false, ...(isNewest(token) ? { error: toFriendsError(error) } : {}) });
      return false;
    }
  },

  removeFriend: async handle => {
    const token = claimRequest();
    set({ busy: true, error: null });
    try {
      // `code` is the wire's name for it, and the server reads it as a handle for `remove`.
      const board = await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'remove', code: handle });
      set({ ...(isNewest(token) ? board : {}), busy: false });
    } catch (error) {
      // The server answers a handle it cannot place with `unknown_code`, which reads as "nobody
      // has that code" — nonsense to someone who just tapped a trash icon and typed nothing. On
      // this path it means the row is gone from under them: removed from the other side, or the
      // secret rotated and every handle with it. Both are fixed by reloading the board.
      const failure = toFriendsError(error);
      set({ busy: false, ...(isNewest(token) ? { error: failure === 'unknown_code' ? 'stale_row' : failure } : {}) });
    }
  },

  rotateCode: async () => {
    const token = claimRequest();
    set({ busy: true, error: null });
    try {
      const board = await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'rotate' });
      set({ ...(isNewest(token) ? board : {}), busy: false });
    } catch (error) {
      set({ busy: false, ...(isNewest(token) ? { error: toFriendsError(error) } : {}) });
    }
  },

  clearError: () => set({ error: null }),

  // Signing out has to drop the board: the next account must not inherit this one's friends.
  // Taking a number is part of that — a request sent by the account that just left is exactly
  // the answer that must not be believed, and it is still on its way.
  reset: () => {
    claimRequest();
    set({ code: null, entries: [], friendCount: 0, truncated: false, loading: false, busy: false, error: null });
  },
}));
