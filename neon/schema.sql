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

create index if not exists friendships_user_id_idx on friendships (user_id);

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

create index if not exists solved_levels_user_id_idx on solved_levels (user_id);

create table if not exists daily_completions (
  user_id text not null,
  completed_date date not null,
  primary key (user_id, completed_date)
);

create index if not exists daily_completions_user_id_idx on daily_completions (user_id);

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

create index if not exists streak_freezes_user_id_idx on streak_freezes (user_id);

-- The last board score the server saw for this player. Kept so a progress post can tell the
-- difference between "is ahead" and "just went ahead", which is the whole of an overtake:
-- without a previous value every post would re-announce a lead that has stood for weeks.
alter table profiles add column if not exists points integer not null default 0;

-- The day this player was last told someone passed them, so being overtaken by four friends on
-- a busy Sunday is one notification rather than four. The cap sits on the person receiving it,
-- which is the side that has to live with the noise.
alter table profiles add column if not exists overtaken_notice_date date;

create table if not exists level_medals (
  user_id text not null,
  level_idx integer not null,
  medal text not null check (medal in ('gold', 'silver', 'bronze')),
  earned_at timestamptz not null default now(),
  primary key (user_id, level_idx),
  constraint level_medals_level_idx_nonnegative check (level_idx >= 0)
);

create index if not exists level_medals_user_id_idx on level_medals (user_id);

-- Preserve the last recorded daily completion when upgrading existing users.
insert into daily_completions (user_id, completed_date)
select user_id, daily_completed_date
from user_progress
where daily_completed_date is not null
on conflict (user_id, completed_date) do nothing;

-- Existing UUID-based progress rows remain valid after moving to text user IDs.
alter table profiles alter column user_id type text using user_id::text;
alter table user_progress alter column user_id type text using user_id::text;
alter table solved_levels alter column user_id type text using user_id::text;

-- Columns nothing has written to since the features that owned them were removed: the endless
-- mode, and a display name and avatar that the painter nickname and mosaic replaced. Verified
-- empty across every row before dropping.
alter table profiles drop column if exists display_name;
alter table profiles drop column if exists avatar_url;
alter table user_progress drop column if exists infinite_best;
