import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// React Native sets global.window = global but never defines window.location,
// so `typeof window !== 'undefined'` is true on native and reading .origin
// throws at module load. Platform.OS is the only reliable web check.
const baseURL =
  Platform.OS === 'web'
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
