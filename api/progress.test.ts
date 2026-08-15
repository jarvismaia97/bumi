import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The handler talks to Neon through a tagged template and to Expo through fetch, so both are
 * stood in for here: every statement it would have run is recorded as text plus parameters, and
 * a test says what each one answers. Hoisted because `vi.mock` factories run before the file's
 * own `const`s exist.
 */
const db = vi.hoisted(() => {
  const queries: { text: string; params: unknown[] }[] = [];
  const state = { rows: (_text: string, _params: unknown[]) => [] as unknown[] };
  return { queries, state };
});

vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings: TemplateStringsArray, ...params: unknown[]) => {
    const text = strings.reduce((acc, part, index) => acc + (index ? `$${index}` : '') + part, '');
    db.queries.push({ text, params });
    return Promise.resolve(db.state.rows(text, params));
  },
}));

// The real module opens a pg pool at import and throws without DATABASE_URL.
vi.mock('../src/lib/auth', () => ({
  getAuth: async () => ({ api: { getSession: async () => ({ user: { id: 'poster' } }) } }),
}));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: () => ({}) }));

const handler = (await import('./progress')).default;

function find(fragment: string) {
  return db.queries.find(query => query.text.includes(fragment));
}

async function request(method: string, body?: unknown): Promise<{ status: number; body: any }> {
  let status = 0;
  let payload = '';
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader() {
      return res;
    },
    send(text: string) {
      payload = text;
      return res;
    },
    end() {
      return res;
    },
  };
  await handler({ method, headers: {}, body } as unknown as Parameters<typeof handler>[0], res);
  return { status, body: payload ? JSON.parse(payload) : null };
}

beforeEach(() => {
  db.queries.length = 0;
  db.state.rows = () => [];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('progress handler', () => {
  it('answers 400, not 500, for a date key no calendar has', async () => {
    for (const body of [
      { progress: { dailyCompletionDates: ['20261340'] } },
      { progress: { streakFreezes: ['20260230'] } },
      { progress: { dailyCompletedDate: '20260231' } },
    ]) {
      // `::date` answers these with "date/time field value out of range", which reached the
      // client as a 500 for a payload it plainly got wrong.
      expect((await request('POST', body)).status).toBe(400);
    }
    expect(db.queries).toEqual([]);
  });

  it('still takes a day that exists', async () => {
    const { status } = await request('POST', { progress: { dailyCompletionDates: ['20260213'], dailyCompletedDate: '20260213' } });
    expect(status).toBe(200);
    expect(find('insert into daily_completions')).toBeDefined();
  });

  it('answers 400 when an array field is not an array, instead of throwing on the spread', async () => {
    expect((await request('POST', { solvedLevelIdxs: 5 })).status).toBe(400);
    expect((await request('POST', { progress: { dailyCompletionDates: 'nope' } })).status).toBe(400);
    expect((await request('POST', { progress: { streakFreezes: { '20260213': true } } })).status).toBe(400);
    expect(db.queries).toEqual([]);
  });

  it('refuses more entries than a player could have', async () => {
    const { status, body } = await request('POST', { solvedLevelIdxs: Array.from({ length: 501 }, (_, idx) => idx) });
    expect(status).toBe(400);
    expect(body.error).toBe('too_many_solved_level_idxs');
  });

  it('drops level indexes the campaign does not contain, which the int column cannot hold', async () => {
    const { status } = await request('POST', { solvedLevelIdxs: [1e20, -1, 4, 500, 2.5] });
    expect(status).toBe(200);
    expect(find('insert into solved_levels')?.params).toContain(JSON.stringify([4]));
  });

  it('never sends a non-number to the not-null hints column', async () => {
    const { status } = await request('POST', { progress: { hints: 'lots' } });
    expect(status).toBe(200);

    // NaN is what the old clamp returned here, and Neon serialises it as JSON null, which the
    // column refuses with a not_null_violation.
    const hints = find('insert into user_progress')!.params[1];
    expect(hints).toBe(0);
    expect(Number.isNaN(hints)).toBe(false);
  });

  it('merges each lifetime counter with greatest and derives the balance from them', async () => {
    // A balance moves both ways and no merge rule for one number survives that: `greatest` on it
    // resurrected every hint ever spent, and last-write-wins would have discarded every hint
    // earned on a device that had been offline. Counters only grow, so `greatest` is the only
    // merge either admits, and the balance is what falls out.
    await request('POST', { progress: { hintsEarned: 12, hintsSpent: 5 } });
    const upsert = find('insert into user_progress')!;

    expect(upsert.text).toContain('greatest(user_progress.hints_earned, excluded.hints_earned');
    expect(upsert.text).toContain('hints_spent = greatest(user_progress.hints_spent, excluded.hints_spent)');
    // The balance is never merged on its own; nothing takes the greater of two balances.
    expect(upsert.text).not.toContain('greatest(user_progress.hints, excluded.hints)');

    // hints, hints_earned, hints_spent — the balance the counters describe, then the counters.
    expect(upsert.params.slice(1, 4)).toEqual([7, 12, 5]);
  });

  it('ignores the legacy term for a post that carried the counters', async () => {
    // Null, and `greatest` in Postgres skips a null argument — which is the whole of the switch
    // between the two readings, and why a real pair of counters cannot be inflated by it.
    await request('POST', { progress: { hintsEarned: 12, hintsSpent: 5, hints: 7 } });
    expect(find('insert into user_progress')!.params).toContain(null);
  });

  it('reads a balance-only post as spent-plus-held, which is all such a post can say', async () => {
    // Both builds in the app stores send this and nothing else. Written as
    // `user_progress.hints_spent + <balance>`, it reproduces exactly the high-water behaviour
    // those builds were written against and can never roll their balance back.
    await request('POST', { progress: { hints: 7 } });
    const upsert = find('insert into user_progress')!;
    expect(upsert.text).toContain('user_progress.hints_spent + $');
    // Balance, then the counters it stands in for: all earned, nothing spent.
    expect(upsert.params.slice(1, 4)).toEqual([7, 7, 0]);
    expect(upsert.params).toContain(7);
  });

  it('refuses a counter no account could have reached rather than storing it forever', async () => {
    // These only grow and `integer` does not: one absurd value would be the larger one for good
    // and every honest post after it would fail. Falls back to the balance-only reading.
    await request('POST', { progress: { hintsEarned: 1e20, hintsSpent: 0, hints: 4 } });
    expect(find('insert into user_progress')!.params.slice(1, 4)).toEqual([4, 4, 0]);
  });

  it('takes only the counters, never one of them', async () => {
    // Half a pair says nothing: an earned total with no spend beside it reads as a balance that
    // has never been spent from, which is exactly the resurrection this replaces.
    await request('POST', { progress: { hintsEarned: 12, hints: 4 } });
    expect(find('insert into user_progress')!.params.slice(1, 4)).toEqual([4, 4, 0]);
  });

  it("reads the daily against the poster's own day and never the server's", async () => {
    db.state.rows = text => (text.includes('as day') ? [{ day: '2026-08-13' }] : []);

    const { status } = await request('POST', {
      progress: { dailyCompletionDates: ['20260813'], dailyDurations: { '20260813': 61_000 }, utcOffsetMinutes: -300 },
    });
    expect(status).toBe(200);

    const day = find('as day')!;
    expect(day.text).toContain("now() at time zone 'utc'");
    expect(day.text).toContain('utc_offset_minutes');

    // The offset the device just sent is stored before the day is read from the column.
    expect(db.queries.indexOf(find('utc_offset_minutes = excluded.utc_offset_minutes')!)).toBeLessThan(db.queries.indexOf(day));

    expect(find('select duration_ms from daily_completions')!.params).toContain('2026-08-13');
    expect(db.queries.some(query => query.text.includes('current_date'))).toBe(false);
  });

  it('tells only the friends the stamp actually moved, and retires a token Expo says is gone', async () => {
    let dailyReads = 0;
    db.state.rows = text => {
      // `as day`, not `make_interval` — the notice stamps carry the same expression now that
      // each one is measured against its own receiver's day, so matching the operator alone
      // would answer the stamp with a date row and never let it report who it moved.
      if (text.includes('as day')) return [{ day: '2026-08-13' }];
      if (text.includes('select duration_ms from daily_completions')) {
        // Before the write, then after it: a post that improved on the record.
        dailyReads += 1;
        return [{ duration_ms: dailyReads === 1 ? 300_000 : 60_000 }];
      }
      if (text.includes('from friendships')) {
        return [
          { token: 'ExponentPushToken[first]', language: 'en', user_id: 'friend-a', duration_ms: 120_000 },
          { token: 'ExponentPushToken[second]', language: 'en', user_id: 'friend-b', duration_ms: 120_000 },
        ];
      }
      // Only one of the two had a notice date left to move; the other was told already today.
      if (text.includes('daily_notice_date')) return [{ user_id: 'friend-a' }];
      if (text.includes('from "user"')) return [{ name: 'Poster' }];
      return [];
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
      })),
    );

    await request('POST', { progress: { dailyCompletionDates: ['20260813'], dailyDurations: { '20260813': 60_000 } } });

    const stamp = find('daily_notice_date')!;
    expect(stamp.text).toContain('returning user_id');
    // The stamp is the gate: it only moves a row that has not been told yet, and the send
    // follows what it moved, so two posts landing together cannot both get through.
    expect(stamp.text).toContain('daily_notice_date is null');
    expect(stamp.text).toContain('or daily_notice_date <');

    const sent = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as { body: string }).body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ExponentPushToken[first]');

    const retired = find('delete from push_tokens')!;
    expect(retired.params).toContain(JSON.stringify(['ExponentPushToken[first]']));
  });

  // "Already told today" is a fact about the person being told, so the cap is measured on their
  // clock and not the poster's. Stamped with the poster's day, two posters on opposite sides of
  // the date line write incomparable values into one column: a post from UTC+14 leaves tomorrow
  // there, and a genuine overtake posted from UTC-11 reads `tomorrow < today`, decides the
  // receiver has already heard, and says nothing — for the better part of two days.
  it('measures the notice cap on the receiver, not on whoever posted', async () => {
    db.state.rows = text => {
      if (text.includes('as day')) return [{ day: '2026-08-13' }];
      if (text.includes('from friendships')) {
        return [{ token: 'ExponentPushToken[a]', language: 'en', user_id: 'friend-a', duration_ms: 120_000 }];
      }
      if (text.includes('select duration_ms from daily_completions')) return [{ duration_ms: 300_000 }];
      if (text.includes('from "user"')) return [{ name: 'Poster' }];
      return [];
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));

    await request('POST', { progress: { dailyCompletionDates: ['20260813'], dailyDurations: { '20260813': 60_000 } } });

    for (const column of ['daily_notice_date', 'overtaken_notice_date']) {
      const stamp = db.queries.find(query => query.text.includes(`update profiles set ${column}`));
      if (!stamp) continue;
      // The row's own offset, read off the table being updated — not the poster's day bound in.
      expect(stamp.text).toContain('coalesce(profiles.utc_offset_minutes, 0)');
      expect(stamp.params).not.toContain('2026-08-13');
    }
  });

  it('logs and answers 500 when the database itself fails, rather than rejecting uncaught', async () => {
    db.state.rows = () => {
      throw new Error('connection lost');
    };
    const { status, body } = await request('GET');
    expect(status).toBe(500);
    expect(body.error).toBe('internal_error');
    expect(console.error).toHaveBeenCalled();
  });

  it('answers a GET with the shape the client merges against', async () => {
    db.state.rows = text => {
      if (text.includes('from user_progress')) {
        return [{ hints: 9, hints_earned: 14, hints_spent: 5, daily_completed_date: '2026-08-13' }];
      }
      if (text.includes('from daily_completions')) return [{ completed_date: '2026-08-13', duration_ms: '61000', hints_used: null }];
      if (text.includes('from solved_levels')) return [{ level_idx: 3, solved_at: '2026-08-01' }];
      if (text.includes('from level_medals')) return [{ level_idx: 3, medal: 'gold' }];
      return [];
    };
    const { status, body } = await request('GET');
    expect(status).toBe(200);
    expect(body).toEqual({
      progress: {
        hints: 9,
        hintsEarned: 14,
        hintsSpent: 5,
        dailyCompletedDate: '20260813',
        dailyCompletionDates: ['20260813'],
        dailyDurations: { '20260813': 61000 },
        dailyHints: {},
        streakFreezes: [],
      },
      solvedLevelIdxs: [3],
      solvedLevelDates: { 3: '20260801' },
      levelMedals: { 3: 'gold' },
    });
  });

  it('derives the balance it answers with from the counters, not from the stored column', async () => {
    // The column is kept for readers that predate the counters, and an API rolled back onto this
    // schema can inflate it while it runs — nine here against a pair that says four. The pair is
    // what nothing else has touched, so it is what the answer is built from.
    db.state.rows = text =>
      text.includes('from user_progress') ? [{ hints: 9, hints_earned: 10, hints_spent: 6, daily_completed_date: null }] : [];

    const { body } = await request('GET');
    expect(body.progress.hints).toBe(4);
  });

  it('caps the balance it answers with at the game\'s ceiling', async () => {
    db.state.rows = text =>
      text.includes('from user_progress') ? [{ hints: 0, hints_earned: 400, hints_spent: 0, daily_completed_date: null }] : [];

    const { body } = await request('GET');
    expect(body.progress.hints).toBe(15);
    expect(body.progress.hintsEarned).toBe(400);
  });
});

/**
 * The migration is applied by `npm run db:schema` against a real database, which no test here can
 * stand in for. What is pinned is the one property the whole upgrade rests on: the counters are
 * filled from the balance that is already in the row rather than from the column default, so
 * every player's balance is exactly what it was the moment before it ran. `add column not null
 * default 3` would have replaced every one of them with a starting grant.
 */
describe('the schema backfill', () => {
  const schema = readFileSync(new URL('../neon/schema.sql', import.meta.url), 'utf8');

  it('copies the existing balance into the counters instead of defaulting them', () => {
    expect(schema).toContain('update user_progress set hints_earned = hints, hints_spent = 0 where hints_earned is null');
  });

  it('adds the columns nullable, so the copy is not pre-empted by a default', () => {
    expect(schema).toContain('alter table user_progress add column if not exists hints_earned integer;');
    expect(schema).toContain('alter table user_progress add column if not exists hints_spent integer;');
    expect(schema).not.toMatch(/add column if not exists hints_(earned|spent) integer not null/);
  });

  it('runs the copy once, guarded on the column still being nullable', () => {
    expect(schema).toContain("and column_name = 'hints_earned' and is_nullable = 'YES'");
  });

  it('keeps the balance column, which every build in the app stores still posts', () => {
    expect(schema).not.toMatch(/alter table user_progress drop column if exists hints\b/);
  });
});
