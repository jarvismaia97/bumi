create table if not exists profiles (
  user_id text primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists user_progress (
  user_id text primary key,
  hints integer not null default 0,
  infinite_best integer not null default 0,
  daily_completed_date date,
  updated_at timestamptz not null default now(),
  constraint user_progress_hints_nonnegative check (hints >= 0),
  constraint user_progress_infinite_best_nonnegative check (infinite_best >= 0)
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
