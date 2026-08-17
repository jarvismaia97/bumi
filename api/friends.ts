import { createHmac, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '../src/lib/auth';
import { reportServerError } from '../src/lib/serverObservability';
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
 * What still never leaves: account ids, email addresses, and — since the board is the one place
 * a code would otherwise be handed to people who never needed it — anybody else's friend code.
 * Rows carry a removal handle instead (see `removalHandle`). The name reaches only the accounts
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
  name: string | null;
  daily_ms: number | string | null;
  daily_hints: number | string | null;
  daily_done: boolean | null;
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

/**
 * Both of these are guaranteed by the time this module finishes loading: importing
 * `../src/lib/auth` above throws when either is missing, so a handler-level "not configured"
 * branch could never run. The non-null assertions say that out loud instead of pretending
 * there is a fallback path.
 */
const databaseUrl = process.env.DATABASE_URL as string;
const authSecret = process.env.BETTER_AUTH_SECRET as string;

/** A board of friends, not a social network: past this the screen stops being readable. */
const MAX_FRIENDS = 30;
/**
 * Guessing a code is 729 million tries by hand and an afternoon to a script, and a hit puts a
 * stranger on someone's board looking at their numbers. Nobody adds twenty friends in an hour,
 * so the ceiling costs a real player nothing. Every code-shaped POST spends from it — removing
 * used to be exempt, which made `action: 'remove'` an unmetered way to ask the same question.
 */
const MAX_ATTEMPTS_PER_HOUR = 20;

/**
 * Where a browser may read a response from, mirroring `trustedOrigins` in src/lib/auth.ts.
 *
 * This used to reflect whatever `Origin` arrived, which was never useful to anyone: the web
 * build is served from the same origin as this function and React Native does not implement
 * CORS at all, so the reflection only ever widened who could read a reply. The `bumi://` entries
 * from the auth list are deliberately absent — a native app is not a browser and never asks.
 */
const ALLOWED_ORIGINS = new Set([
  process.env.BETTER_AUTH_URL ?? 'https://www.jogarbumi.pt',
  'https://jogarbumi.pt',
  'https://www.jogarbumi.pt',
  'http://localhost:3000',
  'http://localhost:8081',
]);

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify(body));
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

/**
 * How a board names one of its own rows for removal, and nothing else.
 *
 * The row used to carry the friend's own add-code, which handed every friend the one thing that
 * puts a stranger on that player's board — and rotating, the only revocation, throws away the
 * code they had already given to people they actually wanted. This is an HMAC over the pair
 * under the server secret, so it is meaningless to anyone but this server, different for every
 * viewer looking at the same friend, and useless as an add-code because adding still takes a
 * real one. Deriving it needs no column: it is a pure function of two ids the row already has.
 *
 * The secret is BETTER_AUTH_SECRET, the same one better-auth signs sessions with. Handles are
 * therefore stable for as long as sessions are, and rotating that secret invalidates both
 * together — a player whose board is stale reloads it, which is what a 404 here tells them.
 */
function removalHandle(viewerId: string, friendId: string): string {
  return createHmac('sha256', authSecret).update(`friend-removal ${viewerId} ${friendId}`).digest('hex').slice(0, 32);
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

/**
 * A code already taken by somebody else. `profiles_friend_code_idx` is unique, so the draw that
 * lost the race raises SQLSTATE 23505 — which is the one failure worth another turn of the loop
 * rather than a 500, because the next draw is from 729 million codes and almost certainly free.
 */
function isDuplicateCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/** Codes are assigned on first read, so no migration has to backfill them. */
async function ensureFriendCode(sql: Sql, userId: string): Promise<string> {
  const existing = (await sql`
    select user_id, friend_code from profiles where user_id = ${userId}
  `) as CodeRow[];
  if (existing[0]?.friend_code) return existing[0].friend_code;

  // The upsert always returns a row, so this loop runs once in practice. The retry is for the
  // one case that does not return: a `friend_code` already held by another account raises a
  // unique violation, and the answer to a collision is a different code, not a 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = friendCodeFromBytes(randomBytes(FRIEND_CODE_LENGTH));
    try {
      const inserted = (await sql`
        insert into profiles (user_id, friend_code)
        values (${userId}, ${code})
        on conflict (user_id) do update set friend_code = coalesce(profiles.friend_code, excluded.friend_code)
        returning friend_code
      `) as { friend_code: string }[];
      if (inserted[0]?.friend_code) return inserted[0].friend_code;
    } catch (error) {
      if (!isDuplicateCode(error)) throw error;
    }
  }
  throw new Error('Could not assign a friend code');
}

async function rotateFriendCode(sql: Sql, userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = friendCodeFromBytes(randomBytes(FRIEND_CODE_LENGTH));
    try {
      const rows = (await sql`
        update profiles set friend_code = ${code} where user_id = ${userId} returning friend_code
      `) as { friend_code: string }[];
      if (rows[0]?.friend_code) return rows[0].friend_code;
      // No profile row yet: create one so the next pass of the loop has something to update.
      await sql`insert into profiles (user_id) values (${userId}) on conflict (user_id) do nothing`;
    } catch (error) {
      // Same collision as above, and the same answer: draw again. Rotating is the player's only
      // revocation, so it must not fail on a coincidence they can neither see nor retry past.
      if (!isDuplicateCode(error)) throw error;
    }
  }
  throw new Error('Could not rotate the friend code');
}

/**
 * Points, medals, levels and the daily streak for a set of players, in one round trip. The
 * streak repeats what `getDailyStreak` does on the device: consecutive days counting back from
 * today, zero once a day has closed without one.
 *
 * "Today" is each player's own, from the offset their device last reported, and it has to be.
 * Every date stored here is a key the device chose, and reading them against the server's UTC
 * `current_date` put anyone west of UTC a day ahead of themselves for most of their evening:
 * their local yesterday was the server's day before last, the anchor missed it, and a streak of
 * forty read as zero until they played. `viewerId` gets the same treatment for the opposite
 * reason — today's puzzle is only worth comparing against the person looking at it, so the daily
 * column is the requester's own day for every row, not each friend's.
 */
async function statsFor(sql: Sql, userIds: string[], viewerId: string): Promise<StatsRow[]> {
  if (!userIds.length) return [];
  const ids = JSON.stringify(userIds);

  return (await sql`
    with wanted as (
      select value as user_id from jsonb_array_elements_text(${ids}::jsonb) as t(value)
    ),
    -- The date it is where each player is. A profile that has not posted an offset since the
    -- column existed reads as UTC, which is what every row read as before it did.
    local_today as (
      select wanted.user_id,
        ((now() at time zone 'utc') + make_interval(mins => coalesce(profiles.utc_offset_minutes, 0)))::date as day
      from wanted
      left join profiles on profiles.user_id = wanted.user_id
    ),
    -- The requester's own date, as one row whatever their profile holds, so the daily column
    -- below cannot lose a friend to a missing offset.
    viewer_day as (
      select ((now() at time zone 'utc') + make_interval(mins => coalesce(
        (select utc_offset_minutes from profiles where user_id = ${viewerId}), 0
      )))::date as day
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
    -- Frozen days join the played ones here and nowhere else, so a friend's streak on this
    -- board reads the same number their own device shows them.
    days as (
      select distinct user_id, completed_date
      from (
        select user_id, completed_date from daily_completions
        where user_id in (select user_id from wanted)
        union all
        select user_id, frozen_date as completed_date from streak_freezes
        where user_id in (select user_id from wanted)
      ) as all_days
    ),
    islands as (
      select user_id, completed_date,
        completed_date - (row_number() over (partition by user_id order by completed_date))::int as island
      from days
    ),
    -- The anchor is today when today is played and yesterday otherwise, matching
    -- getDailyStreak: a streak breaks when a day closes without it, not when one opens.
    anchor as (
      select local_today.user_id,
        case when exists (
          select 1 from days where days.user_id = local_today.user_id and days.completed_date = local_today.day
        ) then local_today.day else local_today.day - 1 end as day
      from local_today
    ),
    today as (
      select islands.user_id, islands.island
      from islands
      join anchor on anchor.user_id = islands.user_id and anchor.day = islands.completed_date
    ),
    -- Counting stops at the anchor, which is what getDailyStreak does: it walks backwards and
    -- never forwards. Without the bound the whole island counts, and a client posting a run of
    -- dates past its own today would be adding to the number by doing so.
    streaks as (
      select islands.user_id, count(*) as streak
      from islands
      join today on today.user_id = islands.user_id and today.island = islands.island
      join anchor on anchor.user_id = islands.user_id
      where islands.completed_date <= anchor.day
      group by islands.user_id
    ),
    -- The requester's today for every row, because the point of this column is that everybody
    -- solved the same puzzle. Read at each friend's own date instead, a friend a day ahead would
    -- be showing a time for a puzzle the person reading it has not seen.
    daily as (
      select daily_completions.user_id, daily_completions.duration_ms, daily_completions.hints_used
      from daily_completions, viewer_day
      where daily_completions.user_id in (select user_id from wanted)
        and daily_completions.completed_date = viewer_day.day
    )
    select wanted.user_id,
      -- No friend_code here on purpose: a board is read by every friend, and the code is the
      -- capability that puts somebody on a board. Rows are named by removalHandle instead.
      -- better-auth's own table, double-quoted because user is a reserved word in Postgres.
      -- Left joined: a missing account row must not drop a player off their friends' boards.
      accounts.name,
      coalesce(medals.gold, 0) as gold,
      coalesce(medals.silver, 0) as silver,
      coalesce(medals.bronze, 0) as bronze,
      coalesce(solved.solved, 0) as solved,
      coalesce(streaks.streak, 0) as streak,
      daily.duration_ms as daily_ms,
      -- What the time cost in hints, so two times on the same puzzle can be told apart. Null,
      -- not zero, when the row predates the column: an unrecorded count is not a clean solve.
      daily.hints_used as daily_hints,
      -- Separate from the time: a completion recorded before the clock existed is a day done
      -- with nothing to show, which is not the same as a day not started.
      (daily.user_id is not null) as daily_done
    from wanted
    left join "user" as accounts on accounts.id = wanted.user_id
    left join medals on medals.user_id = wanted.user_id
    left join solved on solved.user_id = wanted.user_id
    left join streaks on streaks.user_id = wanted.user_id
    left join daily on daily.user_id = wanted.user_id
  `) as StatsRow[];
}

function toEntry(row: StatsRow, selfId: string, addedAt?: string | null) {
  const counts = {
    gold: Number(row.gold),
    silver: Number(row.silver),
    bronze: Number(row.bronze),
  };
  return {
    // How the client names a row to remove; the account id never leaves here. This used to be
    // the friend's own add-code, which handed every friend the one thing that puts a stranger on
    // their board. It is now a handle only this viewer's removals can use, and the player's own
    // row has none: there is nothing there to remove.
    code: row.user_id === selfId ? null : removalHandle(selfId, row.user_id),
    // When the pair was made, so the board can mark the ones the player has not seen yet.
    addedAt: addedAt ?? null,
    name: displayName(row.name),
    // Still sent, and still the fallback: a nameless account is a painter, not a blank row.
    artist: artistIndexFor(row.user_id),
    points: pointsFromCounts(counts),
    medals: counts,
    solved: Number(row.solved),
    streak: Number(row.streak),
    // Today's daily: whether it is done, how long it took when that was recorded, and what it
    // cost in hints. Null hints means nobody counted, which is not the same as none used.
    dailyDone: Boolean(row.daily_done),
    dailyMs: row.daily_ms === null ? null : Number(row.daily_ms),
    dailyHints: row.daily_hints === null ? null : Number(row.daily_hints),
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
  const rows = await statsFor(sql, [userId, ...friendIds], userId);

  return {
    code,
    // Rows past MAX_FRIENDS are dropped above, and silently dropping them is how a player ends
    // up with friends they cannot see or remove: the add ceiling counts each side's own rows,
    // but the insert writes both, so being popular is enough to go over. Say so instead, and
    // hand over the totals, so the client can tell them which is which.
    friendCount: friendRows.length,
    truncated: friendRows.length > friendIds.length,
    entries: rows
      .map(row => toEntry(row, userId, addedAt.get(row.user_id)))
      .sort((a, b) => b.points - a.points || b.solved - a.solved),
  };
}

/**
 * Spends one attempt against the hourly ceiling and records what it was for. Answers whether the
 * caller was under the ceiling; the caller must not act on its lookup when this says no.
 *
 * Misses only, as before. Enumeration is a run of codes that do not exist; somebody working
 * through four codes from a group chat is not, and counting their hits would spend the same
 * budget on them. The row still goes in either way — the outcome is what the ceiling ignores.
 *
 * The count and the insert are one statement because two were a race anybody could win: the
 * count came back over one round trip and the insert went out over the next, so twenty parallel
 * requests all read the same number and all passed. One statement narrows that to the snapshot
 * Postgres takes when it starts — under READ COMMITTED two requests landing in the same instant
 * can still both see the pre-insert count, so this is a ceiling with microseconds of give rather
 * than a network round trip of it. Closing that last gap needs an interactive transaction, which
 * the neon HTTP driver does not give a single handler.
 */
async function meterAttempt(sql: Sql, userId: string, succeeded: boolean): Promise<boolean> {
  const rows = (await sql`
    with recent as (
      select count(*)::int as misses
      from friend_code_attempts
      where user_id = ${userId}::text
        and attempted_at > now() - interval '1 hour'
        and not succeeded
    ),
    spent as (
      insert into friend_code_attempts (user_id, succeeded)
      select ${userId}::text, ${succeeded}::boolean
      from recent
      where recent.misses < ${MAX_ATTEMPTS_PER_HOUR}::int
      returning 1 as written
    ),
    -- Older rows go with it, so the table stays the size of a day of use. A data-modifying CTE
    -- runs whether or not the outer query reads it, which is why nothing selects from this one.
    pruned as (
      delete from friend_code_attempts
      where user_id = ${userId}::text and attempted_at < now() - interval '1 day'
      returning 1
    )
    select exists (select 1 from spent) as allowed
  `) as { allowed: boolean }[];
  return rows[0]?.allowed ?? false;
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

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
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

    // Expo answers with one ticket per message, in the order they were sent, and the reply used
    // to be dropped on the floor. DeviceNotRegistered is the app deleted or the token reissued:
    // that token will never deliver again, and left in the table it is sent to on every add
    // forever, which is how a row nobody can see slowly becomes most of the push traffic.
    // Anything else — a rate limit, a bad message — is transient or ours, so the token stays.
    const payload = (await response.json()) as { data?: ({ details?: { error?: string } } | null)[] };
    const dead = (payload.data ?? [])
      .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[index]?.token : null))
      .filter((token): token is string => Boolean(token));
    if (dead.length) await sql`delete from push_tokens where token = any(${dead}::text[])`;
  } catch {
    // A push that could not be sent — or a reply that could not be read — is not a reason to
    // fail the add. A token left behind here is caught by the next add to the same account.
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const userId = await getUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  // The routing below had no catch of its own, so anything it threw — a query that failed, a
  // friend code that ran out of retries — left the promise rejected and Vercel answered with a
  // generic 500 nobody could read afterwards. `progress.ts` was given this treatment during the
  // audit and this file was missed; the two now fail the same way.
  try {
    await route(req, res, userId);
  } catch (error) {
    reportServerError(error, 'friends', { method: req.method });
    sendJson(res, 500, { error: 'internal_error' });
  }
}

async function route(req: VercelRequest, res: VercelResponse, userId: string) {
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

    if (body.action === 'remove') {
      // Removing never looks a code up. It used to: it ran the same global
      // `where friend_code = ?` as adding and answered the same 404 on a miss, while sitting
      // outside the ceiling — an unmetered oracle over all 729 million codes, and a hit put the
      // asker on a stranger's board. Now the only thing that resolves here is a handle this
      // board handed this viewer, matched against this viewer's own rows, so the question
      // "does this code exist" can no longer be asked at all.
      const handle = typeof body.code === 'string' ? body.code.trim() : '';
      const mine = (await sql`
        select friend_id from friendships where user_id = ${userId}
      `) as { friend_id: string }[];
      const targetId = mine.find(row => removalHandle(userId, row.friend_id) === handle)?.friend_id ?? null;

      // A miss is metered like any other: a handle nobody holds costs the same as a code nobody
      // has, so there is nothing left to learn by guessing either. A hit is let through even
      // when the budget is spent, because a matching handle proves the caller already holds the
      // row and so teaches them nothing — and the alternative is worse than the leak it would
      // prevent: an hour of add typos would lock someone out of removing anyone, and removal is
      // the only way off a full board.
      if (targetId) {
        await meterAttempt(sql, userId, true);
      } else if (!(await meterAttempt(sql, userId, false))) {
        sendJson(res, 429, { error: 'too_many_attempts' });
        return;
      }
      if (!targetId) {
        // Says only "not on your board", which for a handle means a stale one — reload and it
        // is gone or it is removable. It says nothing about anybody's code, because none was read.
        sendJson(res, 404, { error: 'unknown_code' });
        return;
      }

      // Removal is mutual as well; a board neither side can leave alone is worse than none.
      await sql`
        delete from friendships
        where (user_id = ${userId} and friend_id = ${targetId})
           or (user_id = ${targetId} and friend_id = ${userId})
      `;
      sendJson(res, 200, await board(sql, userId));
      return;
    }

    // Adding, and only adding, takes a real code.
    const code = normalizeFriendCode(body.code ?? '');
    if (!code) {
      sendJson(res, 400, { error: 'invalid_code' });
      return;
    }

    const matches = (await sql`
      select user_id, friend_code from profiles where friend_code = ${code}
    `) as CodeRow[];
    const targetId = matches[0]?.user_id;

    // The lookup already happened, so the row can carry what it found; nothing about it reaches
    // the caller until the ceiling has said yes.
    if (!(await meterAttempt(sql, userId, Boolean(targetId)))) {
      sendJson(res, 429, { error: 'too_many_attempts' });
      return;
    }

    if (!targetId) {
      sendJson(res, 404, { error: 'unknown_code' });
      return;
    }
    if (targetId === userId) {
      sendJson(res, 400, { error: 'own_code' });
      return;
    }

    /**
     * Both ceilings and the insert in one statement. Two statements meant N parallel adds all
     * read the same count and all passed, and the count only ever covered the adder's own rows
     * while the insert wrote both directions — so a player whose code was circulating could be
     * pushed past MAX_FRIENDS by other people, and the board then dropped the overflow silently.
     * Checking both sides here is what stops that at the source; `friendCount` on the board is
     * what tells whoever is already over.
     *
     * A pair that already exists is exempt: re-entering a code someone has must stay a quiet
     * no-op, not a 409 that reads as "you have too many friends".
     */
    const seats = (await sql`
      with existing as (
        select 1 from friendships where user_id = ${userId}::text and friend_id = ${targetId}::text
      ),
      room as (
        select (
          exists (select 1 from existing)
          or (
            (select count(*) from friendships where user_id = ${userId}::text) < ${MAX_FRIENDS}::int
            and (select count(*) from friendships where user_id = ${targetId}::text) < ${MAX_FRIENDS}::int
          )
        ) as ok
      ),
      paired as (
        insert into friendships (user_id, friend_id)
        select pair.a, pair.b
        from (values (${userId}::text, ${targetId}::text), (${targetId}::text, ${userId}::text)) as pair(a, b)
        cross join room
        where room.ok
        on conflict (user_id, friend_id) do nothing
        returning user_id
      )
      select (select ok from room) as ok, (select count(*)::int from paired) as inserted
    `) as { ok: boolean; inserted: number }[];

    if (!seats[0]?.ok) {
      sendJson(res, 409, { error: 'too_many_friends' });
      return;
    }

    // Only on a pair that did not already exist, so re-entering a code stays quiet.
    if ((seats[0]?.inserted ?? 0) > 0) await notifyAdded(sql, targetId, userId);

    sendJson(res, 200, await board(sql, userId));
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}
