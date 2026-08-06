import { create } from 'zustand';
import { apiRequest } from '@/lib/apiClient';
import { getDailyDateKey } from '@/game/daily';
import { normalizeFriendCode } from '@/lib/friendCode';

/** One row of the board. `artist` indexes ARTISTS, so the nickname is built on the device. */
export interface LeaderboardEntry {
  code: string | null;
  /** ISO timestamp of when the pair was made, or null for the player's own row. */
  addedAt: string | null;
  /** The account's display name, or null when it has none and the painter stands in. */
  name: string | null;
  artist: number;
  points: number;
  medals: { gold: number; silver: number; bronze: number };
  solved: number;
  streak: number;
  isSelf: boolean;
}

/** The reasons an add can fail that the player can do something about. */
export type FriendsError = 'invalid_code' | 'unknown_code' | 'own_code' | 'too_many_friends' | 'too_many_attempts' | 'offline';

interface FriendsState {
  code: string | null;
  entries: LeaderboardEntry[];
  loading: boolean;
  busy: boolean;
  error: FriendsError | null;
  load: () => Promise<void>;
  addFriend: (code: string) => Promise<boolean>;
  removeFriend: (code: string) => Promise<void>;
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

type BoardResponse = { code: string; entries: LeaderboardEntry[] };

const KNOWN_ERRORS: FriendsError[] = ['invalid_code', 'unknown_code', 'own_code', 'too_many_friends', 'too_many_attempts'];

function toFriendsError(error: unknown): FriendsError {
  const message = error instanceof Error ? error.message : '';
  return KNOWN_ERRORS.find(known => known === message) ?? 'offline';
}

// Nothing here outlives the app any more: the board is refetched on every visit, and "new"
// is now read off the clock rather than off a remembered visit.
export const useFriendsStore = create<FriendsState>()((set, get) => ({
  code: null,
  entries: [],
  loading: false,
  busy: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      set({ ...(await apiRequest<BoardResponse>('/api/friends', 'GET')), loading: false });
    } catch (error) {
      set({ loading: false, error: toFriendsError(error) });
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

    set({ busy: true, error: null });
    try {
      set({ ...(await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'add', code })), busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
      return false;
    }
  },

  removeFriend: async code => {
    set({ busy: true, error: null });
    try {
      set({ ...(await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'remove', code })), busy: false });
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
    }
  },

  rotateCode: async () => {
    set({ busy: true, error: null });
    try {
      set({ ...(await apiRequest<BoardResponse>('/api/friends', 'POST', { action: 'rotate' })), busy: false });
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
    }
  },

  clearError: () => set({ error: null }),

  // Signing out has to drop the board: the next account must not inherit this one's friends.
  reset: () => set({ code: null, entries: [], loading: false, busy: false, error: null }),
}));
