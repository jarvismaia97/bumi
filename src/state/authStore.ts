import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { authClient, AUTH_STORAGE_KEYS } from '@/lib/auth-client';
import { playHaptic } from '@/lib/haptics';
import { useProgressStore } from '@/state/progressStore';
import { Platform } from 'react-native';
import { resolveLanguage, translate } from '@/i18n/messages';
import { unregisterPushToken } from '@/lib/pushToken';
import { useFriendsStore } from '@/state/friendsStore';
import { useLanguageStore } from '@/state/languageStore';
import { getLocales } from 'expo-localization';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  init: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

let initialized = false;
/** Whether the server ever answered. A rejected request leaves this false so init can retry. */
let sessionResolved = false;
let googleConfigured = false;

/** Thrown when the user dismisses the native Google sheet; not surfaced as an error. */
const GOOGLE_CANCELLED = 'google/cancelled';

/** Store-aware, but usable outside React: auth errors surface before any hook can run. */
function currentLanguage() {
  const preference = useLanguageStore.getState().preference;
  return preference === 'auto' ? resolveLanguage(getLocales()[0]?.languageCode) : preference;
}

/**
 * The session as it exists on the device, removed by name. Web has no SecureStore and keeps its
 * session in a cookie the server expires, so there is nothing here for it to do. Failures are
 * swallowed: a key that was already gone, or a keychain that refuses, must not turn a sign-out
 * the server has already accepted into an error the player is shown.
 */
async function forgetStoredSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(AUTH_STORAGE_KEYS.map(key => SecureStore.deleteItemAsync(key).catch(() => {})));
}

/**
 * Every entry point into the Google SDK goes through here first. It refuses to be called at all
 * before it is configured, and the flag guarding this is per-process: an app launched with a
 * session already in place has never configured it, so the first thing such a launch can do —
 * sign out — was reaching an SDK that had not been set up.
 */
async function google() {
  const module = await import('@react-native-google-signin/google-signin');

  if (!googleConfigured) {
    module.GoogleSignin.configure({
      // Drives the id-token audience, so it must match the server's GOOGLE_CLIENT_ID.
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    googleConfigured = true;
  }

  return module;
}

/** Same contract: best effort, and never the reason a completed sign-out reports failure. */
async function forgetGoogleAccount(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { GoogleSignin } = await google();
    await GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of, or the module never loaded on this platform.
  }
}

async function signInWithGoogleNative(): Promise<string> {
  const { GoogleSignin, statusCodes, isSuccessResponse } = await google();

  await GoogleSignin.hasPlayServices();

  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new Error(GOOGLE_CANCELLED);

    const idToken = response.data.idToken;
    if (!idToken) throw new Error(translate(currentLanguage(), 'auth.googleFailed'));
    return idToken;
  } catch (error) {
    if ((error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error(GOOGLE_CANCELLED);
    }
    throw error;
  }
}
function setSession(
  set: (state: Partial<AuthState>) => void,
  data: { session: AuthSession; user: AuthUser } | null,
  error?: { message?: string } | null
) {
  set({
    session: data?.session ?? null,
    user: data?.user ?? null,
    loading: false,
    error: error?.message ?? null,
  });
}

/**
 * Signing in is felt at the outcome rather than at the button, because only here is a real
 * session distinguishable from a provider sheet the player simply dismissed. Restoring a
 * session on launch runs through `setSession` directly and stays silent — nobody tapped.
 */
function signedIn(data: { user: AuthUser } | null): void {
  if (data?.user) playHaptic('success');
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  loading: true,
  error: null,

  /**
   * Asks the server who this is, and stops asking once it has an answer.
   *
   * The answer can fail to arrive at all: `getSession` rejects on a dead network rather than
   * resolving with an error, and without a `catch` the rejection left `loading` true forever —
   * the app sat on "Getting ready…" and never opened. Offline play is the thing the store
   * listing promises, and it was the one state that could not reach the game.
   *
   * A failure is not a signed-out player, so nothing is cleared: the session stays unknown, the
   * board keeps whatever is on this device, and the question is asked again on the next resume.
   * Only `signOut` empties anything.
   */
  init: () => {
    if (initialized && sessionResolved) return;
    initialized = true;

    authClient.getSession()
      .then(({ data, error }) => {
        sessionResolved = true;
        setSession(set, data ?? null, error);
      })
      .catch(() => set({ loading: false }));
  },

  signInWithGoogle: async () => {
    set({ error: null });

    if (Platform.OS !== 'web') {
      let idToken: string;
      try {
        idToken = await signInWithGoogleNative();
      } catch (error) {
        // A dismissed sheet is not a failure; leave the screen untouched.
        if ((error as Error).message === GOOGLE_CANCELLED) return;
        set({ error: (error as Error).message });
        playHaptic('error');
        throw error;
      }

      const { error } = await authClient.signIn.social({
        provider: 'google',
        idToken: { token: idToken },
      });
      if (error) {
        set({ error: error.message });
        playHaptic('error');
        throw error;
      }

      const session = await authClient.getSession();
      setSession(set, session.data ?? null, session.error);
      signedIn(session.data ?? null);
      return;
    }

    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.pathname}${window.location.search}`,
    });
    if (error) {
      set({ error: error.message });
      playHaptic('error');
      throw error;
    }

    const session = await authClient.getSession();
    setSession(set, session.data ?? null, session.error);
    signedIn(session.data ?? null);
  },

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') throw new Error(translate(currentLanguage(), 'auth.appleUnavailable'));
    set({ error: null });
    const AppleAuthentication = await import('expo-apple-authentication');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error(translate(currentLanguage(), 'auth.appleFailed'));

    // Everything above throws on a cancelled Apple sheet as well as on a real failure, and
    // the two are not told apart here, so only the server's verdict below is felt.
    const { error } = await authClient.signIn.social({
      provider: 'apple',
      idToken: { token: credential.identityToken },
    });
    if (error) {
      set({ error: error.message });
      playHaptic('error');
      throw error;
    }
    const session = await authClient.getSession();
    setSession(set, session.data ?? null, session.error);
    signedIn(session.data ?? null);
  },

  signOut: async () => {
    // Before the session goes: the request that hands the token back needs it, and a device
    // left registered keeps receiving notifications for an account nobody is using on it.
    await unregisterPushToken();
    const { error } = await authClient.signOut();
    if (error) {
      set({ error: error.message });
      playHaptic('error');
      throw error;
    }
    // Only now that the request carrying it has been answered. The plugin clears its own copy
    // on a successful `/sign-out`, but a session that outlives the tap is the one failure worth
    // being redundant about — the player is told they left, and the next launch reads whatever
    // is still on the device.
    await forgetStoredSession();
    // Google keeps its own account attached, and the next `signIn()` would take it without
    // asking. Someone signing out to hand the phone over, or to change account, means this too.
    await forgetGoogleAccount();
    // A committed account change, not an achievement: the flat thud of impact rather than
    // the rising notification pattern that would congratulate someone for leaving.
    playHaptic('medium');
    // The board belongs to the account, not the device: leaving it behind would show the next
    // person to sign in a set of friends that are not theirs. The progress is the same argument
    // — a menu still counting 386 levels and an eight-day streak under a signed-out player is
    // reading someone else's record. The server holds it; signing back in brings it back.
    useFriendsStore.getState().reset();
    useProgressStore.getState().clearAccountProgress();
    set({ session: null, user: null, error: null });
  },

  deleteAccount: async () => {
    set({ error: null });
    await unregisterPushToken();
    const { error } = await authClient.deleteUser({});
    if (error) {
      set({ error: error.message });
      playHaptic('error');
      throw error;
    }
    // The account no longer exists, so anything still on the device points at nothing.
    await forgetStoredSession();
    await forgetGoogleAccount();
    // Deliberately silent on success: the confirmation tap already fired `warning`, and the
    // sheet closing onto a signed-out menu says the rest.
    useProgressStore.getState().reset();
    useFriendsStore.getState().reset();
    set({ session: null, user: null, error: null });
  },
}));

export function resetAuthStoreForTests(): void {
  initialized = false;
  sessionResolved = false;
  // Per-process in the app, so a test that asserts the SDK is configured before it is used has
  // to be able to put it back to how a fresh launch finds it.
  googleConfigured = false;
  useAuthStore.setState({ session: null, user: null, loading: true, error: null });
}
