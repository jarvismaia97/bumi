import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Whether to offer Apple sign-in at all, which is a different question from whether the native
 * sheet exists. Away from iOS the browser can do it, so the button is shown wherever the web
 * flow is configured — see `EXPO_PUBLIC_APPLE_WEB_SIGN_IN_ENABLED` and `authStore`.
 */
export function useAppleSignInOffered(): boolean {
  const nativeAvailable = useAppleSignInAvailable();
  if (Platform.OS === 'ios') return nativeAvailable;
  return process.env.EXPO_PUBLIC_APPLE_WEB_SIGN_IN_ENABLED === 'true';
}

/**
 * Whether this device can present the native sheet. Three things have to agree, and asking any
 * one of them alone gets it wrong: the platform, because only iOS has the sheet; the build flag,
 * because the web export has no native module behind it; and the device, because
 * `isAvailableAsync` is what knows whether this particular one can present it.
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
