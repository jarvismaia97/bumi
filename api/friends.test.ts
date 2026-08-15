import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The friends endpoint, exercised through its handler against a fake Postgres.
 *
 * What is worth pinning here is the pair of properties the board rests on: a row never carries
 * anybody's add-code, and removal never asks whether a code exists. The second one is why the
 * fake records every statement — several tests assert on what was *not* asked, which is the only
 * way to state "this path cannot be used as an oracle" as a test rather than as a comment.
 */

// Read at module scope by friends.ts (and thrown on by src/lib/auth, which is mocked away), so
// they have to be set before the import rather than in a beforeEach.
const SECRET = 'test-secret-for-removal-handles';
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://fake/fake';
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-removal-handles';
  process.env.BETTER_AUTH_URL = 'https://www.jogarbumi.pt';
});

const MAX_ATTEMPTS_PER_HOUR = 20;
const MAX_FRIENDS = 30;

type Row = Record<string, unknown>;

const db = {
  profiles: new Map<string, string>(),
  friendships: [] as { user_id: string; friend_id: string; created_at: string }[],
  attempts: [] as { user_id: string; succeeded: boolean }[],
};
/** Every statement the handler ran, whitespace-collapsed, so tests can assert on absence. */
let statements: string[] = [];
let sessionUser: string | null = 'user-a';

function befriend(a: string, b: string) {
  const created_at = new Date(2026, 0, 1).toISOString();
  db.friendships.push({ user_id: a, friend_id: b, created_at }, { user_id: b, friend_id: a, created_at });
}

/**
 * A stand-in for the neon HTTP driver: routes on the text of the statement and answers from the
 * maps above. It only knows the statements this handler issues — an unrouted one throws rather
 * than returning [], because a silently empty result is how a rewritten query passes a test it
 * is no longer exercising.
 */
function fakeSql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  const text = strings.join(' ? ').replace(/\s+/g, ' ').trim();
  statements.push(text);
  return Promise.resolve(route(text, values));
}

function route(text: string, values: unknown[]): Row[] {
  // The CTEs come first: each one mentions half a dozen tables in its subqueries, so matching
  // them on a fragment would steal statements the simpler branches below are meant to answer.
  // The stats query: every column the board reads, at zero. Nothing here is under test.
  if (text.startsWith('with wanted as')) {
    return (JSON.parse(values[0] as string) as string[]).map(user_id => ({
      user_id,
      name: null,
      gold: 0,
      silver: 0,
      bronze: 0,
      solved: 0,
      streak: 0,
      daily_ms: null,
      daily_hints: null,
      daily_done: false,
    }));
  }

  // The metering CTE: count the misses, insert only under the ceiling, answer whether it did.
  if (text.startsWith('with recent as')) {
    const [userId, , succeeded, max] = values as [string, string, boolean, number];
    const misses = db.attempts.filter(row => row.user_id === userId && !row.succeeded).length;
    const allowed = misses < max;
    if (allowed) db.attempts.push({ user_id: userId, succeeded });
    return [{ allowed }];
  }

  // The add CTE: both sides' ceilings and the two inserts in one statement.
  if (text.startsWith('with existing as')) {
    const [userId, targetId, , max] = values as [string, string, string, number];
    const has = (a: string, b: string) => db.friendships.some(row => row.user_id === a && row.friend_id === b);
    const count = (a: string) => db.friendships.filter(row => row.user_id === a).length;
    const ok = has(userId, targetId) || (count(userId) < max && count(targetId) < max);
    let inserted = 0;
    if (ok) {
      for (const [a, b] of [[userId, targetId], [targetId, userId]]) {
        if (has(a, b)) continue;
        db.friendships.push({ user_id: a, friend_id: b, created_at: new Date().toISOString() });
        inserted += 1;
      }
    }
    return [{ ok, inserted }];
  }

  if (text.startsWith('select user_id, friend_code from profiles where user_id')) {
    const code = db.profiles.get(values[0] as string);
    return code ? [{ user_id: values[0], friend_code: code }] : [];
  }

  // The global code lookup — the one statement the removal path must never reach.
  if (text.startsWith('select user_id, friend_code from profiles where friend_code')) {
    for (const [userId, code] of db.profiles) if (code === values[0]) return [{ user_id: userId, friend_code: code }];
    return [];
  }

  if (text.startsWith('select friend_id, created_at from friendships')) {
    return db.friendships
      .filter(row => row.user_id === values[0])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(row => ({ friend_id: row.friend_id, created_at: row.created_at }));
  }

  if (text.startsWith('select friend_id from friendships')) {
    return db.friendships.filter(row => row.user_id === values[0]).map(row => ({ friend_id: row.friend_id }));
  }

  if (text.startsWith('delete from friendships')) {
    const [userId, targetId] = values as [string, string];
    db.friendships = db.friendships.filter(
      row => !((row.user_id === userId && row.friend_id === targetId) || (row.user_id === targetId && row.friend_id === userId)),
    );
    return [];
  }

  if (text.startsWith('select push_tokens.token')) return [];
  if (text.includes('update profiles set friend_code')) {
    db.profiles.set(values[1] as string, values[0] as string);
    return [{ friend_code: values[0] }];
  }

  throw new Error(`unrouted statement: ${text}`);
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => fakeSql }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (headers: unknown) => headers }));
vi.mock('../src/lib/auth', () => ({
  getAuth: async () => ({ api: { getSession: async () => (sessionUser ? { user: { id: sessionUser } } : null) } }),
}));

const handler = (await import('./friends')).default;

type Reply = { status: number; body: any };

async function call(method: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  const reply: Reply = { status: 0, body: undefined };
  const sent: Record<string, string> = {};
  const res: any = {
    status(code: number) {
      reply.status = code;
      return res;
    },
    setHeader(key: string, value: string) {
      sent[key] = value;
      return res;
    },
    send(payload: string) {
      reply.body = JSON.parse(payload);
      return res;
    },
    end() {
      return res;
    },
  };
  await handler({ method, headers, body } as any, res);
  reply.body ??= undefined;
  (reply as any).headers = sent;
  return reply;
}

/** The scheme under test, restated independently: an HMAC over the viewing pair. */
function expectedHandle(viewerId: string, friendId: string): string {
  return createHmac('sha256', SECRET).update(`friend-removal ${viewerId} ${friendId}`).digest('hex').slice(0, 32);
}

const askedForACode = () => statements.some(text => text.includes('from profiles where friend_code'));

beforeEach(() => {
  db.profiles = new Map([
    ['user-a', 'AAAAAA'],
    ['user-b', 'BBBBBB'],
    ['user-c', 'CCCCCC'],
  ]);
  db.friendships = [];
  db.attempts = [];
  statements = [];
  sessionUser = 'user-a';
});

describe('the board never carries anybody else’s code', () => {
  it('names a friend by a per-viewer handle, and keeps the player’s own code at the top', async () => {
    befriend('user-a', 'user-b');
    const { status, body } = await call('GET');

    expect(status).toBe(200);
    // The one code in the response is the player's own — the one they hand out on purpose.
    expect(body.code).toBe('AAAAAA');
    expect(JSON.stringify(body)).not.toContain('BBBBBB');

    const friend = body.entries.find((entry: any) => !entry.isSelf);
    expect(friend.code).toBe(expectedHandle('user-a', 'user-b'));
    expect(friend.code).toMatch(/^[0-9a-f]{32}$/);
    // Nothing to remove on your own row, so nothing to name it with.
    expect(body.entries.find((entry: any) => entry.isSelf).code).toBeNull();
  });

  it('gives two viewers different handles for the same friend', async () => {
    befriend('user-a', 'user-b');
    befriend('user-c', 'user-b');

    const asA = await call('GET');
    sessionUser = 'user-c';
    const asC = await call('GET');

    const handleOf = (reply: Reply) => reply.body.entries.find((entry: any) => !entry.isSelf).code;
    expect(handleOf(asA)).not.toBe(handleOf(asC));
    expect(handleOf(asC)).toBe(expectedHandle('user-c', 'user-b'));
  });

  it('says how many friends there are when the board cannot paint them all', async () => {
    for (let i = 0; i < MAX_FRIENDS + 2; i++) befriend('user-a', `friend-${i}`);
    const { body } = await call('GET');

    expect(body.friendCount).toBe(MAX_FRIENDS + 2);
    expect(body.truncated).toBe(true);
    expect(body.entries).toHaveLength(MAX_FRIENDS + 1);
  });
});

describe('removing by handle', () => {
  it('drops the pair in both directions without ever looking a code up', async () => {
    befriend('user-a', 'user-b');
    statements = [];

    const { status, body } = await call('POST', { action: 'remove', code: expectedHandle('user-a', 'user-b') });
    expect(status).toBe(200);
    expect(db.friendships).toHaveLength(0);
    expect(body.entries).toHaveLength(1);
    expect(askedForACode()).toBe(false);
  });

  it('refuses a handle the caller does not hold, and spends an attempt saying so', async () => {
    befriend('user-a', 'user-b');
    statements = [];

    const { status, body } = await call('POST', { action: 'remove', code: 'f'.repeat(32) });

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'unknown_code' });
    expect(db.attempts).toEqual([{ user_id: 'user-a', succeeded: false }]);
    expect(askedForACode()).toBe(false);
  });

  it('will not resolve somebody else’s real friend code, which is what made it an oracle', async () => {
    befriend('user-a', 'user-b');
    statements = [];

    // 'CCCCCC' exists and belongs to a stranger; 'ZZZZZZ' belongs to nobody. The endpoint used
    // to tell those two apart for free. Both answers must now be identical, and neither may
    // reach the code table.
    const real = await call('POST', { action: 'remove', code: 'CCCCCC' });
    const fake = await call('POST', { action: 'remove', code: 'ZZZZZZ' });

    expect(real.status).toBe(404);
    expect(real.body).toEqual(fake.body);
    expect(fake.status).toBe(404);
    expect(askedForACode()).toBe(false);
    expect(db.friendships).toHaveLength(2);
  });

  it('does not spend the ceiling on a removal that worked', async () => {
    befriend('user-a', 'user-b');
    await call('POST', { action: 'remove', code: expectedHandle('user-a', 'user-b') });

    expect(db.attempts).toEqual([{ user_id: 'user-a', succeeded: true }]);
    // The hit is recorded but not counted, so the misses budget is still whole.
    const guess = await call('POST', { action: 'remove', code: '0'.repeat(32) });
    expect(guess.status).toBe(404);
  });
});

describe('the hourly ceiling', () => {
  it('meters removals, so `remove` is no longer the way around it', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) {
      const { status } = await call('POST', { action: 'remove', code: i.toString().padStart(32, '0') });
      expect(status).toBe(404);
    }

    const { status, body } = await call('POST', { action: 'remove', code: 'a'.repeat(32) });
    expect(status).toBe(429);
    expect(body).toEqual({ error: 'too_many_attempts' });
  });

  it('holds across both actions rather than per action', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) {
      await call('POST', { action: 'remove', code: i.toString().padStart(32, '0') });
    }

    // The budget is one budget: nothing is left for adding either.
    expect((await call('POST', { action: 'add', code: 'ZZZZZZ' })).status).toBe(429);
  });

  it('stops a real add from acting once the ceiling is reached, and says nothing about the code', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_HOUR; i++) {
      await call('POST', { action: 'add', code: 'ZZZZZZ' });
    }

    const { status, body } = await call('POST', { action: 'add', code: 'BBBBBB' });
    expect(status).toBe(429);
    expect(body).toEqual({ error: 'too_many_attempts' });
    expect(db.friendships).toHaveLength(0);
  });
});

describe('adding', () => {
  it('makes the pair mutual and meters the hit without counting it', async () => {
    const { status, body } = await call('POST', { action: 'add', code: 'BBBBBB' });

    expect(status).toBe(200);
    expect(db.friendships).toHaveLength(2);
    expect(db.attempts).toEqual([{ user_id: 'user-a', succeeded: true }]);
    expect(body.entries.find((entry: any) => !entry.isSelf).code).toBe(expectedHandle('user-a', 'user-b'));
  });

  it('refuses when the code’s owner is full, not only when the adder is', async () => {
    for (let i = 0; i < MAX_FRIENDS; i++) befriend('user-b', `crowd-${i}`);

    const { status, body } = await call('POST', { action: 'add', code: 'BBBBBB' });

    expect(status).toBe(409);
    expect(body).toEqual({ error: 'too_many_friends' });
    expect(db.friendships.some(row => row.user_id === 'user-a')).toBe(false);
  });

  it('stays quiet when the pair already exists, rather than reading as full', async () => {
    befriend('user-a', 'user-b');
    for (let i = 0; i < MAX_FRIENDS; i++) befriend('user-b', `crowd-${i}`);

    const { status } = await call('POST', { action: 'add', code: 'BBBBBB' });
    expect(status).toBe(200);
  });
});

describe('cross-origin', () => {
  it('answers only the origins the app is served from', async () => {
    const allowed = await call('GET', undefined, { origin: 'https://www.jogarbumi.pt' });
    expect((allowed as any).headers['access-control-allow-origin']).toBe('https://www.jogarbumi.pt');

    const stranger = await call('GET', undefined, { origin: 'https://evil.example' });
    expect((stranger as any).headers['access-control-allow-origin']).toBeUndefined();
  });
});
