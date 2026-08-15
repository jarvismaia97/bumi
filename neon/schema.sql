create table if not exists profiles (
  user_id text primary key,
  created_at timestamptz not null default now()
);

-- The handle a player gives out to be added to someone's leaderboard. Never the account id:
-- that one is the auth subject and cannot be rotated once it has been pasted into a chat.
alter table profiles add column if not exists friend_code text;
create unique index if not exists profiles_friend_code_idx on profiles (friend_code);

-- Friendship is stored in both directions, one row each way. Adding by code makes the pair
-- mutual on the spot: handing out the code is the consent, and either side can delete their
-- row or rotate their code to end it.
create table if not exists friendships (
  user_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_not_self check (user_id <> friend_id)
);

-- Only the reverse direction needs an index of its own. The primary key above already leads on
-- `user_id`, so it answers every lookup by owner from its own first column; `friend_id` has no
-- such cover. Both the cascade on `friendships_friend_id_fk` at the foot of this file and the
-- `or friend_id = $1` half of the deletion sweep in `beforeDelete` (src/lib/auth.ts) search on it,
-- so without this every account deletion reads the whole table.
create index if not exists friendships_friend_id_idx on friendships (friend_id);

-- One row per device, not per player: an account signed in on two devices should hear about a
-- new friend on both. The token is the key, so a device that changes hands stops receiving the
-- previous owner's notifications.
create table if not exists push_tokens (
  token text primary key,
  user_id text not null,
  platform text not null default 'unknown',
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on push_tokens (user_id);

-- The language the device asked to be notified in. Without it the only clue available is the
-- accept-language of whoever did the adding, which is the wrong person's setting.
alter table profiles add column if not exists language text;

-- Guessing a code is 729 million tries, which is a lot by hand and nothing to a script. Every
-- attempt lands here so the endpoint can refuse a caller who is clearly enumerating.
create table if not exists friend_code_attempts (
  user_id text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists friend_code_attempts_user_id_idx on friend_code_attempts (user_id, attempted_at desc);

create table if not exists user_progress (
  user_id text primary key,
  hints integer not null default 0,
  daily_completed_date date,
  updated_at timestamptz not null default now(),
  constraint user_progress_hints_nonnegative check (hints >= 0)
);

create table if not exists solved_levels (
  user_id text not null,
  level_idx integer not null,
  solved_at timestamptz not null default now(),
  primary key (user_id, level_idx),
  constraint solved_levels_level_idx_nonnegative check (level_idx >= 0)
);

create table if not exists daily_completions (
  user_id text not null,
  completed_date date not null,
  primary key (user_id, completed_date)
);

-- How long the puzzle took, in milliseconds. Nullable on purpose: every completion recorded
-- before the clock was kept has no time and never will, and a day solved offline by an old
-- client still arrives without one.
alter table daily_completions add column if not exists duration_ms integer;

-- The board reads today's row for every friend at once, which is the whole of the daily
-- comparison; without this it is a scan of the table per visit.
create index if not exists daily_completions_date_idx on daily_completions (completed_date, user_id);

-- Days a streak freeze covered. Deliberately not rows in `daily_completions`: the streak should
-- count them and the weekly and monthly goals must not, because a frozen day was forgiven
-- rather than played, and counting it there would mint the hints those goals pay out.
create table if not exists streak_freezes (
  user_id text not null,
  frozen_date date not null,
  primary key (user_id, frozen_date)
);

-- The last board score the server saw for this player. Kept so a progress post can tell the
-- difference between "is ahead" and "just went ahead", which is the whole of an overtake:
-- without a previous value every post would re-announce a lead that has stood for weeks.
alter table profiles add column if not exists points integer not null default 0;

-- The day this player was last told someone passed them, so being overtaken by four friends on
-- a busy Sunday is one notification rather than four. The cap sits on the person receiving it,
-- which is the side that has to live with the noise.
alter table profiles add column if not exists overtaken_notice_date date;

-- The same idea for the daily, and a separate column on purpose: sharing one would let being
-- passed on points silence being beaten on today's time, and the two are different news.
alter table profiles add column if not exists daily_notice_date date;

create table if not exists level_medals (
  user_id text not null,
  level_idx integer not null,
  medal text not null check (medal in ('gold', 'silver', 'bronze')),
  earned_at timestamptz not null default now(),
  primary key (user_id, level_idx),
  constraint level_medals_level_idx_nonnegative check (level_idx >= 0)
);

-- The player's own clock, in minutes east of UTC, as their device last reported it. Everything
-- dated here is a date key the device chose, and the friends board was reading those against
-- `current_date`, which is UTC. For anyone west of it that is tomorrow for most of their evening:
-- their streak read zero from the moment their local yesterday became the server's day before
-- last, which is every evening before they have played. Nullable, and read as zero when it is:
-- a player who has not posted since this column existed is treated at UTC, as they were before.
alter table profiles add column if not exists utc_offset_minutes smallint;

-- Hints spent on that day's puzzle. The daily is the one number on the friends board where
-- everybody solved the same thing, and a hinted solve set against a clean one is the one way
-- that stops being true. Nullable for the reason `duration_ms` is: no row written before this
-- column existed has an answer, and none of them ever will.
alter table daily_completions add column if not exists hints_used smallint;

-- When the freeze was taken, as against the day it covers. A freeze arrives from the device that
-- spent it, so without this a backfilled one covering a gap from two years ago is
-- indistinguishable from one claimed this morning.
--
-- In two steps, and they are not interchangeable. Adding the column with a default fills every
-- row already there with it, which would stamp the whole history with the moment this ran and
-- read ever after as though every freeze on file was claimed that day — the exact confusion the
-- column exists to end. Added bare, the rows that predate it stay null, which is what they are:
-- unknown. The default is set afterwards and so reaches only what is written from here on.
--
-- Nothing reads this column. The staleness check described above was never wired up: no code in
-- src/, api/ or scripts/ mentions `claimed_at`, and the only thing that writes it is the default.
-- Kept rather than dropped, deliberately — the default has been filling it since it landed, so
-- every freeze taken since then carries a real answer, and dropping the column throws away the
-- only history the check could ever be built from. It is the freeze-granting path in
-- api/progress.ts that should read it.
alter table streak_freezes add column if not exists claimed_at timestamptz;
alter table streak_freezes alter column claimed_at set default now();

-- When `points` was last written. The number on its own cannot say whether it is this morning's
-- score or one left over from March, and the overtake check reads it as though it were current.
--
-- Also unread. api/progress.ts stamps it on every points write and then compares `points` without
-- it, which is the bug the column was added to fix and not yet the fix. Kept because the write
-- costs nothing and this is the only record of when a score was set; what should consume it is
-- that same overtake comparison, discarding a `points` value too old to be a real position.
alter table profiles add column if not exists points_updated_at timestamptz;

-- Whether the code was found. Enumeration is made of misses; a player working through four codes
-- from a group chat is not, and until now both spent the same hourly budget.
alter table friend_code_attempts add column if not exists succeeded boolean not null default false;

-- The hint balance, as two counters that only ever go up. `hints` alone could not be synced, and
-- the reason is the shape of the number rather than the rule chosen for it: a balance moves in
-- both directions, and no way of merging one number is right for that. `greatest` made it a
-- high-water mark, so four hints spent on the phone came back the next time the tablet posted its
-- untouched ten. Last-write-wins traded that for the opposite loss, a device offline since Tuesday
-- overwriting every hint earned since. Counters have no such choice to make: each only grows, so
-- `max` is the only merge either admits, and neither resurrection nor rollback can be expressed.
-- The balance is derived wherever it is wanted — `least(15, greatest(0, hints_earned -
-- hints_spent))` — and two devices that each spend while apart converge on the larger spend, which
-- is the direction to be wrong in about a currency.
--
-- Added bare and backfilled, which is not interchangeable with adding them with a default.
-- `add column not null default 3` fills every row already here with 3, and on an account that has
-- played that is not a starting grant — it is every existing player's balance replaced by one
-- number. The default is set afterwards and so reaches only rows written from here on, and the
-- copy is guarded on the column's own nullability so it runs once and every later apply finds
-- nothing to do.
alter table user_progress add column if not exists hints_earned integer;
alter table user_progress add column if not exists hints_spent integer;
alter table user_progress alter column hints_earned set default 3;
alter table user_progress alter column hints_spent set default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_progress'
      and column_name = 'hints_earned' and is_nullable = 'YES'
  ) then
    -- Nothing ever recorded what an existing balance cost to reach, so the whole of it is carried
    -- over as earned and nothing as spent. That is the only reading with the property the backfill
    -- has to have: `hints_earned - hints_spent` is exactly the balance the player had a moment
    -- before this ran. It is also the reading the client's merge makes of a server that answers
    -- without the counters, so a device and its account cannot disagree about the same number.
    update user_progress set hints_earned = hints, hints_spent = 0 where hints_earned is null;
    alter table user_progress alter column hints_earned set not null;
    alter table user_progress alter column hints_spent set not null;
  end if;
end $$;

-- `hints` is kept rather than dropped, and api/progress.ts writes it on every post as the balance
-- the counters derive. It is what a deploy that is not in step reads. This file is applied by hand
-- (`npm run db:schema`) while the API ships on a push to main, so the two are minutes apart in
-- whichever order that day went:
--
--   API ahead of the schema: every post and read of `user_progress` fails outright on the missing
--   columns, the client's sync marks itself failed and retries, and nothing is written at all.
--   Loud and empty-handed, which is the safe half of the pair.
--
--   Schema ahead of a rolled-back API: the old code finds the column it expects and a balance that
--   is true, and leaves the counters alone the whole time it is there. Its own `greatest(hints,
--   excluded.hints)` can inflate `hints` while it runs — that is the bug this replaces, briefly
--   back — and the first post from the current API recomputes the column from the counters, which
--   were never touched. Dropping `hints` would instead make that rollback a not_null_violation on
--   every save.
--
-- And it is not only about deploys: the two builds already in the app stores post this number and
-- nothing else, and will for as long as they stay installed.

-- The last recorded daily completion used to be backfilled here, copying
-- `user_progress.daily_completed_date` into `daily_completions` for accounts that predated the
-- second table. Retired rather than guarded, and the two are the same thing here: it has already
-- run on every database this file has ever been applied to, and a database new enough never to
-- have run it has no rows old enough to need it. What it cost in the meantime was a read of the
-- whole of `user_progress`, on every apply, to find nothing left to move.

-- Existing UUID-based progress rows remain valid after moving to text user IDs.
--
-- Guarded on the column's current type rather than run flat. `alter column … type … using` takes
-- an ACCESS EXCLUSIVE lock — the one that blocks readers as well as writers — for as long as it
-- runs, and it takes it whether or not there is anything to change; on every database this has
-- already been applied to, which is all of them, that lock buys nothing. Postgres does recognise
-- `user_id::text` against a column that is already text as a no-op and skips the table rewrite,
-- so the window is short, but that is an optimisation of its own planner rather than a promise,
-- and the lock is taken either way. Reading `information_schema.columns` first costs nothing and
-- makes the statement say what it means: this runs once, on a database that has not moved yet.
do $$
declare
  target text;
  targets text[] := array['profiles', 'user_progress', 'solved_levels'];
begin
  foreach target in array targets loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = target
        and column_name = 'user_id' and data_type <> 'text'
    ) then
      execute format('alter table %I alter column user_id type text using user_id::text', target);
    end if;
  end loop;
end $$;

-- Columns nothing has written to since the features that owned them were removed: the endless
-- mode, and a display name and avatar that the painter nickname and mosaic replaced. Verified
-- empty across every row before dropping.
alter table profiles drop column if exists display_name;
alter table profiles drop column if exists avatar_url;
alter table user_progress drop column if exists infinite_best;

-- Five single-column indexes on `user_id`, each on a table whose primary key already leads on
-- `user_id`: friendships (user_id, friend_id), solved_levels (user_id, level_idx),
-- daily_completions (user_id, completed_date), streak_freezes (user_id, frozen_date) and
-- level_medals (user_id, level_idx). A btree on (a, b) answers `where a = ?` from its own leading
-- column, so none of these ever served a lookup the primary key was not already serving. What
-- they cost is real: a second tree to descend and write on every insert, and pages held in cache
-- that a query could have been using.
--
-- Not every user_id index in this file is redundant, and the primary key is what tells them
-- apart. `push_tokens` is keyed on `token`, so `push_tokens_user_id_idx` is the only way to find
-- a player's devices; `friend_code_attempts` has no primary key at all, and its index carries
-- `attempted_at desc` for the window the rate limiter reads; and `daily_completions_date_idx`
-- leads on `completed_date`, which is the column the friends board searches and the one the
-- primary key cannot offer first. Those three stay.
drop index if exists friendships_user_id_idx;
drop index if exists solved_levels_user_id_idx;
drop index if exists daily_completions_user_id_idx;
drop index if exists streak_freezes_user_id_idx;
drop index if exists level_medals_user_id_idx;

-- The API refuses each of these values before it reaches the column, and the API is the only
-- thing that does. That is thin cover for `duration_ms` in particular: the friends board sorts
-- ascending on it, so a single zero or negative takes the top of every board it appears on and
-- stays there. Said here, the bound survives a second writer — a backfill, a psql session, the
-- next endpoint written by someone who did not read this one. The numbers are the ones already
-- in api/progress.ts: `toDurationMs`, `toHintsUsed`, and the UTC-12..UTC+14 offset clamp.
--
-- `not valid` for the reason the foreign keys below are: it binds every row written from here on
-- and skips the scan of what is already there, so a row left by an older client cannot fail the
-- migration. The validation sweep at the foot of this file is what promotes them once the
-- existing rows turn out to pass. Null passes a check either way, which is what the nullable
-- columns among these need.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('daily_completions', 'daily_completions_duration_ms_range',
       'duration_ms > 0 and duration_ms < 86400000'),
      ('daily_completions', 'daily_completions_hints_used_range',
       'hints_used between 0 and 99'),
      ('profiles', 'profiles_utc_offset_minutes_range',
       'utc_offset_minutes between -720 and 840'),
      ('profiles', 'profiles_points_nonnegative',
       'points >= 0'),
      -- Both counters are lifetime totals that only ever grow, so the only thing that can be said
      -- about either on its own is that it never went below where it started. Deliberately not
      -- `hints_spent <= hints_earned` as well: that invariant does hold, and the balance is
      -- floored at zero everywhere it is derived rather than defended here, because a constraint
      -- there turns any future merge anomaly into a save that fails for the player instead of a
      -- balance that reads zero.
      ('user_progress', 'user_progress_hints_earned_nonnegative',
       'hints_earned >= 0'),
      ('user_progress', 'user_progress_hints_spent_nonnegative',
       'hints_spent >= 0')
    ) as t(table_name, constraint_name, expression)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = to_regclass('public.' || quote_ident(spec.table_name))
        and conname = spec.constraint_name
    ) then
      execute format(
        'alter table %I add constraint %I check (%s) not valid',
        spec.table_name, spec.constraint_name, spec.expression
      );
    end if;
  end loop;
end $$;

-- An attempt is spent once the rate limiter's window has passed it, and the window is an hour.
-- The endpoint prunes as it goes but only ever the caller's own rows (api/friends.ts), so a
-- player who tried four codes from a group chat once and never came back leaves theirs on the
-- table forever, and nobody is left to collect them. This is a sweep at apply time, which is the
-- wrong clock — it runs when someone happens to deploy, not when the rows go stale. A pg_cron job
-- running this nightly is the shape this wants; this line should go when there is one.
delete from friend_code_attempts where attempted_at < now() - interval '1 day';

-- Account deletion removes the rows below by hand, in `beforeDelete` (src/lib/auth.ts), and that
-- list is right only for as long as somebody remembers to extend it. These say it once, where
-- adding a table cannot miss it. `not valid` on purpose: it enforces every row written from here
-- on and skips the scan of what is already there, so an orphan left by a deletion predating that
-- hook cannot fail the migration. The cascade fires either way — validation is about rows that
-- already exist, not about the trigger.
--
-- After the column-type alters above, which have to have run first: a foreign key cannot be added
-- from a uuid column to better-auth's text `id`. Only the validation sweep comes later, and it has
-- to, because it is what promotes these. `"user"` is better-auth's own table, created by its
-- schema rather than this one, so a database that has not seen better-auth yet skips the whole
-- block rather than failing on it.
do $$
declare
  child text;
  children text[] := array[
    'profiles', 'friendships', 'push_tokens', 'friend_code_attempts', 'user_progress',
    'solved_levels', 'daily_completions', 'streak_freezes', 'level_medals'
  ];
begin
  if to_regclass('public."user"') is null then return; end if;

  foreach child in array children loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = to_regclass('public.' || quote_ident(child))
        and conname = child || '_user_id_fk'
    ) then
      execute format(
        'alter table %I add constraint %I foreign key (user_id) references "user"(id) on delete cascade not valid',
        child, child || '_user_id_fk'
      );
    end if;
  end loop;

  -- Both directions of a friendship point at an account, and the other one has no column named
  -- `user_id` to be caught by the loop above.
  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.friendships') and conname = 'friendships_friend_id_fk'
  ) then
    alter table friendships add constraint friendships_friend_id_fk
      foreign key (friend_id) references "user"(id) on delete cascade not valid;
  end if;
end $$;

-- `not valid` is the right way to add a constraint and the wrong way to leave one. Until it is
-- validated, Postgres holds the constraint as enforced for new rows but unproven for old ones,
-- and a planner will not reason from something unproven — the foreign keys above cannot inform a
-- join, and the checks cannot exclude a partition or a branch. Validation is the second half of
-- the idiom and it never got written, so every constraint in this file has been sitting in that
-- state since the day it was added.
--
-- This validates each one once and finds nothing to do on every apply after, because validating
-- flips `convalidated` and the query below only selects what is still false.
--
-- Each one runs in its own block, and that is the whole design rather than caution. Validation
-- reads the entire table and throws on the first row that fails, which is exactly the case these
-- were declared `not valid` to survive: an orphan left by an account deletion that predates the
-- `beforeDelete` hook, a duration written by a client older than the bound. Without the handler
-- one such row would fail the statement, fail the file, and block every later apply on a
-- migration that has nothing to do with it. With it, that constraint stays not valid — still
-- enforcing every new row, exactly as it does today — and says which one and why, so the rows can
-- be found and the next apply picks it up.
do $$
declare
  target record;
begin
  for target in
    select conrelid::regclass::text as table_name, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and contype in ('c', 'f')
      and not convalidated
      and conrelid::regclass::text in (
        'profiles', 'friendships', 'push_tokens', 'friend_code_attempts', 'user_progress',
        'solved_levels', 'daily_completions', 'streak_freezes', 'level_medals'
      )
  loop
    begin
      execute format('alter table %I validate constraint %I', target.table_name, target.conname);
    exception when others then
      raise notice 'left % on % not valid: %', target.conname, target.table_name, sqlerrm;
    end;
  end loop;
end $$;
