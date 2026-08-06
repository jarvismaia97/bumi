import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '../src/lib/auth';
import type { Medal } from '../src/game/medals';
import { normalizeHintCount } from '../src/game/hints';

type ProgressPayload = {
  hints?: number;
  dailyCompletedDate?: string | null;
  dailyCompletionDates?: string[];
  /** Milliseconds per daily, keyed by the puzzle's own `YYYYMMDD`. Sparse by design. */
  dailyDurations?: Record<string, number>;
  /** Days a streak freeze covered. Kept apart from completions on purpose; see the schema. */
  streakFreezes?: string[];
};

/**
 * A day's time as the database will take it, or null to leave the column alone. Anything that
 * is not a positive whole number of milliseconds under a day is a client bug or a lie, and a
 * board sorted by the smallest number is exactly where a lie would be rewarded.
 */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

function toDurationMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded < MAX_DURATION_MS ? rounded : null;
}

type PostBody = {
  progress?: ProgressPayload;
  solvedLevelIdxs?: number[];
  levelMedals?: Record<string, Medal>;
};

/** Neon returns untyped rows, so the shape of each query is declared where it is read. */
type ProgressRow = { hints: number; daily_completed_date: string | Date | null };
type DailyRow = { completed_date: string | Date | null; duration_ms: number | string | null };
type FreezeRow = { frozen_date: string | Date | null };
type SolvedRow = { level_idx: number; solved_at: string | Date | null };
type MedalRow = { level_idx: number; medal: Medal };

const databaseUrl = process.env.DATABASE_URL;

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify(body));
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function toPgDate(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  if (/^\d{8}$/.test(key)) return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  return null;
}

function fromPgDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10).replace(/-/g, '');
  if (typeof value === 'string') return value.slice(0, 10).replace(/-/g, '');
  return null;
}

function parseBody(req: VercelRequest): PostBody {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body) as PostBody;
  return req.body as PostBody;
}

async function getUserId(req: VercelRequest): Promise<string | null> {
  const { fromNodeHeaders } = await import('better-auth/node');
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!databaseUrl) {
    sendJson(res, 500, { error: 'DATABASE_URL is not configured' });
    return;
  }

  const userId = await getUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const sql = neon(databaseUrl);

  if (req.method === 'GET') {
    const [progressRows, solvedRows, dailyRows, medalRows, freezeRows] = await Promise.all([
      sql`
        select hints, daily_completed_date
        from user_progress
        where user_id = ${userId}
      `,
      sql`
        select level_idx, solved_at
        from solved_levels
        where user_id = ${userId}
        order by level_idx asc
      `,
      sql`
        select completed_date, duration_ms
        from daily_completions
        where user_id = ${userId}
        order by completed_date asc
      `,
      sql`
        select level_idx, medal
        from level_medals
        where user_id = ${userId}
      `,
      sql`
        select frozen_date
        from streak_freezes
        where user_id = ${userId}
        order by frozen_date asc
      `,
    ]);

    const progress = progressRows[0] as ProgressRow | undefined;

    sendJson(res, 200, {
      progress: progress
        ? {
            hints: normalizeHintCount(progress.hints),
            dailyCompletedDate: fromPgDate(progress.daily_completed_date),
            dailyCompletionDates: (dailyRows as DailyRow[]).map(row => fromPgDate(row.completed_date)).filter(Boolean),
            // Only the days that have a time; the rest stay absent rather than arriving as zero,
            // which the board would otherwise read as the fastest solve ever recorded.
            dailyDurations: Object.fromEntries(
              (dailyRows as DailyRow[])
                .map(row => [fromPgDate(row.completed_date), toDurationMs(Number(row.duration_ms))] as const)
                .filter(([date, ms]) => date && ms !== null),
            ),
            streakFreezes: (freezeRows as FreezeRow[]).map(row => fromPgDate(row.frozen_date)).filter(Boolean),
          }
        : null,
      solvedLevelIdxs: (solvedRows as SolvedRow[]).map(row => row.level_idx),
      solvedLevelDates: Object.fromEntries((solvedRows as SolvedRow[]).map(row => [row.level_idx, fromPgDate(row.solved_at)]).filter(([, date]) => date)),
      levelMedals: Object.fromEntries((medalRows as MedalRow[]).map(row => [row.level_idx, row.medal])),
    });
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const writes: Promise<unknown>[] = [];

    if (body.progress) {
      const progress = body.progress;
      writes.push(sql`
        insert into user_progress (user_id, hints, daily_completed_date, updated_at)
        values (
          ${userId},
          ${normalizeHintCount(progress.hints ?? 0)},
          ${toPgDate(progress.dailyCompletedDate)},
          now()
        )
        on conflict (user_id) do update set
          hints = excluded.hints,
          daily_completed_date = excluded.daily_completed_date,
          updated_at = now()
      `);
    }

    const solvedLevelIdxs = [...new Set(body.solvedLevelIdxs ?? [])]
      .filter(Number.isInteger)
      .filter(idx => idx >= 0);

    if (solvedLevelIdxs.length) {
      writes.push(sql`
        insert into solved_levels (user_id, level_idx)
        select ${userId}, level_idx::int
        from jsonb_array_elements_text(${JSON.stringify(solvedLevelIdxs)}::jsonb) as item(level_idx)
        on conflict (user_id, level_idx) do nothing
      `);
    }

    const dailyCompletionDates = [...new Set(body.progress?.dailyCompletionDates ?? [])]
      .filter(date => /^\d{8}$/.test(date));

    if (dailyCompletionDates.length) {
      // Date and time go in together so a first completion carries its own clock, and a
      // repeat only ever lowers the record: `least` ignores a null on either side, so a day
      // that already has a time cannot be blanked by a client that forgot to send one.
      const durations = body.progress?.dailyDurations ?? {};
      const rows = dailyCompletionDates.map(date => ({
        completed_date: toPgDate(date),
        duration_ms: toDurationMs(durations[date]),
      }));

      writes.push(sql`
        insert into daily_completions (user_id, completed_date, duration_ms)
        select ${userId}, (item->>'completed_date')::date, (item->>'duration_ms')::int
        from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) as item
        on conflict (user_id, completed_date) do update set
          duration_ms = least(daily_completions.duration_ms, excluded.duration_ms)
      `);
    }

    const streakFreezes = [...new Set(body.progress?.streakFreezes ?? [])]
      .filter(date => /^\d{8}$/.test(date));

    if (streakFreezes.length) {
      // Insert only: a freeze that was spent stays spent, so the month it belongs to cannot be
      // handed back by a client that forgot about it.
      writes.push(sql`
        insert into streak_freezes (user_id, frozen_date)
        select ${userId}, item.frozen_date::date
        from jsonb_array_elements_text(${JSON.stringify(streakFreezes)}::jsonb) as item(frozen_date)
        on conflict (user_id, frozen_date) do nothing
      `);
    }

    const levelMedals = Object.entries(body.levelMedals ?? {})
      .filter(([idx, medal]) => Number.isInteger(Number(idx)) && Number(idx) >= 0 && ['gold', 'silver', 'bronze'].includes(medal))
      .reduce<Record<string, Medal>>((result, [idx, medal]) => {
        result[idx] = medal;
        return result;
      }, {});

    if (Object.keys(levelMedals).length) {
      writes.push(sql`
        insert into level_medals (user_id, level_idx, medal)
        select ${userId}, item.level_idx::int, item.medal
        from jsonb_each_text(${JSON.stringify(levelMedals)}::jsonb) as item(level_idx, medal)
        on conflict (user_id, level_idx) do update set medal = excluded.medal, earned_at = now()
        where case level_medals.medal when 'bronze' then 1 when 'silver' then 2 else 3 end
          < case excluded.medal when 'bronze' then 1 when 'silver' then 2 else 3 end
      `);
    }

    await Promise.all(writes);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}
