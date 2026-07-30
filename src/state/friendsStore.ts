import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { authClient } from '@/lib/auth-client';
import { normalizeFriendCode } from '@/lib/friendCode';
import { useAuthStore } from '@/state/authStore';

/** One row of the board. `artist` indexes ARTISTS, so the nickname is built on the device. */
export interface LeaderboardEntry {
  code: string | null;
  /** ISO timestamp of when the pair was made, or null for the player's own row. */
  addedAt: string | null;
  artist: number;
  points: number;
  medals: { gold: number; silver: number; bronze: number };
  solved: number;
  streak: number;
  isSelf: boolean;
}

/** The reasons an add can fail that the player can do something about. */
export type FriendsError = 'invalid_code' | 'unknown_code' | 'own_code' | 'too_many_friends' | 'offline';

interface FriendsState {
  code: string | null;
  entries: LeaderboardEntry[];
  loading: boolean;
  busy: boolean;
  error: FriendsError | null;
  /**
   * When the player last looked at the board. Persisted, because "new since you last looked"
   * has to survive the app being closed — which is exactly when someone else adds you.
   */
  seenAt: string | null;
  markBoardSeen: () => void;
  load: () => Promise<void>;
  addFriend: (code: string) => Promise<boolean>;
  removeFriend: (code: string) => Promise<void>;
  rotateCode: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

/** Friends added since the player last opened the board. Their own row never counts. */
export function newFriends(entries: LeaderboardEntry[], seenAt: string | null): LeaderboardEntry[] {
  return entries.filter(entry => !entry.isSelf && entry.addedAt && (!seenAt || entry.addedAt > seenAt));
}

type BoardResponse = { code: string; entries: LeaderboardEntry[] };

function apiUrl(): string {
  if (Platform.OS === 'web') return '/api/friends';
  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL;
  return base ? `${base.replace(/\/$/, '')}/api/friends` : '/api/friends';
}

/** Mirrors progressSync's request: the native client has no cookie jar of its own. */
async function request(method: 'GET' | 'POST', body?: unknown): Promise<BoardResponse> {
  if (!useAuthStore.getState().session) throw new Error('Missing auth session');
  const cookie = Platform.OS === 'web' ? null : authClient.getCookie();

  const response = await fetch(apiUrl(), {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `friends_${response.status}`);
  }

  return response.json() as Promise<BoardResponse>;
}

const KNOWN_ERRORS: FriendsError[] = ['invalid_code', 'unknown_code', 'own_code', 'too_many_friends'];

function toFriendsError(error: unknown): FriendsError {
  const message = error instanceof Error ? error.message : '';
  return KNOWN_ERRORS.find(known => known === message) ?? 'offline';
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
  code: null,
  entries: [],
  loading: false,
  busy: false,
  error: null,
  seenAt: null,

  markBoardSeen: () => set({ seenAt: new Date().toISOString() }),

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      set({ ...(await request('GET')), loading: false });
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
      set({ ...(await request('POST', { action: 'add', code })), busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
      return false;
    }
  },

  removeFriend: async code => {
    set({ busy: true, error: null });
    try {
      set({ ...(await request('POST', { action: 'remove', code })), busy: false });
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
    }
  },

  rotateCode: async () => {
    set({ busy: true, error: null });
    try {
      set({ ...(await request('POST', { action: 'rotate' })), busy: false });
    } catch (error) {
      set({ busy: false, error: toFriendsError(error) });
    }
  },

  clearError: () => set({ error: null }),

  // Signing out has to drop the board: the next account must not inherit this one's friends,
  // nor the mark of what it had already seen.
  reset: () => set({ code: null, entries: [], loading: false, busy: false, error: null, seenAt: null }),
    }),
    {
      name: 'bumi-friends-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the mark is worth keeping: the board itself is refetched on every visit.
      partialize: state => ({ seenAt: state.seenAt }),
    },
  ),
);
