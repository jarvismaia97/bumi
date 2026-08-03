import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Both guards are required. React Native sets global.window = global without a
// location, so `typeof window` alone is true on native and reading .origin
// throws. Static web rendering runs in node, where Platform.OS is 'web' but
// there is no window at all, so Platform.OS alone throws during export.
const baseURL =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://www.jogarbumi.pt';

const STORAGE_PREFIX = 'bumi';

/**
 * Where the session lives on a device. The expo plugin derives both from `storagePrefix` and
 * clears them itself when `/sign-out` succeeds, but that write is the one step of signing out
 * the app cannot observe the outcome of — so `signOut` deletes them again by name. Kept here
 * because they are this file's convention, and a rename that missed them would strand a
 * session on the device with nothing pointing at it.
 */
export const AUTH_STORAGE_KEYS = [`${STORAGE_PREFIX}_cookie`, `${STORAGE_PREFIX}_session_data`];

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'bumi',
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
    }),
  ],
});
