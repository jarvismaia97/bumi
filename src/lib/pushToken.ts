import { Platform } from 'react-native';
import { apiRequest } from '@/lib/apiClient';
import { resolveLanguage } from '@/i18n/messages';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';

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
async function currentToken(): Promise<string | null> {
  // Both imports are loaded on demand: they reach native modules, and this file is on the
  // import path of the auth store, which plenty of tests and the web build both pull in.
  const Notifications = await import('expo-notifications');
  const Constants = (await import('expo-constants')).default;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data || null;
}

/** The language the notification should arrive in: the player's choice, or their device's. */
function notificationLanguage(): string {
  const preference = useLanguageStore.getState().preference;
  return preference === 'auto' ? resolveLanguage(null) : preference;
}

export async function registerPushToken(): Promise<'registered' | 'no-permission' | 'unsupported' | 'failed'> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!useAuthStore.getState().session) return 'failed';

  try {
    const token = await currentToken();
    if (!token) return 'no-permission';

    await apiRequest('/api/push-token', 'POST', {
      token,
      platform: Platform.OS,
      language: notificationLanguage(),
    });
    return 'registered';
  } catch {
    // A device that cannot be reached is not a reason to interrupt anything.
    return 'failed';
  }
}

/**
 * Hands the token back on the way out. Called before the session is torn down, because the
 * request needs it — and because a device left registered keeps answering for an account
 * nobody is signed into on it.
 */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const token = await currentToken();
    if (!token) return;
    await apiRequest('/api/push-token', 'POST', { token, action: 'unregister' });
  } catch {
    // Signing out is not allowed to fail because a token could not be handed back.
  }
}
