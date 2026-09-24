-- Free-website funnel — operations layer (outbox, sweeps, settings, board columns)
-- Project: elflfrdutbvkzqylaazw
--
-- Notifications are written to an outbox first and delivered by a drainer
-- (after each submit + a 1-minute cron). Claims use FOR UPDATE SKIP LOCKED so
-- concurrent drainers never double-send; per-channel flags mean a Telegram
-- success is never re-sent because email failed. Stale 'sending' claims are
-- reclaimed after 3 minutes (crashed function), so nothing gets stuck.

create table if not exists public.web_gratis_outbox (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique check (char_length(dedupe_key) <= 200),
  kind text not null check (kind in ('submitted','abandoned','system')),
  signup_id uuid references public.web_gratis_signups(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  telegram_done boolean not null default false,
  email_done boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text check (char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_gratis_outbox_due_idx
  on public.web_gratis_outbox (status, next_attempt_at)
  where status in ('pending','sending');
create index if not exists web_gratis_outbox_signup_idx
  on public.web_gratis_outbox (signup_id);

drop trigger if exists web_gratis_outbox_updated_at on public.web_gratis_outbox;
create trigger web_gratis_outbox_updated_at
  before update on public.web_gratis_outbox
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_outbox enable row level security;
revoke all on public.web_gratis_outbox from anon, authenticated;

-- Atomically claim due notifications (and reclaim ones stuck in 'sending').
create or replace function public.web_gratis_claim_outbox(p_limit integer default 50)
returns setof public.web_gratis_outbox
language sql
security definer
set search_path = ''
as $$
  update public.web_gratis_outbox o
     set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select i.id
       from public.web_gratis_outbox i
      where (i.status = 'pending' and i.next_attempt_at <= now())
         or (i.status = 'sending' and i.claimed_at < now() - interval '3 minutes')
      order by i.created_at
      limit greatest(1, least(p_limit, 200))
      for update skip locked
   )
  returning o.*;
$$;

-- Queue one "abandoned form" alert per draft idle longer than p_idle_minutes.
create or replace function public.web_gratis_enqueue_abandoned(p_idle_minutes integer default 20)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.web_gratis_outbox (dedupe_key, kind, signup_id)
  select 'abandoned:' || s.id, 'abandoned', s.id
    from public.web_gratis_signups s
   where s.status = 'borrador'
     and s.updated_at < now() - make_interval(mins => greatest(p_idle_minutes, 5))
     and s.created_at > now() - interval '3 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.web_gratis_claim_outbox(integer) from public, anon, authenticated;
revoke all on function public.web_gratis_enqueue_abandoned(integer) from public, anon, authenticated;
grant execute on function public.web_gratis_claim_outbox(integer) to service_role;
grant execute on function public.web_gratis_enqueue_abandoned(integer) to service_role;

-- Single-row operational settings, edited from the ops board.
create table if not exists public.web_gratis_settings (
  id smallint primary key default 1 check (id = 1),
  delivery_days smallint check (delivery_days between 1 and 60), -- null = "pocos días"
  high_demand boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.web_gratis_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists web_gratis_settings_updated_at on public.web_gratis_settings;
create trigger web_gratis_settings_updated_at
  before update on public.web_gratis_settings
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_settings enable row level security;
revoke all on public.web_gratis_settings from anon, authenticated;

-- Board tracking on each signup.
alter table public.web_gratis_signups
  add column if not exists confirmed_at timestamptz,
  add column if not exists last_touch_at timestamptz,
  add column if not exists last_touch_kind text check (char_length(last_touch_kind) <= 40);

-- Day-28/30 payment link, pasted in the ops board once it exists; used in the
-- board's prefilled WhatsApp scripts.
alter table public.web_gratis_settings
  add column if not exists pay_link text check (pay_link is null or pay_link ~ '^https://');

-- One-query stats for the ops board header + the daily Telegram summary.
create or replace function public.web_gratis_board_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('day', now() at time zone 'America/El_Salvador') at time zone 'America/El_Salvador') as today_sv
  )
  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(status, n)
        from (select status, count(*) as n from public.web_gratis_signups group by status) t), '{}'::jsonb),
    'started_today', (select count(*) from public.web_gratis_signups, bounds where created_at >= bounds.today_sv),
    'submitted_today', (select count(*) from public.web_gratis_signups, bounds where submitted_at >= bounds.today_sv),
    'started_yesterday', (select count(*) from public.web_gratis_signups, bounds
                           where created_at >= bounds.today_sv - interval '1 day' and created_at < bounds.today_sv),
    'submitted_yesterday', (select count(*) from public.web_gratis_signups, bounds
                           where submitted_at >= bounds.today_sv - interval '1 day' and submitted_at < bounds.today_sv),
    'stale_nuevo', (select count(*) from public.web_gratis_signups
                     where status = 'nuevo' and submitted_at < now() - interval '24 hours'),
    'unconfirmed_nuevo', (select count(*) from public.web_gratis_signups where status = 'nuevo' and confirmed_at is null),
    'outbox_pending', (select count(*) from public.web_gratis_outbox where status in ('pending','sending')),
    'outbox_failed', (select count(*) from public.web_gratis_outbox where status = 'failed'),
    'top_referrers', coalesce((
      select jsonb_agg(x) from (
        select r.business_name, r.referral_code, count(c.id) as n
          from public.web_gratis_signups c
          join public.web_gratis_signups r on r.id = c.referred_by_id
         where c.status <> 'borrador'
         group by r.id, r.business_name, r.referral_code
         order by count(c.id) desc
         limit 5) x), '[]'::jsonb)
  );
$$;

revoke all on function public.web_gratis_board_stats() from public, anon, authenticated;
grant execute on function public.web_gratis_board_stats() to service_role;
