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
