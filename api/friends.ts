import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '../src/lib/auth';
import { FRIEND_CODE_LENGTH, friendCodeFromBytes, normalizeFriendCode } from '../src/lib/friendCode';
import { artistIndexFor, ARTISTS } from '../src/lib/playerName';
import { pointsFromCounts } from '../src/game/points';
import { resolveLanguage, translate } from '../src/i18n/messages';

/**
 * The friends leaderboard. A row carries the account's display name, because a board you join
 * by handing someone a code in person is exactly where the painter nickname failed: nobody
 * recognises "Michelangelo" as their brother. The nickname stays as the fallback for accounts
 * with no name — Apple Sign In lets people withhold it — so every row still reads as somebody.
 *
 * What still never leaves: account ids and email addresses. The name reaches only the accounts
 * on the other side of a mutual friendship, which is only ever made by someone typing a code
 * its owner gave them. A player who wants that undone rotates the code and removes the row.
 *
 * Everything scored here comes from what the client posted to /api/progress, which is not
 * verified — a patched client can claim five hundred golds. That is acceptable for a board you
 * only join by handing someone a code, and unacceptable for a public one, so this stays
 * friends-only until the server can derive medals from a solve of its own.
 */

type PostBody = { action?: 'add' | 'remove' | 'rotate'; code?: string };

type CodeRow = { user_id: string; friend_code: string | null };
type StatsRow = {
  user_id: string;
  friend_code: string | null;
  name: string | null;
  gold: number | string;
  silver: number | string;
  bronze: number | string;
  solved: number | string;
  streak: number | string;
};

/**
 * A display name worth showing, or null to fall back to the painter. Whitespace-only names come
 * back from providers often enough to be worth the trim, and the cap is the width the row can
 * actually paint before it truncates anyway.
 */
const MAX_NAME_LENGTH = 40;

function displayName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : null;
}

const databaseUrl = process.env.DATABASE_URL;
/** A board of friends, not a social network: past this the screen stops being readable. */
const MAX_FRIENDS = 30;
/**
 * Guessing a code is 729 million tries by hand and an afternoon to a script, and a hit puts a
 * stranger on someone's board looking at their numbers. Nobody adds twenty friends in an hour,
 * so the ceiling costs a real player nothing.
 */
const MAX_ATTEMPTS_PER_HOUR = 20;

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

type Sql = ReturnType<typeof neon<false, false>>;

/** Codes are assigned on first read, so no migration has to backfill them. */
async function ensureFriendCode(sql: Sql, userId: string): Promise<string> {
  const existing = (await sql`
    select user_id, friend_code from profiles where user_id = ${userId}
  `) as CodeRow[];
  if (existing[0]?.friend_code) return existing[0].friend_code;

  // A collision is a unique-violation, not a lost write, so retrying a few times is enough.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = friendCodeFromBytes(randomBytes(FRIEND_CODE_LENGTH));
    const inserted = (await sql`
      insert into profiles (user_id, friend_code)
      values (${userId}, ${code})
      on conflict (user_id) do update set friend_code = coalesce(profiles.friend_code, excluded.friend_code)
      returning friend_code
    `) as { friend_code: string }[];
    if (inserted[0]?.friend_code) return inserted[0].friend_code;
  }
  throw new Error('Could not assign a friend code');
}

async function rotateFriendCode(sql: Sql, userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = friendCodeFromBytes(randomBytes(FRIEND_CODE_LENGTH));
    const rows = (await sql`
      update profiles set friend_code = ${code} where user_id = ${userId} returning friend_code
    `) as { friend_code: string }[];
    if (rows[0]?.friend_code) return rows[0].friend_code;
    // No profile row yet: create one and let the caller read it back.
    await sql`insert into profiles (user_id) values (${userId}) on conflict (user_id) do nothing`;
  }
  throw new Error('Could not rotate the friend code');
}

/**
 * Points, medals, levels and the daily streak for a set of players, in one round trip. The
 * streak repeats what `getDailyStreak` does on the device — consecutive days counting back from
 * today, zero until today's puzzle is done — except that `current_date` here is the server's,
 * so a friend who plays late can read one day behind until the dates line up again.
 */
async function statsFor(sql: Sql, userIds: string[]): Promise<StatsRow[]> {
  if (!userIds.length) return [];
  const ids = JSON.stringify(userIds);

  return (await sql`
    with wanted as (
      select value as user_id from jsonb_array_elements_text(${ids}::jsonb) as t(value)
    ),
    medals as (
      select user_id,
        count(*) filter (where medal = 'gold') as gold,
        count(*) filter (where medal = 'silver') as silver,
        count(*) filter (where medal = 'bronze') as bronze
      from level_medals
      where user_id in (select user_id from wanted)
      group by user_id
    ),
    solved as (
      select user_id, count(*) as solved
      from solved_levels
      where user_id in (select user_id from wanted)
      group by user_id
    ),
    days as (
      select distinct user_id, completed_date
      from daily_completions
      where user_id in (select user_id from wanted)
    ),
    islands as (
      select user_id, completed_date,
        completed_date - (row_number() over (partition by user_id order by completed_date))::int as island
      from days
    ),
    -- The anchor is today when today is played and yesterday otherwise, matching
    -- getDailyStreak: a streak breaks when a day closes without it, not when one opens.
    anchor as (
      select wanted.user_id,
        case when exists (
          select 1 from days where days.user_id = wanted.user_id and days.completed_date = current_date
        ) then current_date else current_date - 1 end as day
      from wanted
    ),
    today as (
      select islands.user_id, islands.island
      from islands
      join anchor on anchor.user_id = islands.user_id and anchor.day = islands.completed_date
    ),
    streaks as (
      select islands.user_id, count(*) as streak
      from islands
      join today on today.user_id = islands.user_id and today.island = islands.island
      group by islands.user_id
    )
    select wanted.user_id,
      profiles.friend_code,
      -- better-auth's own table, double-quoted because user is a reserved word in Postgres.
      -- Left joined: a missing account row must not drop a player off their friends' boards.
      accounts.name,
      coalesce(medals.gold, 0) as gold,
      coalesce(medals.silver, 0) as silver,
      coalesce(medals.bronze, 0) as bronze,
      coalesce(solved.solved, 0) as solved,
      coalesce(streaks.streak, 0) as streak
    from wanted
    left join profiles on profiles.user_id = wanted.user_id
    left join "user" as accounts on accounts.id = wanted.user_id
    left join medals on medals.user_id = wanted.user_id
    left join solved on solved.user_id = wanted.user_id
    left join streaks on streaks.user_id = wanted.user_id
  `) as StatsRow[];
}

function toEntry(row: StatsRow, selfId: string, addedAt?: string | null) {
  const counts = {
    gold: Number(row.gold),
    silver: Number(row.silver),
    bronze: Number(row.bronze),
  };
  return {
    // The code identifies a row to the client for removal; the account id never leaves here.
    code: row.friend_code,
    // When the pair was made, so the board can mark the ones the player has not seen yet.
    addedAt: addedAt ?? null,
    name: displayName(row.name),
    // Still sent, and still the fallback: a nameless account is a painter, not a blank row.
    artist: artistIndexFor(row.user_id),
    points: pointsFromCounts(counts),
    medals: counts,
    solved: Number(row.solved),
    streak: Number(row.streak),
    isSelf: row.user_id === selfId,
  };
}

async function board(sql: Sql, userId: string) {
  const code = await ensureFriendCode(sql, userId);
  const friendRows = (await sql`
    select friend_id, created_at from friendships where user_id = ${userId} order by created_at asc
  `) as { friend_id: string; created_at: string | Date }[];
  const friendIds = friendRows.map(row => row.friend_id).slice(0, MAX_FRIENDS);
  const addedAt = new Map(friendRows.map(row => [row.friend_id, new Date(row.created_at).toISOString()]));
  const rows = await statsFor(sql, [userId, ...friendIds]);

  return {
    code,
    entries: rows
      .map(row => toEntry(row, userId, addedAt.get(row.user_id)))
      .sort((a, b) => b.points - a.points || b.solved - a.solved),
  };
}

/**
 * Tells the code's owner that someone used it. This is the one thing on the board that happens
 * to a player rather than because of them, and the pair is mutual the moment it is made, so
 * being told is what keeps that honest.
 *
 * Sending is best-effort and never blocks the response: a friend added is a friend added
 * whether or not a phone could be reached. Only devices that already granted notifications for
 * the daily reminder ever registered a token, so this raises no prompt of its own.
 */
async function notifyAdded(sql: Sql, targetId: string, adderId: string) {
  try {
    const rows = (await sql`
      select push_tokens.token, profiles.language
      from push_tokens
      left join profiles on profiles.user_id = push_tokens.user_id
      where push_tokens.user_id = ${targetId}
    `) as { token: string; language: string | null }[];
    if (!rows.length) return;

    const tokens = rows.map(row => ({ token: row.token }));
    // The receiver's own setting, recorded when their device registered; the catalogue falls
    // back to Portuguese if that device never said.
    const language = resolveLanguage(rows[0].language);
    // The same identity the board will show them, so the notification and the row agree.
    const adder = (await sql`
      select name from "user" where id = ${adderId}
    `) as { name: string | null }[];
    const name = displayName(adder[0]?.name) ?? ARTISTS[artistIndexFor(adderId)].name;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        tokens.map(row => ({
          to: row.token,
          title: translate(language, 'push.friendAddedTitle'),
          body: translate(language, 'push.friendAddedBody', { name }),
          sound: 'default',
        })),
      ),
    });
  } catch {
    // A push that could not be sent is not a reason to fail the add.
  }
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
    sendJson(res, 200, await board(sql, userId));
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);

    if (body.action === 'rotate') {
      // Rotating keeps existing friends: it only stops the old code from adding anyone new.
      const code = await rotateFriendCode(sql, userId);
      sendJson(res, 200, { ...(await board(sql, userId)), code });
      return;
    }

    const code = normalizeFriendCode(body.code ?? '');
    if (!code) {
      sendJson(res, 400, { error: 'invalid_code' });
      return;
    }

    // Removing takes a code the player already has, so only adding is worth rate limiting.
    if (body.action !== 'remove') {
      const recent = (await sql`
        select count(*)::int as count
        from friend_code_attempts
        where user_id = ${userId} and attempted_at > now() - interval '1 hour'
      `) as { count: number }[];
      if ((recent[0]?.count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
        sendJson(res, 429, { error: 'too_many_attempts' });
        return;
      }
      // Logged whether or not the code exists: a miss is what enumeration is made of. Older
      // rows go with it, so the table stays the size of one hour of use.
      await sql`
        insert into friend_code_attempts (user_id) values (${userId})
      `;
      await sql`
        delete from friend_code_attempts where user_id = ${userId} and attempted_at < now() - interval '1 day'
      `;
    }

    const matches = (await sql`
      select user_id, friend_code from profiles where friend_code = ${code}
    `) as CodeRow[];
    const targetId = matches[0]?.user_id;

    if (!targetId) {
      sendJson(res, 404, { error: 'unknown_code' });
      return;
    }
    if (targetId === userId) {
      sendJson(res, 400, { error: 'own_code' });
      return;
    }

    if (body.action === 'remove') {
      // Removal is mutual as well; a board neither side can leave alone is worse than none.
      await sql`
        delete from friendships
        where (user_id = ${userId} and friend_id = ${targetId})
           or (user_id = ${targetId} and friend_id = ${userId})
      `;
      sendJson(res, 200, await board(sql, userId));
      return;
    }

    const mine = (await sql`
      select count(*)::int as count from friendships where user_id = ${userId}
    `) as { count: number }[];
    if ((mine[0]?.count ?? 0) >= MAX_FRIENDS) {
      sendJson(res, 409, { error: 'too_many_friends' });
      return;
    }

    const inserted = (await sql`
      insert into friendships (user_id, friend_id)
      values (${userId}, ${targetId}), (${targetId}, ${userId})
      on conflict (user_id, friend_id) do nothing
      returning user_id
    `) as { user_id: string }[];

    // Only on a pair that did not already exist, so re-entering a code stays quiet.
    if (inserted.length) await notifyAdded(sql, targetId, userId);

    sendJson(res, 200, await board(sql, userId));
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}
