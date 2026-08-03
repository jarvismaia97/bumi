import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authClient } from '@/lib/auth-client';
import { resetAuthStoreForTests, useAuthStore } from '@/state/authStore';
import { useProgressStore } from '@/state/progressStore';

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
    // A fresh launch has configured nothing, which is the state the SDK was being used from.
    resetAuthStoreForTests();
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

  it('configures the Google SDK before asking it to sign out', async () => {
    // It refuses to be called at all before it is configured, and an app launched with a session
    // already in place has configured nothing — so signing out was its first use of the SDK.
    const order: string[] = [];
    vi.mocked(GoogleSignin.configure).mockImplementation(() => void order.push('configure'));
    vi.mocked(GoogleSignin.signOut).mockImplementation(async () => {
      order.push('signOut');
      return null;
    });

    await useAuthStore.getState().signOut();

    expect(order).toEqual(['configure', 'signOut']);
  });

  it('takes the account progress with it and leaves the device settings alone', async () => {
    // The menu was still counting 386 levels and an eight-day streak under a signed-out player,
    // which is someone else's record. The reminder and the install prompt are this phone's, not
    // that account's, and someone changing account should not be quietly unsubscribed.
    useProgressStore.setState({
      solvedMap: { 0: true, 1: true },
      levelMedals: { 0: 'gold' },
      dailyCompletionDates: ['20260801', '20260802'],
      dailyCompletedDate: '20260802',
      dailyReminderEnabled: true,
      iosInstallPromptSeen: true,
    });

    await useAuthStore.getState().signOut();

    const progress = useProgressStore.getState();
    expect(progress.solvedMap).toEqual({});
    expect(progress.levelMedals).toEqual({});
    expect(progress.dailyCompletionDates).toEqual([]);
    expect(progress.dailyCompletedDate).toBeNull();
    expect(progress.dailyReminderEnabled).toBe(true);
    expect(progress.iosInstallPromptSeen).toBe(true);
  });

  it('still reports success when the keychain refuses', async () => {
    // The server has already accepted the sign-out by this point. Failing here would tell the
    // player they are still signed in when they are not.
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(new Error('keychain locked'));

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
