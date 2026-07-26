import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://www.jogarbumi.pt';

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'bumi',
      storagePrefix: 'bumi',
      storage: SecureStore,
    }),
  ],
});
