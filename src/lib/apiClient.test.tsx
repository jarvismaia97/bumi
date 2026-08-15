import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/apiClient';
import { useAuthStore } from '@/state/authStore';

vi.mock('@/lib/auth-client', () => ({
  AUTH_STORAGE_KEYS: [],
  authClient: { getCookie: () => null, getSession: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn() },
}));
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

const SESSION = { id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86_400_000) };
const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com' };

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useAuthStore.setState({ session: null, user: null, loading: false, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('talking to our own API', () => {
  it('refuses to send without a session rather than sending an unauthenticated request', async () => {
    const fetchMock = respond({ ok: true });

    await expect(apiRequest('/api/progress', 'GET')).rejects.toThrow('Missing auth session');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses even when a persisted user says who this is', async () => {
    // The cold-launch shape exactly: `user` comes back from storage and `session` never does.
    // Callers have to treat this as "not ready yet" — it is not a failure and there is nothing
    // a player can do about it — which is why the sync queue now waits for the session instead.
    useAuthStore.setState({ user: USER });
    const fetchMock = respond({ ok: true });

    await expect(apiRequest('/api/progress', 'GET')).rejects.toThrow('Missing auth session');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hands back what the server sent', async () => {
    useAuthStore.setState({ session: SESSION, user: USER });
    respond({ solvedLevelIdxs: [1, 2] });

    await expect(apiRequest('/api/progress', 'GET')).resolves.toEqual({ solvedLevelIdxs: [1, 2] });
  });

  it("throws with the server's own error code, which the friends board turns into a sentence", async () => {
    useAuthStore.setState({ session: SESSION, user: USER });
    respond({ error: 'too_many_friends' }, 409);

    await expect(apiRequest('/api/friends', 'POST', { action: 'add' })).rejects.toThrow('too_many_friends');
  });

  it('falls back to the status when the failure carries no code', async () => {
    useAuthStore.setState({ session: SESSION, user: USER });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      }),
    );

    await expect(apiRequest('/api/progress', 'GET')).rejects.toThrow('request_failed_502');
  });

  it('sends the body as JSON and says so, but only when there is one', async () => {
    useAuthStore.setState({ session: SESSION, user: USER });
    const fetchMock = respond({ ok: true });

    await apiRequest('/api/progress', 'POST', { hints: 3 });
    await apiRequest('/api/progress', 'GET');

    const [post, get] = fetchMock.mock.calls.map(([, init]) => init);
    expect(post.body).toBe('{"hints":3}');
    expect(post.headers['content-type']).toBe('application/json');
    expect(get.body).toBeUndefined();
    expect(get.headers['content-type']).toBeUndefined();
  });
});
