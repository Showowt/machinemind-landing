-- Free-website funnel — WhatsApp automation, payments and referral credits.
-- Project: elflfrdutbvkzqylaazw
--
-- Additive only. The site is the ledger for the dedicated funnel line
-- (+1 786-257-0284): every template the scheduler sends, every inbound /
-- outbound message Rewired OS relays over the bridge, and every delivery status
-- lands in web_gratis_messages. One row per (signup, template) is the
-- idempotency guarantee — a template can never be sent twice to the same
-- signup, no matter how many cron runs overlap. Stripe events are claimed by id
-- before they're processed. Server routes use the service role only; anon and
-- authenticated have no access to anything here.

-- ─── Signup columns ─────────────────────────────────────────────────────────

alter table public.web_gratis_signups
  add column if not exists whatsapp_consent_version text
    check (char_length(whatsapp_consent_version) <= 60),
  add column if not exists last_inbound_at timestamptz,
  add column if not exists opted_out_at timestamptz,
  add column if not exists opt_out_reason text check (char_length(opt_out_reason) <= 200),
  add column if not exists no_whatsapp_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists recontact_after date,
  add column if not exists paid_via text check (paid_via in ('stripe','paypal','manual')),
  add column if not exists stripe_customer_id text check (char_length(stripe_customer_id) <= 120),
  add column if not exists stripe_subscription_id text check (char_length(stripe_subscription_id) <= 120),
  add column if not exists referred_by_text text check (char_length(referred_by_text) <= 120),
  add column if not exists rung2_interest_at timestamptz,
  add column if not exists share_confirmed_at timestamptz,
  add column if not exists handoff_at timestamptz,
  add column if not exists handoff_kind text
    check (handoff_kind in ('handoff_hot','handoff_help','call_request')),
  add column if not exists wants_changes_at timestamptz,
  add column if not exists declined_at timestamptz;

create index if not exists web_gratis_stripe_sub_idx
  on public.web_gratis_signups (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists web_gratis_stripe_customer_idx
  on public.web_gratis_signups (stripe_customer_id) where stripe_customer_id is not null;

-- ─── Settings: demo + PayPal links ──────────────────────────────────────────

alter table public.web_gratis_settings
  add column if not exists demo_link text check (demo_link is null or demo_link ~ '^https://'),
  add column if not exists paypal_link text default 'https://paypal.me/MachineMind/20USD'
    check (paypal_link is null or paypal_link ~ '^https://');

update public.web_gratis_settings
   set paypal_link = 'https://paypal.me/MachineMind/20USD'
 where id = 1 and paypal_link is null;

-- ─── Message ledger ─────────────────────────────────────────────────────────

create table if not exists public.web_gratis_messages (
  id bigint generated always as identity primary key,
  -- null only for an inbound/outbound on the funnel line from a phone with no signup
  signup_id uuid references public.web_gratis_signups(id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  direction text not null check (direction in ('inbound','outbound')),
  template text check (template in (
    'cqv_web_confirm','cqv_web_ready','cqv_web_day28','cqv_web_day30','cqv_web_pause_notice','cqv_web_rescue'
  )),
  source text not null check (source in ('scheduler','admin','responder','stripe','inbound')),
  msg_type text check (msg_type in ('text','button','interactive','image','document','audio','other')),
  body text check (char_length(body) <= 4000),
  media_path text check (char_length(media_path) <= 300),
  wa_message_id text unique check (char_length(wa_message_id) <= 200),
  status text not null check (status in ('queued','sent','delivered','read','failed','skipped','received')),
  attempts integer not null default 0 check (attempts between 0 and 50),
  idempotency_key text check (char_length(idempotency_key) <= 200),
  next_attempt_at timestamptz,
  -- lease: a sender owns the row until this time (crashed sender → reclaimed)
  locked_until timestamptz,
  scheduled_for timestamptz,
  received_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  last_error_code text check (char_length(last_error_code) <= 60),
  last_error text check (char_length(last_error) <= 1000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Templates are outbound business-initiated sends tied to a signup.
  constraint web_gratis_messages_template_shape
    check (template is null or (direction = 'outbound' and signup_id is not null)),
  constraint web_gratis_messages_inbound_shape
    check (direction <> 'inbound' or (template is null and status = 'received')),
  constraint web_gratis_messages_received_inbound_only
    check (status <> 'received' or direction = 'inbound')
);

-- The idempotency guarantee: one row per template per signup, ever.
create unique index if not exists web_gratis_messages_one_template
  on public.web_gratis_messages (signup_id, template) where template is not null;
create index if not exists web_gratis_messages_retry_idx
  on public.web_gratis_messages (next_attempt_at) where status = 'queued';
create index if not exists web_gratis_messages_signup_idx
  on public.web_gratis_messages (signup_id, created_at desc);
create index if not exists web_gratis_messages_phone_idx
  on public.web_gratis_messages (phone, created_at desc);

drop trigger if exists web_gratis_messages_updated_at on public.web_gratis_messages;
create trigger web_gratis_messages_updated_at
  before update on public.web_gratis_messages
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_messages enable row level security;
revoke all on public.web_gratis_messages from anon, authenticated;

-- ─── Referral credits (1 free month per referred business that pays) ────────

create table if not exists public.web_gratis_referral_credits (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references public.web_gratis_signups(id) on delete cascade,
  referred_id uuid not null unique references public.web_gratis_signups(id) on delete cascade,
  months smallint not null default 1 check (months between 1 and 12),
  applied_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_gratis_referral_credit_not_self check (referrer_id <> referred_id)
);

create index if not exists web_gratis_referral_credits_referrer_idx
  on public.web_gratis_referral_credits (referrer_id);

drop trigger if exists web_gratis_referral_credits_updated_at on public.web_gratis_referral_credits;
create trigger web_gratis_referral_credits_updated_at
  before update on public.web_gratis_referral_credits
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_referral_credits enable row level security;
revoke all on public.web_gratis_referral_credits from anon, authenticated;

-- ─── Stripe events already handled (webhook idempotency) ────────────────────

create table if not exists public.web_gratis_stripe_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9_]{1,200}$'),
  type text not null check (char_length(type) <= 100),
  status text not null default 'processing' check (status in ('processing','processed','ignored','failed')),
  signup_id uuid references public.web_gratis_signups(id) on delete set null,
  last_error text check (char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists web_gratis_stripe_events_updated_at on public.web_gratis_stripe_events;
create trigger web_gratis_stripe_events_updated_at
  before update on public.web_gratis_stripe_events
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_stripe_events enable row level security;
revoke all on public.web_gratis_stripe_events from anon, authenticated;

-- ─── Attach a WhatsApp photo/logo to a request (atomic append, capped) ──────

create or replace function public.web_gratis_attach_media(p_signup_id uuid, p_kind text, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  photos text[];
  logos text[];
begin
  if p_kind not in ('photo','logo') then
    raise exception 'web_gratis_attach_media: bad kind %', p_kind;
  end if;
  select photo_paths, logo_paths into photos, logos
    from public.web_gratis_signups
   where id = p_signup_id
   for update;
  if not found then
    return 'not_found';
  end if;
  if p_kind = 'photo' then
    if p_path = any(photos) then return 'duplicate'; end if;
    if cardinality(photos) >= 12 then return 'full'; end if;
    update public.web_gratis_signups set photo_paths = photo_paths || p_path where id = p_signup_id;
  else
    if p_path = any(logos) then return 'duplicate'; end if;
    if cardinality(logos) >= 4 then return 'full'; end if;
    update public.web_gratis_signups set logo_paths = logo_paths || p_path where id = p_signup_id;
  end if;
  return 'attached';
end;
$$;

revoke all on function public.web_gratis_attach_media(uuid, text, text) from public, anon, authenticated;
grant execute on function public.web_gratis_attach_media(uuid, text, text) to service_role;

-- ─── Scheduler view: signups that can still receive a template ──────────────
-- `templates` = every template that already has a row (any status), so a
-- trigger query can exclude "already handled" with one containment filter.
-- `last_template_at` = latest template activity that counts toward the
-- anti-spam gap (queued or sent; failed/skipped rows don't count).
-- confirmed_at / last_touch_* expose what the team already did by hand.

create or replace view public.web_gratis_wa_state
with (security_invoker = true) as
select
  s.id,
  s.status,
  s.business_name,
  s.whatsapp,
  s.referral_code,
  s.lang,
  s.site_url,
  s.submitted_at,
  s.delivered_at,
  s.free_until,
  s.activated_at,
  s.paused_at,
  s.opted_out_at,
  s.no_whatsapp_at,
  s.last_inbound_at,
  s.rung2_interest_at,
  s.declined_at,
  coalesce(array_agg(m.template) filter (where m.template is not null), '{}'::text[]) as templates,
  max(coalesce(m.sent_at, m.scheduled_for, m.created_at))
    filter (where m.template is not null and m.status in ('queued','sent','delivered','read')) as last_template_at,
  -- manual actions on the ops board (so the scheduler never repeats them)
  s.confirmed_at,
  s.last_touch_kind,
  s.last_touch_at
from public.web_gratis_signups s
left join public.web_gratis_messages m
  on m.signup_id = s.id and m.template is not null
where s.status in ('nuevo','en_construccion','entregada','compartida','pausada')
group by s.id;

revoke all on public.web_gratis_wa_state from anon, authenticated;

-- ─── Board stats: + WhatsApp automation + credits ───────────────────────────

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
         limit 5) x), '[]'::jsonb),
    'wa_queued', (select count(*) from public.web_gratis_messages where status = 'queued'),
    'wa_sent_today', (select count(*) from public.web_gratis_messages, bounds
                       where template is not null and sent_at >= bounds.today_sv),
    'wa_failed_24h', (select count(*) from public.web_gratis_messages
                       where direction = 'outbound' and status = 'failed' and updated_at >= now() - interval '24 hours'),
    'wa_inbound_today', (select count(*) from public.web_gratis_messages, bounds
                          where direction = 'inbound' and created_at >= bounds.today_sv),
    'opted_out', (select count(*) from public.web_gratis_signups where opted_out_at is not null),
    'no_whatsapp', (select count(*) from public.web_gratis_signups where no_whatsapp_at is not null),
    'credits_pending', (select count(*) from public.web_gratis_referral_credits where applied_at is null)
  );
$$;

revoke all on function public.web_gratis_board_stats() from public, anon, authenticated;
grant execute on function public.web_gratis_board_stats() to service_role;
