create table if not exists public.leaderboard_country_daily (
  period_date date not null,
  country_code text not null,
  country_name text not null,
  total_score integer not null default 0,
  total_correct integer not null default 0,
  total_questions integer not null default 0,
  submission_count integer not null default 0,
  best_accuracy numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint leaderboard_country_daily_pk primary key (period_date, country_code),
  constraint leaderboard_country_daily_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint leaderboard_country_daily_totals_non_negative check (
    total_score >= 0
    and total_correct >= 0
    and total_questions >= 0
    and submission_count >= 0
    and best_accuracy >= 0
    and best_accuracy <= 100
  )
);

alter table public.leaderboard_country_daily enable row level security;

drop policy if exists "Allow public leaderboard reads"
  on public.leaderboard_country_daily;

create policy "Allow public leaderboard reads"
  on public.leaderboard_country_daily
  for select
  to anon
  using (true);

create index if not exists leaderboard_country_daily_rank_idx
  on public.leaderboard_country_daily (period_date, total_score desc, submission_count desc);

create table if not exists public.leaderboard_country_daily_v2 (
  period_date date not null,
  country_code text not null,
  country_name text not null,
  total_score integer not null default 0,
  total_correct integer not null default 0,
  total_questions integer not null default 0,
  submission_count integer not null default 0,
  best_accuracy numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint leaderboard_country_daily_v2_pk primary key (period_date, country_code),
  constraint leaderboard_country_daily_v2_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint leaderboard_country_daily_v2_totals_non_negative check (
    total_score >= 0
    and total_correct >= 0
    and total_questions >= 0
    and submission_count >= 0
    and best_accuracy >= 0
    and best_accuracy <= 100
  )
);

alter table public.leaderboard_country_daily_v2 enable row level security;

drop policy if exists "Allow public v2 leaderboard reads"
  on public.leaderboard_country_daily_v2;

create policy "Allow public v2 leaderboard reads"
  on public.leaderboard_country_daily_v2
  for select
  to anon
  using (true);

create index if not exists leaderboard_country_daily_v2_rank_idx
  on public.leaderboard_country_daily_v2 (
    period_date,
    total_score desc,
    submission_count desc
  );

create table if not exists public.leaderboard_session_receipts (
  session_id uuid primary key,
  score_version smallint not null default 2,
  period_date date not null,
  country_code text not null,
  session_points integer not null,
  submitted_at timestamptz not null default now(),
  constraint leaderboard_session_receipts_score_version check (score_version = 2),
  constraint leaderboard_session_receipts_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint leaderboard_session_receipts_points_non_negative check (session_points >= 0)
);

alter table public.leaderboard_session_receipts enable row level security;

create index if not exists leaderboard_session_receipts_cleanup_idx
  on public.leaderboard_session_receipts (submitted_at);

create or replace function public.increment_country_daily_score(
  p_period_date date,
  p_country_code text,
  p_country_name text,
  p_score integer,
  p_correct_answers integer,
  p_total_questions integer,
  p_accuracy numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leaderboard_country_daily (
    period_date,
    country_code,
    country_name,
    total_score,
    total_correct,
    total_questions,
    submission_count,
    best_accuracy,
    updated_at
  )
  values (
    p_period_date,
    p_country_code,
    p_country_name,
    greatest(p_score, 0),
    greatest(p_correct_answers, 0),
    greatest(p_total_questions, 0),
    1,
    least(greatest(p_accuracy, 0), 100),
    now()
  )
  on conflict (period_date, country_code) do update set
    country_name = excluded.country_name,
    total_score = public.leaderboard_country_daily.total_score + excluded.total_score,
    total_correct = public.leaderboard_country_daily.total_correct + excluded.total_correct,
    total_questions = public.leaderboard_country_daily.total_questions + excluded.total_questions,
    submission_count = public.leaderboard_country_daily.submission_count + 1,
    best_accuracy = greatest(
      public.leaderboard_country_daily.best_accuracy,
      excluded.best_accuracy
    ),
    updated_at = now();
end;
$$;

revoke all on function public.increment_country_daily_score(
  date,
  text,
  text,
  integer,
  integer,
  integer,
  numeric
) from public;

grant execute on function public.increment_country_daily_score(
  date,
  text,
  text,
  integer,
  integer,
  integer,
  numeric
) to anon;

create or replace function public.submit_anonymous_session_v2(
  p_period_date date,
  p_session_id uuid,
  p_country_code text,
  p_country_name text,
  p_session_points integer,
  p_correct_answers integer,
  p_total_questions integer,
  p_accuracy numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leaderboard_session_receipts (
    session_id,
    score_version,
    period_date,
    country_code,
    session_points,
    submitted_at
  )
  values (
    p_session_id,
    2,
    p_period_date,
    p_country_code,
    greatest(p_session_points, 0),
    now()
  )
  on conflict (session_id) do nothing;

  if not found then
    return 'duplicate';
  end if;

  insert into public.leaderboard_country_daily_v2 (
    period_date,
    country_code,
    country_name,
    total_score,
    total_correct,
    total_questions,
    submission_count,
    best_accuracy,
    updated_at
  )
  values (
    p_period_date,
    p_country_code,
    p_country_name,
    greatest(p_session_points, 0),
    greatest(p_correct_answers, 0),
    greatest(p_total_questions, 0),
    1,
    least(greatest(p_accuracy, 0), 100),
    now()
  )
  on conflict (period_date, country_code) do update set
    country_name = excluded.country_name,
    total_score = public.leaderboard_country_daily_v2.total_score + excluded.total_score,
    total_correct = public.leaderboard_country_daily_v2.total_correct + excluded.total_correct,
    total_questions = public.leaderboard_country_daily_v2.total_questions + excluded.total_questions,
    submission_count = public.leaderboard_country_daily_v2.submission_count + 1,
    best_accuracy = greatest(
      public.leaderboard_country_daily_v2.best_accuracy,
      excluded.best_accuracy
    ),
    updated_at = now();

  return 'accepted';
end;
$$;

revoke all on function public.submit_anonymous_session_v2(
  date,
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  numeric
) from public;

grant execute on function public.submit_anonymous_session_v2(
  date,
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  numeric
) to service_role;

create or replace function public.delete_old_leaderboard_country_daily()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.leaderboard_country_daily
  where period_date < current_date - interval '90 days';

  delete from public.leaderboard_country_daily_v2
  where period_date < current_date - interval '90 days';

  delete from public.leaderboard_session_receipts
  where submitted_at < now() - interval '7 days';
$$;

revoke all on function public.delete_old_leaderboard_country_daily() from public;
