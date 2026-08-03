import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/state/authStore';

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));
vi.mock('@/lib/pushToken', () => ({ unregisterPushToken: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/auth-client', () => ({
  AUTH_STORAGE_KEYS: ['bumi_cookie', 'bumi_session_data'],
  authClient: {
    signOut: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Every test here is about the native path; `Platform.OS` is 'web' under jsdom, where the
// keychain does not exist and the function returns before touching it.
const realOS = Platform.OS;

describe('signOut on a device', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    vi.clearAllMocks();
    useAuthStore.setState({ session: null, user: null, loading: false, error: null });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  });

  it('deletes the session the expo plugin stored, by name', async () => {
    await useAuthStore.getState().signOut();

    const deleted = vi.mocked(SecureStore.deleteItemAsync).mock.calls.map(([key]) => key);
    expect(deleted).toContain('bumi_cookie');
    expect(deleted).toContain('bumi_session_data');
  });

  it('deletes it only after the request that carries it has been answered', async () => {
    // Clearing first would strip the cookie off the sign-out request itself, and the session
    // would stay alive on the server while the device forgot it — the worse half of this bug.
    const order: string[] = [];
    vi.mocked(authClient.signOut).mockImplementation(async () => {
      order.push('request');
      return { error: null } as Awaited<ReturnType<typeof authClient.signOut>>;
    });
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => {
      order.push('delete');
    });

    await useAuthStore.getState().signOut();

    expect(order[0]).toBe('request');
    expect(order).toContain('delete');
  });

  it('still reports success when the keychain refuses', async () => {
    // The server has already accepted the sign-out by this point. Failing here would tell the
    // player they are still signed in when they are not.
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(new Error('keychain locked'));

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
