import { Platform } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/state/authStore';

/**
 * The one place that knows how this app talks to its own API. Progress sync and the friends
 * board had a copy each of the same three decisions — where the API lives, how the cookie
 * travels, and what a failure reads as — which is two chances to fix a bug in one of them.
 *
 * The cookie is the reason any of this exists: the web build is same-origin and rides the
 * browser's jar, while the native build has no jar at all and has to carry the session header
 * that better-auth handed it.
 */
export function apiUrl(path: string): string {
  if (Platform.OS === 'web') return path;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL;
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

/**
 * Throws with the server's own error code when it sends one — the friends board turns those
 * into sentences a player can act on — and with a status otherwise.
 */
export async function apiRequest<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!useAuthStore.getState().session) throw new Error('Missing auth session');
  const cookie = Platform.OS === 'web' ? null : authClient.getCookie();

  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
}
