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

create index if not exists leaderboard_country_daily_rank_idx
  on public.leaderboard_country_daily (period_date, total_score desc, submission_count desc);

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

create or replace function public.delete_old_leaderboard_country_daily()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.leaderboard_country_daily
  where period_date < current_date - interval '90 days';
$$;
