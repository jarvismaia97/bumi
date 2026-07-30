import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/state/authStore';

/**
 * Registers this device for the one push the game sends: someone used your friend code. It is
 * deliberately silent about permission — `getPermissionsAsync` is asked, never
 * `requestPermissions` — so no new prompt appears. Players who already allowed notifications
 * for the daily reminder get told when they are added; the rest simply are not, which is a
 * better trade than a second permission sheet for a feature nobody has used yet.
 *
 * Web has no Expo push token, and a browser would need its own Web Push plumbing, so it opts
 * out here rather than failing per call.
 */
export async function registerPushToken(): Promise<'registered' | 'no-permission' | 'unsupported' | 'failed'> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!useAuthStore.getState().session) return 'failed';

  try {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return 'no-permission';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return 'failed';

    const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL ?? '';
    const response = await fetch(`${base.replace(/\/$/, '')}/api/push-token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authClient.getCookie() ? { cookie: authClient.getCookie() as string } : {}),
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    return response.ok ? 'registered' : 'failed';
  } catch {
    // A device that cannot be reached is not a reason to interrupt anything.
    return 'failed';
  }
}
