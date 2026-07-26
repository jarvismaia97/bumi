import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import { useProgressStore } from '@/state/progressStore';
import { Platform } from 'react-native';

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
let googleConfigured = false;

/** Thrown when the user dismisses the native Google sheet; not surfaced as an error. */
const GOOGLE_CANCELLED = 'google/cancelled';

async function signInWithGoogleNative(): Promise<string> {
  const { GoogleSignin, statusCodes, isSuccessResponse } = await import(
    '@react-native-google-signin/google-signin'
  );

  if (!googleConfigured) {
    GoogleSignin.configure({
      // Drives the id-token audience, so it must match the server's GOOGLE_CLIENT_ID.
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    googleConfigured = true;
  }

  await GoogleSignin.hasPlayServices();

  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new Error(GOOGLE_CANCELLED);

    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Não foi possível confirmar a identidade Google.');
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

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  loading: true,
  error: null,

  init: () => {
    if (initialized) return;
    initialized = true;

    authClient.getSession().then(({ data, error }) => {
      setSession(set, data ?? null, error);
    });
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
        throw error;
      }

      const { error } = await authClient.signIn.social({
        provider: 'google',
        idToken: { token: idToken },
      });
      if (error) {
        set({ error: error.message });
        throw error;
      }

      const session = await authClient.getSession();
      setSession(set, session.data ?? null, session.error);
      return;
    }

    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.pathname}${window.location.search}`,
    });
    if (error) {
      set({ error: error.message });
      throw error;
    }

    const session = await authClient.getSession();
    setSession(set, session.data ?? null, session.error);
  },

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') throw new Error('O início de sessão Apple só está disponível no iPhone e iPad.');
    set({ error: null });
    const AppleAuthentication = await import('expo-apple-authentication');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error('Não foi possível confirmar a identidade Apple.');

    const { error } = await authClient.signIn.social({
      provider: 'apple',
      idToken: { token: credential.identityToken },
    });
    if (error) {
      set({ error: error.message });
      throw error;
    }
    const session = await authClient.getSession();
    setSession(set, session.data ?? null, session.error);
  },

  signOut: async () => {
    const { error } = await authClient.signOut();
    if (error) {
      set({ error: error.message });
      throw error;
    }
    set({ session: null, user: null, error: null });
  },

  deleteAccount: async () => {
    set({ error: null });
    const { error } = await authClient.deleteUser({});
    if (error) {
      set({ error: error.message });
      throw error;
    }
    useProgressStore.getState().reset();
    set({ session: null, user: null, error: null });
  },
}));

export function resetAuthStoreForTests(): void {
  initialized = false;
  useAuthStore.setState({ session: null, user: null, loading: true, error: null });
}
