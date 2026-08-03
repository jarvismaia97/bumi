import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Whether the Apple button can be shown at all. Three things have to agree, and asking any one
 * of them alone gets it wrong: the platform, because only iOS has the sheet; the build flag,
 * because the web export has no native module behind it; and the device, because
 * `isAvailableAsync` is what knows whether this particular one can present the sheet.
 *
 * It reads false on the first pass everywhere, since the check is asynchronous. The button
 * appears once it answers, rather than flashing and disappearing on the devices that cannot.
 */
export function useAppleSignInAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  const enabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, [enabled]);

  return available;
}
