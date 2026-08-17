import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '../src/lib/auth';
import { reportServerError } from '../src/lib/serverObservability';
import type { Medal } from '../src/game/medals';
import { MAX_HINTS } from '../src/game/hints';
import { formatResultDuration } from '../src/game/medals';
import { beatsFriendTime } from '../src/game/dailyRace';
import { pointsFromCounts } from '../src/game/points';
import { artistIndexFor, ARTISTS } from '../src/lib/playerName';
import { resolveLanguage, translate } from '../src/i18n/messages';

type ProgressPayload = {
  /**
   * The balance. Still read, and still written to `user_progress.hints`, because the two builds
   * in the app stores send this and nothing else — see the counters below for why nothing new
   * should be settled on it.
   */
  hints?: number;
  /**
   * Lifetime hints granted and lifetime hints spent. Both only ever grow, which is the whole
   * point: a balance moves in both directions and no merge rule for one number survives that, so
   * `greatest` on it resurrected every hint ever spent and last-write-wins would have discarded
   * every hint earned on a device that had been offline. Sent together or not at all.
   */
  hintsEarned?: number;
  hintsSpent?: number;
  dailyCompletedDate?: string | null;
  dailyCompletionDates?: string[];
  /** Milliseconds per daily, keyed by the puzzle's own `YYYYMMDD`. Sparse by design. */
  dailyDurations?: Record<string, number>;
  /** Hints spent per daily, same keys. Sparse for the same reason the durations are. */
  dailyHints?: Record<string, number>;
  /** Days a streak freeze covered. Kept apart from completions on purpose; see the schema. */
  streakFreezes?: string[];
  /**
   * Minutes east of UTC on the device that sent this. Every date above is a key that device
   * chose, and this is the only thing that says which day it meant: without it the friends
   * board reads them against UTC and hands anyone west of it a day they have not reached.
   */
  utcOffsetMinutes?: number;
};

/**
 * A request this endpoint refuses, so the checks below can read as plain statements about the
 * payload. The handler turns it into the 400 it is: a client that sent a day the calendar does
 * not have has to be told so, and the uncaught rejection it used to get said the server broke.
 */
class BadRequest extends Error {}

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * A day's time as the database will take it, or null to leave the column alone. Anything that
 * is not a positive whole number of milliseconds under a day is a client bug or a lie, and a
 * board sorted by the smallest number is exactly where a lie would be rewarded.
 */
function toDurationMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded < MAX_DURATION_MS ? rounded : null;
}

const MAX_HINTS_PER_DAILY = 99;

/**
 * A hint count the column will take, or null to leave it alone. The cap is the largest number
 * of hints a board can absorb before there is nothing left to reveal; anything past it, or
 * negative, is a bug or a lie and is better recorded as unknown than as a figure.
 */
function toHintsUsed(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= MAX_HINTS_PER_DAILY ? rounded : null;
}

/**
 * The player's hint balance as the column will take it: a whole number inside the game's own
 * range, and 0 for anything that is not a number at all. `user_progress.hints` is `not null`,
 * and the clamp this replaces returned NaN for a non-numeric payload — Neon serialises NaN as
 * JSON null, so the insert came back a not_null_violation and the save 500ed.
 *
 * Kept here rather than taken from `game/hints`: this is the boundary that has to survive a
 * hostile payload, and the game's own helper is written for a number it already trusts.
 */
function toHintBalance(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_HINTS, Math.max(0, Math.floor(numeric)));
}

/**
 * A ceiling for the lifetime counters. They only ever grow and `integer` does not: a client that
 * posted 1e20 would take `greatest` past the column's range and then fail every honest post that
 * followed, because the bad value would be the larger one forever. Far past any real account —
 * the campaign holds fifty milestone levels, and the goals pay at most seven hints a month.
 */
const MAX_HINT_COUNTER = 100_000;

/** One lifetime counter as the column will take it, or null when the payload has no usable one. */
function toHintCounter(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.floor(value);
  return rounded >= 0 && rounded <= MAX_HINT_COUNTER ? rounded : null;
}

/**
 * What this post says about the player's hints.
 *
 * `exact` is a payload that carried both counters, which is what the current client sends. Without
 * them all there is is a balance, and a balance cannot be merged — so it is read as the weakest
 * true statement it makes: this account has earned at least what it has spent plus what it is
 * holding. The upsert turns that into `hints_spent + hints`, which for a client that has never
 * heard of the counters reproduces exactly the high-water behaviour it was written against, and
 * cannot roll it back. Both builds in the app stores post this way and will until they are gone.
 */
function toHintCounters(progress: ProgressPayload | undefined): { earned: number; spent: number; balance: number; exact: boolean } {
  const earned = toHintCounter(progress?.hintsEarned);
  const spent = toHintCounter(progress?.hintsSpent);
  if (earned === null || spent === null) {
    const balance = toHintBalance(progress?.hints);
    return { earned: balance, spent: 0, balance, exact: false };
  }
  return { earned, spent, balance: toHintBalance(earned - spent), exact: true };
}

/**
 * The device's offset from UTC in minutes, or null when it did not say. Bounded by the real
 * range of world time zones — UTC-12 to UTC+14 — because the column feeds a date the friends
 * board reads as a player's own day, and an unbounded number there moves that day at will.
 */
function toUtcOffsetMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= -12 * 60 && rounded <= 14 * 60 ? rounded : null;
}

type PostBody = {
  progress?: ProgressPayload;
  solvedLevelIdxs?: number[];
  levelMedals?: Record<string, Medal>;
};

/** Neon returns untyped rows, so the shape of each query is declared where it is read. */
type ProgressRow = {
  hints: number;
  hints_earned: number | string | null;
  hints_spent: number | string | null;
  daily_completed_date: string | Date | null;
};
type DailyRow = {
  completed_date: string | Date | null;
  duration_ms: number | string | null;
  hints_used: number | string | null;
};
type FreezeRow = { frozen_date: string | Date | null };
type SolvedRow = { level_idx: number; solved_at: string | Date | null };
type MedalRow = { level_idx: number; medal: Medal };

/**
 * Not checked before use: `../src/lib/auth` reads the same variable at import and throws
 * without it, so a function that answers a request at all has one. The fallback only keeps
 * the type honest.
 */
const databaseUrl = process.env.DATABASE_URL ?? '';

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

/**
 * A date key as the database will take it, or null when the calendar has no such day. Eight
 * digits is not enough on its own: `20261340` matches, and `::date` answers it with "date/time
 * field value out of range", which arrives at the client as a 500 for what it plainly sent.
 */
function toPgDate(key: unknown): string | null {
  if (typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(key);
  if (!match) return null;
  const [, year, month, day] = match;
  // Date.UTC rolls overflow forward instead of refusing it — the 40th of a month becomes the
  // next one — and reads a two-digit year as 19xx, so the only proof the day exists is getting
  // the same three numbers back out of it.
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

/** The key exactly as the client wrote it, once the calendar has agreed it is a day. */
function requireDateKey(value: unknown, field: string): string {
  if (typeof value !== 'string' || !toPgDate(value)) throw new BadRequest(`invalid_${field}`);
  return value;
}

/** A date column's value, where the client is allowed to say it has none. */
function requirePgDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  const date = toPgDate(value);
  if (!date) throw new BadRequest(`invalid_${field}`);
  return date;
}

/**
 * The campaign's last level, mirroring MAX_CAMPAIGN_LEVEL in api/share.ts — indexes here are
 * zero-based where that file numbers levels for people, so the count is also the ceiling.
 * A bound is needed and not just a shape: `1e20` is an integer to `Number.isInteger`, prints
 * as `1e+20`, and `level_idx::int` answers with "value out of range".
 */
const MAX_CAMPAIGN_LEVEL = 500;

/**
 * The most dates one post may carry. A player's whole history of dailies is bounded by the days
 * since the daily existed, and ten years of them is far past any real device; past this the
 * payload is not a client, and the set and sort work below should never be done on it.
 */
const MAX_DATE_ENTRIES = 3650;

function isLevelIdx(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_CAMPAIGN_LEVEL;
}

/**
 * The array a field claims to be. `[...new Set(body.solvedLevelIdxs ?? [])]` throws outright on
 * a number — "5 is not iterable" — and an unbounded one is work this function agreed to do for
 * whoever asked, so both are refused here rather than discovered downstream.
 */
function requireArray(value: unknown, field: string, limit: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequest(`invalid_${field}`);
  if (value.length > limit) throw new BadRequest(`too_many_${field}`);
  return value;
}

function fromPgDate(value: unknown): string | null {
  if (!value) return null;
  // The driver hands date columns back as strings today. Should it ever stop, a Date parsed
  // from `2026-08-13` sits at local midnight, and toISOString on that reads as the 12th
  // anywhere east of UTC — so the day is read off the same clock it was built in.
  if (value instanceof Date) {
    const year = String(value.getFullYear()).padStart(4, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  if (typeof value === 'string') return value.slice(0, 10).replace(/-/g, '');
  return null;
}

function parseBody(req: VercelRequest): PostBody {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as PostBody;
    } catch {
      throw new BadRequest('invalid_body');
    }
  }
  return req.body as PostBody;
}

type Sql = ReturnType<typeof neon<false, false>>;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo refuses a larger batch outright, so a big one has to go as several. */
const EXPO_PUSH_CHUNK = 100;

type PushMessage = { to: string; title: string; body: string; sound: 'default' };

/**
 * Sends the messages and retires the tokens Expo says are dead.
 *
 * A token outlives the install that registered it: the app is deleted, the device is wiped, and
 * the row here stays. Expo reports that per ticket rather than by failing the request, so a send
 * that never reads the response leaves those rows forever and pays for them on every later push.
 * Tickets come back in the order the messages went out, which is what makes the token findable.
 */
async function sendPush(sql: Sql, messages: PushMessage[]): Promise<void> {
  for (let start = 0; start < messages.length; start += EXPO_PUSH_CHUNK) {
    const chunk = messages.slice(start, start + EXPO_PUSH_CHUNK);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) continue;

    const payload = (await response.json()) as { data?: { details?: { error?: string } }[] };
    const dead = (payload.data ?? [])
      .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? chunk[index]?.to : null))
      .filter((token): token is string => !!token);
    if (!dead.length) continue;

    await sql`
      delete from push_tokens
      where token in (select value from jsonb_array_elements_text(${JSON.stringify(dead)}::jsonb))
    `;
  }
}

/**
 * The date it is where this player is, from the offset their device last reported.
 *
 * Every date this endpoint stores is a key that device chose, so the server's `current_date` is
 * the one thing they must never be compared against: for anyone west of UTC it names a day they
 * have not reached, which is why the daily-beaten push never fired for them — the read of
 * today's time landed on tomorrow's missing row and gave up. The same idiom as the friends
 * board, so the two cannot disagree about whose day it is.
 *
 * Returned as text: a date parsed by the driver comes back as a Date at local midnight, and the
 * point of this value is that it is not read in the server's zone.
 */
async function localDay(sql: Sql, userId: string): Promise<string> {
  const rows = (await sql`
    select ((now() at time zone 'utc') + make_interval(mins => coalesce(
      (select utc_offset_minutes from profiles where user_id = ${userId}), 0
    )))::date::text as day
  `) as { day: string }[];
  return rows[0].day;
}

/**
 * Tells the friends this player has just passed on the board.
 *
 * Only the crossing is worth a notification: a lead that has stood for a month is not news, so
 * the previous score is kept on the profile and only friends who sat between it and the new one
 * are told. The receiving player hears about it once a day at most, however many people pass
 * them, because the cap belongs on the side that has to live with the noise. The day it is
 * capped against is the poster's own, since that is what every date on these tables means.
 *
 * Best effort throughout, and never blocking the write it follows: progress that saved is saved
 * whether or not a phone could be reached.
 */
async function notifyOvertaken(sql: Sql, userId: string, day: string): Promise<void> {
  try {
    const scored = (await sql`
      with counts as (
        select
          count(*) filter (where medal = 'gold') as gold,
          count(*) filter (where medal = 'silver') as silver,
          count(*) filter (where medal = 'bronze') as bronze
        from level_medals where user_id = ${userId}
      )
      select
        (select gold from counts) as gold,
        (select silver from counts) as silver,
        (select bronze from counts) as bronze,
        coalesce((select points from profiles where user_id = ${userId}), 0) as previous
    `) as { gold: number | string; silver: number | string; bronze: number | string; previous: number | string }[];

    const row = scored[0];
    if (!row) return;

    const points = pointsFromCounts({ gold: Number(row.gold), silver: Number(row.silver), bronze: Number(row.bronze) });
    const previous = Number(row.previous);

    // Stamped with the score: `points` alone cannot say whether it is this morning's or one
    // left over from March, and everything below reads it as though it were current.
    await sql`
      insert into profiles (user_id, points, points_updated_at) values (${userId}, ${points}, now())
      on conflict (user_id) do update set points = excluded.points, points_updated_at = now()
    `;

    // Nothing was overtaken if the score did not move, and a score that fell is not an overtake
    // either — only the gap opened going upwards can contain somebody.
    if (points <= previous) return;

    // Medal counts come back raw and `pointsFromCounts` turns them into a score, so the board,
    // the win sheet and this notification cannot drift apart when the medal values change.
    const friends = (await sql`
      select friendships.friend_id as user_id,
        push_tokens.token,
        profiles.language,
        count(*) filter (where level_medals.medal = 'gold') as gold,
        count(*) filter (where level_medals.medal = 'silver') as silver,
        count(*) filter (where level_medals.medal = 'bronze') as bronze
      from friendships
      join push_tokens on push_tokens.user_id = friendships.friend_id
      join profiles on profiles.user_id = friendships.friend_id
      left join level_medals on level_medals.user_id = friendships.friend_id
      where friendships.user_id = ${userId}
      group by friendships.friend_id, push_tokens.token, profiles.language
    `) as {
      user_id: string;
      token: string;
      language: string | null;
      gold: number | string;
      silver: number | string;
      bronze: number | string;
    }[];

    // Behind now, level or ahead before: that half-open window is exactly the set of people
    // this post moved past, and it excludes anyone who was already behind.
    const passed = friends.filter(friend => {
      const theirs = pointsFromCounts({
        gold: Number(friend.gold),
        silver: Number(friend.silver),
        bronze: Number(friend.bronze),
      });
      return theirs >= previous && theirs < points;
    });

    if (!passed.length) return;

    const mover = (await sql`select name from "user" where id = ${userId}`) as { name: string | null }[];
    const name = mover[0]?.name?.trim() || ARTISTS[artistIndexFor(userId)].name;

    // The stamp is the gate, and the send follows what it moved. Read as a filter first and
    // written afterwards, two posts landing together both saw a date that had not been set yet
    // and both sent; here the second update matches nothing and returns nothing.
    //
    // The day is the *receiver's*, not the poster's. This cap means "already told today", and
    // whose today that is belongs to the person being told. Stamping the poster's day put two
    // posters on opposite sides of the date line into the same column: one at UTC+14 writes
    // tomorrow, and a genuine overtake posted from UTC-11 then reads `tomorrow < today` as
    // already-told and says nothing, for the better part of two days.
    const stamped = (await sql`
      update profiles set overtaken_notice_date =
        ((now() at time zone 'utc') + make_interval(mins => coalesce(profiles.utc_offset_minutes, 0)))::date
      where user_id in (select value from jsonb_array_elements_text(${JSON.stringify([...new Set(passed.map(row => row.user_id))])}::jsonb))
        and (
          overtaken_notice_date is null
          or overtaken_notice_date <
            ((now() at time zone 'utc') + make_interval(mins => coalesce(profiles.utc_offset_minutes, 0)))::date
        )
      returning user_id
    `) as { user_id: string }[];

    const told = new Set(stamped.map(row => row.user_id));
    if (!told.size) return;

    await sendPush(
      sql,
      passed
        .filter(row => told.has(row.user_id))
        .map(row => {
          const language = resolveLanguage(row.language);
          return {
            to: row.token,
            title: translate(language, 'push.overtakenTitle'),
            body: translate(language, 'push.overtakenBody', { name }),
            sound: 'default',
          };
        }),
    );
  } catch {
    // A notification that could not be sent is not a reason to fail a save.
  }
}

/**
 * This player's recorded time for their own day, or null when that day has no row or no time.
 * The day is passed in rather than read as `current_date`, because the row was filed under a
 * key the device chose: read against UTC, a player five hours behind it spends every evening
 * looking for a row dated tomorrow, finds nothing, and never notifies anybody.
 */
async function todaysDailyMs(sql: Sql, userId: string, day: string): Promise<number | null> {
  const rows = (await sql`
    select duration_ms from daily_completions
    where user_id = ${userId} and completed_date = ${day}::date
  `) as { duration_ms: number | string | null }[];
  const value = rows[0]?.duration_ms;
  return value === undefined || value === null ? null : Number(value);
}

/**
 * Tells the friends this player has just beaten on today's daily.
 *
 * Everyone gets the same puzzle, so this is the one comparison on the board that is fair, and
 * the only moment worth interrupting anyone for is the crossing. Somebody already slower than
 * this player heard about it when it happened; `previous` is what separates the two.
 *
 * It only reaches people who have played today, because a time you have not set cannot be
 * beaten — which also means nobody is nagged about a daily they have not got to yet.
 */
async function notifyDailyBeaten(
  sql: Sql,
  userId: string,
  day: string,
  previousMs: number | null,
  currentMs: number | null,
): Promise<void> {
  if (currentMs === null) return;

  try {
    // The poster's day for everybody, because the whole point of the comparison is that it is
    // the same puzzle. Each friend's own day would pit this time against a puzzle they have not
    // seen, and `current_date` would pick a day neither of them is on.
    const friends = (await sql`
      select push_tokens.token, profiles.language, daily_completions.user_id, daily_completions.duration_ms
      from friendships
      join daily_completions on daily_completions.user_id = friendships.friend_id
        and daily_completions.completed_date = ${day}::date
      join push_tokens on push_tokens.user_id = friendships.friend_id
      join profiles on profiles.user_id = friendships.friend_id
      where friendships.user_id = ${userId}
        and daily_completions.duration_ms is not null
    `) as { token: string; language: string | null; user_id: string; duration_ms: number | string }[];

    const passed = friends.filter(friend => beatsFriendTime(previousMs, currentMs, Number(friend.duration_ms)));

    if (!passed.length) return;

    const mover = (await sql`select name from "user" where id = ${userId}`) as { name: string | null }[];
    const name = mover[0]?.name?.trim() || ARTISTS[artistIndexFor(userId)].name;
    const time = formatResultDuration(currentMs);

    // Same gate as the overtake, and the same reason the day is the receiver's rather than the
    // poster's: "already told today" is a fact about the person being told, and two posters on
    // opposite sides of the date line writing their own days into one column silence each other.
    const stamped = (await sql`
      update profiles set daily_notice_date =
        ((now() at time zone 'utc') + make_interval(mins => coalesce(profiles.utc_offset_minutes, 0)))::date
      where user_id in (select value from jsonb_array_elements_text(${JSON.stringify([...new Set(passed.map(row => row.user_id))])}::jsonb))
        and (
          daily_notice_date is null
          or daily_notice_date <
            ((now() at time zone 'utc') + make_interval(mins => coalesce(profiles.utc_offset_minutes, 0)))::date
        )
      returning user_id
    `) as { user_id: string }[];

    const told = new Set(stamped.map(row => row.user_id));
    if (!told.size) return;

    await sendPush(
      sql,
      passed
        .filter(row => told.has(row.user_id))
        .map(row => {
          const language = resolveLanguage(row.language);
          return {
            to: row.token,
            title: translate(language, 'push.dailyBeatenTitle'),
            body: translate(language, 'push.dailyBeatenBody', { name, time }),
            sound: 'default',
          };
        }),
    );
  } catch {
    // A notification that could not be sent is not a reason to fail a save.
  }
}

async function getUserId(req: VercelRequest): Promise<string | null> {
  const { fromNodeHeaders } = await import('better-auth/node');
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user.id ?? null;
}

async function readProgress(sql: Sql, userId: string): Promise<unknown> {
  const [progressRows, solvedRows, dailyRows, medalRows, freezeRows] = await Promise.all([
    sql`
      select hints, hints_earned, hints_spent, daily_completed_date
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
      select completed_date, duration_ms, hints_used
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
  // The counters are the state and `hints` is a copy of what they say, so the answer is derived
  // rather than read: an API rolled back onto this schema can inflate the column while it runs,
  // and the pair it never touched is still the truth when this one comes back.
  // `hints` is the fallback rather than dead weight: the columns are added in one statement and
  // backfilled in a guarded block below it, so an apply interrupted between the two leaves every
  // row null here. Reading 0 there would hand every account an empty balance silently, which is
  // the one deploy path the schema's own ordering notes do not already make loud.
  const hintsEarned = Number(progress?.hints_earned ?? progress?.hints ?? 0);
  const hintsSpent = Number(progress?.hints_spent ?? 0);

  return {
    progress: progress
      ? {
          hints: toHintBalance(hintsEarned - hintsSpent),
          hintsEarned,
          hintsSpent,
          dailyCompletedDate: fromPgDate(progress.daily_completed_date),
          dailyCompletionDates: (dailyRows as DailyRow[]).map(row => fromPgDate(row.completed_date)).filter(Boolean),
          // Only the days that have a time; the rest stay absent rather than arriving as zero,
          // which the board would otherwise read as the fastest solve ever recorded. The null
          // is checked rather than left to `Number(null)`, which is 0 and only happens to be
          // rejected by the cap below — the same check the hints line makes.
          dailyDurations: Object.fromEntries(
            (dailyRows as DailyRow[])
              .map(row => [
                fromPgDate(row.completed_date),
                row.duration_ms === null ? null : toDurationMs(Number(row.duration_ms)),
              ] as const)
              .filter(([date, ms]) => date && ms !== null),
          ),
          // Sparse like the durations: a day nobody counted stays absent rather than arriving
          // as zero, which would read as a solve that needed no help.
          dailyHints: Object.fromEntries(
            (dailyRows as DailyRow[])
              .map(row => [
                fromPgDate(row.completed_date),
                row.hints_used === null ? null : toHintsUsed(Number(row.hints_used)),
              ] as const)
              .filter(([date, hints]) => date && hints !== null),
          ),
          streakFreezes: (freezeRows as FreezeRow[]).map(row => fromPgDate(row.frozen_date)).filter(Boolean),
        }
      : null,
    solvedLevelIdxs: (solvedRows as SolvedRow[]).map(row => row.level_idx),
    solvedLevelDates: Object.fromEntries((solvedRows as SolvedRow[]).map(row => [row.level_idx, fromPgDate(row.solved_at)]).filter(([, date]) => date)),
    levelMedals: Object.fromEntries((medalRows as MedalRow[]).map(row => [row.level_idx, row.medal])),
  };
}

async function writeProgress(sql: Sql, userId: string, body: PostBody): Promise<void> {
  const progress = body.progress;

  // Everything the payload claims is checked before anything is written. A post carries a
  // player's whole history, so half of it applied and then a date the calendar does not have
  // would leave them with days they never played and no way to tell which.
  const dailyCompletedDate = requirePgDate(progress?.dailyCompletedDate, 'daily_completed_date');

  const solvedLevelIdxs = [...new Set(requireArray(body.solvedLevelIdxs, 'solved_level_idxs', MAX_CAMPAIGN_LEVEL))]
    .filter(isLevelIdx);

  const dailyCompletionDates = [...new Set(requireArray(progress?.dailyCompletionDates, 'daily_completion_dates', MAX_DATE_ENTRIES))]
    .map(date => requireDateKey(date, 'daily_completion_dates'));

  const streakFreezes = [...new Set(requireArray(progress?.streakFreezes, 'streak_freezes', MAX_DATE_ENTRIES))]
    .map(date => requireDateKey(date, 'streak_freezes'));

  const medalEntries = Object.entries(body.levelMedals ?? {});
  if (medalEntries.length > MAX_CAMPAIGN_LEVEL) throw new BadRequest('too_many_level_medals');
  const levelMedals = medalEntries
    .filter(([idx, medal]) => isLevelIdx(Number(idx)) && ['gold', 'silver', 'bronze'].includes(medal))
    .reduce<Record<string, Medal>>((result, [idx, medal]) => {
      result[idx] = medal;
      return result;
    }, {});

  // Recorded first and on its own, because the day everything below is measured against comes
  // out of this column: a player who has just crossed a time zone is on the new clock, and so
  // are the dates their device just sent. Only when the device said, though — an older client
  // sends nothing here, and overwriting a known offset with a default puts that player back on
  // UTC, which is the bug this fixes.
  const offset = toUtcOffsetMinutes(progress?.utcOffsetMinutes);
  if (offset !== null) {
    await sql`
      insert into profiles (user_id, utc_offset_minutes) values (${userId}, ${offset})
      on conflict (user_id) do update set utc_offset_minutes = excluded.utc_offset_minutes
    `;
  }

  const postsADailyTime = Object.keys(progress?.dailyDurations ?? {}).length > 0;
  const postsAMedal = Object.keys(levelMedals).length > 0;

  // The poster's own day, read once and shared: the time read before the writes, the one read
  // after them and the notice dates stamped at the end all have to be talking about the same
  // day, and a post that can notify nobody does not pay for the round trip at all.
  const day = postsADailyTime || postsAMedal ? await localDay(sql, userId) : null;

  // Today's time as it stood before this post, which the insert below is about to change.
  // Neon's tag is lazy — nothing leaves until `Promise.all(writes)` is awaited — so what has
  // to happen first is this read, not the `writes.push` calls.
  const previousDailyMs = day && postsADailyTime ? await todaysDailyMs(sql, userId, day) : null;

  const writes: Promise<unknown>[] = [];

  if (progress) {
    const counters = toHintCounters(progress);
    // Null for a payload that carried the counters, so the `greatest` below ignores it — that is
    // what null does inside `greatest` in Postgres, and it is the whole of the switch between the
    // two readings. Cast because the driver sends parameters untyped and `integer + unknown` has
    // nothing to resolve against.
    const legacyBalance = counters.exact ? null : counters.balance;

    writes.push(sql`
      insert into user_progress (user_id, hints, hints_earned, hints_spent, daily_completed_date, updated_at)
      values (
        ${userId},
        ${counters.balance},
        ${counters.earned},
        ${counters.spent},
        ${dailyCompletedDate},
        now()
      )
      on conflict (user_id) do update set
        -- Two counters, each merged with greatest(), and the balance derived from them. The
        -- balance itself cannot be merged at all: it moves in both directions, and every rule for
        -- one number is a claim about which side is newer that neither side can make. The greater
        -- of two balances made it a high-water mark, so four hints spent on the phone came back
        -- the next time the tablet posted its untouched ten; the later of two would have made a
        -- phone offline since Tuesday overwrite every hint earned on the tablet since. Counters
        -- only grow, so greatest() is the only merge either admits and both failures become
        -- unsayable.
        --
        -- The third term is for a client that predates the counters and sends only a balance: all
        -- such a post says is that this account earned at least what it has spent plus what it is
        -- holding. It reproduces exactly the behaviour those builds were written against, and it
        -- is null — and so ignored by greatest() — for a post that carried the real numbers.
        hints_earned = greatest(user_progress.hints_earned, excluded.hints_earned, user_progress.hints_spent + ${legacyBalance}::int),
        hints_spent = greatest(user_progress.hints_spent, excluded.hints_spent),
        -- The hints column is derived, and kept only for readers that predate the counters: the
        -- app builds already in the stores, and this endpoint's own previous version should it be
        -- rolled back onto this schema. The two expressions above are repeated rather than named
        -- because every reference to the target row inside "do update set" reads the value it had
        -- before this statement — there is no way to say "what the line above just computed".
        hints = least(${MAX_HINTS}, greatest(0,
          greatest(user_progress.hints_earned, excluded.hints_earned, user_progress.hints_spent + ${legacyBalance}::int)
            - greatest(user_progress.hints_spent, excluded.hints_spent))),
        daily_completed_date = excluded.daily_completed_date,
        updated_at = now()
    `);
  }

  if (solvedLevelIdxs.length) {
    writes.push(sql`
      insert into solved_levels (user_id, level_idx)
      select ${userId}, level_idx::int
      from jsonb_array_elements_text(${JSON.stringify(solvedLevelIdxs)}::jsonb) as item(level_idx)
      on conflict (user_id, level_idx) do nothing
    `);
  }

  if (dailyCompletionDates.length) {
    // Date and time go in together so a first completion carries its own clock, and a
    // repeat only ever lowers the record: `least` ignores a null on either side, so a day
    // that already has a time cannot be blanked by a client that forgot to send one.
    const durations = progress?.dailyDurations ?? {};
    const hints = progress?.dailyHints ?? {};
    const rows = dailyCompletionDates.map(date => ({
      completed_date: toPgDate(date),
      duration_ms: toDurationMs(durations[date]),
      hints_used: toHintsUsed(hints[date]),
    }));

    writes.push(sql`
      insert into daily_completions (user_id, completed_date, duration_ms, hints_used)
      select ${userId}, (item->>'completed_date')::date, (item->>'duration_ms')::int, (item->>'hints_used')::int
      from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) as item
      on conflict (user_id, completed_date) do update set
        duration_ms = least(daily_completions.duration_ms, excluded.duration_ms),
        -- Follows the time rather than taking the smaller count: the record for a day is its
        -- fastest solve, and the hints that belong to it are the ones that solve spent. A
        -- replay that was slower but cleaner does not get to lend its zero to a time it did
        -- not set. A faster solve from a client that sends no count takes the column back to
        -- null with it, which is the truth — nobody counted the solve now on the record.
        hints_used = case
          when excluded.duration_ms is not null
            and (daily_completions.duration_ms is null or excluded.duration_ms < daily_completions.duration_ms)
          then excluded.hints_used
          else coalesce(daily_completions.hints_used, excluded.hints_used)
        end
    `);
  }

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

  if (postsAMedal) {
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

  // Points come from medals and from nothing else, so a post without one cannot have moved
  // this player past anybody and does not pay for the queries that would prove it.
  if (day && postsAMedal) await notifyOvertaken(sql, userId, day);

  // Same gate for the daily: only a post that carried a time can have beaten one.
  if (day && postsADailyTime) {
    await notifyDailyBeaten(sql, userId, day, previousDailyMs, await todaysDailyMs(sql, userId, day));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const userId = await getUserId(req);
    if (!userId) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sql = neon(databaseUrl);

    if (req.method === 'GET') {
      sendJson(res, 200, await readProgress(sql, userId));
      return;
    }

    if (req.method === 'POST') {
      await writeProgress(sql, userId, parseBody(req));
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    // A payload this endpoint refuses is the client's to fix and says so; anything else is
    // ours, and the log is the only place it can be read from afterwards. The message itself
    // stays here — it is a failed query, and the client can do nothing with it.
    if (error instanceof BadRequest) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    reportServerError(error, 'progress', { method: req.method });
    sendJson(res, 500, { error: 'internal_error' });
  }
}
