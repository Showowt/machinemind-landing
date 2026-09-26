-- Free-website funnel — billing: renewal cycles, payments ledger, Stripe state.
-- Project: elflfrdutbvkzqylaazw. Additive (one index replaced by a strictly
-- equivalent one for every existing row, one CHECK widened, one view's join
-- narrowed to the rows it always meant).
--
-- 1. Renewal cycles. PayPal / manual payers pay one month at a time
--    (paid_through). Their renewal asks (cqv_web_renewal, and the existing
--    cqv_web_pause_notice) go out once PER CYCLE, where the cycle is the
--    paid_through date the ask is about. The idempotency guarantee becomes one
--    row per (signup, template, cycle) with NULLS NOT DISTINCT, so every row
--    without a cycle (the free month, confirmations, rescue…) keeps exactly the
--    old rule — one row per template per signup, ever — and "Pagó otro mes"
--    (a new paid_through) opens a new cycle automatically.
--
-- 2. Payments ledger (web_gratis_payments): one row per payment received, the
--    source of the team's "💰 PAGO RECIBIDO" alert (alerted_at) and of the daily
--    "💳 COBROS" digest's "pagos recibidos ayer". Stripe payments are written by
--    the webhook (external_id = Stripe event / invoice id, idempotent). Board
--    payments (→ Activa, a paused client re-activated, «Pagó otro mes») are
--    recorded by a trigger on web_gratis_signups, whichever code path makes
--    them — applying a referral credit (paid_through moves, nothing is paid) is
--    deliberately NOT a payment.
--
-- 3. Stripe subscription state on the signup (billing_issue): a failed monthly
--    charge or a cancelled subscription is visible on the board and in the
--    billing timeline until a payment clears it. last_payment_at = latest
--    payment of any kind.

-- ─── 1. Renewal cycles on the message ledger ────────────────────────────────

alter table public.web_gratis_messages
  add column if not exists cycle date;

alter table public.web_gratis_messages
  drop constraint if exists web_gratis_messages_template_check;
alter table public.web_gratis_messages
  add constraint web_gratis_messages_template_check check (template in (
    'cqv_web_confirm','cqv_web_ready','cqv_web_day28','cqv_web_day30','cqv_web_pause_notice','cqv_web_rescue',
    'cqv_web_renewal'
  ));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'web_gratis_messages_cycle_shape') then
    alter table public.web_gratis_messages
      add constraint web_gratis_messages_cycle_shape
      check (cycle is null or template in ('cqv_web_renewal','cqv_web_pause_notice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'web_gratis_messages_renewal_has_cycle') then
    alter table public.web_gratis_messages
      add constraint web_gratis_messages_renewal_has_cycle
      check (template is distinct from 'cqv_web_renewal' or cycle is not null);
  end if;
end $$;

-- The idempotency guarantee: one row per template per signup per cycle (no cycle = once ever).
create unique index if not exists web_gratis_messages_one_template_per_cycle
  on public.web_gratis_messages (signup_id, template, cycle) nulls not distinct
  where template is not null;
drop index if exists public.web_gratis_messages_one_template;

create index if not exists web_gratis_messages_cycle_idx
  on public.web_gratis_messages (signup_id, cycle) where cycle is not null;

-- The scheduler view's `templates` / `last_template_at` describe the free-month /
-- one-off flow only (renewal cycles are tracked per cycle by the scheduler).
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
  s.confirmed_at,
  s.last_touch_kind,
  s.last_touch_at
from public.web_gratis_signups s
left join public.web_gratis_messages m
  on m.signup_id = s.id and m.template is not null and m.cycle is null
where s.status in ('nuevo','en_construccion','entregada','compartida','pausada')
group by s.id;

revoke all on public.web_gratis_wa_state from anon, authenticated;

-- ─── 3. Payment state on the signup ─────────────────────────────────────────

alter table public.web_gratis_signups
  add column if not exists last_payment_at timestamptz,
  add column if not exists billing_issue text
    check (billing_issue in ('payment_failed','subscription_canceled')),
  add column if not exists billing_issue_at timestamptz;

-- ─── 2. Payments ledger ─────────────────────────────────────────────────────

create table if not exists public.web_gratis_payments (
  id bigint generated always as identity primary key,
  signup_id uuid not null references public.web_gratis_signups(id) on delete cascade,
  paid_at timestamptz not null default now(),
  via text not null check (via in ('stripe','paypal','manual')),
  -- first = the site's first payment; reactivation = a paused/closed client paid again;
  -- renewal = another month for a client already paying.
  kind text not null check (kind in ('first','reactivation','renewal')),
  -- null = the plan price (MONTHLY_PRICE_USD); Stripe rows carry what was charged.
  amount_cents integer check (amount_cents between 0 and 10000000),
  currency text check (currency ~ '^[a-z]{3}$'),
  paid_through date,
  source text not null check (source in ('stripe_checkout','stripe_invoice','board')),
  external_id text unique check (char_length(external_id) <= 200),
  -- the team's "💰 PAGO RECIBIDO" alert was queued
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_gratis_payments_paid_at_idx on public.web_gratis_payments (paid_at desc);
create index if not exists web_gratis_payments_signup_idx on public.web_gratis_payments (signup_id, paid_at desc);
create index if not exists web_gratis_payments_unalerted_idx on public.web_gratis_payments (id) where alerted_at is null;

drop trigger if exists web_gratis_payments_updated_at on public.web_gratis_payments;
create trigger web_gratis_payments_updated_at
  before update on public.web_gratis_payments
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_payments enable row level security;
revoke all on public.web_gratis_payments from anon, authenticated;

-- Board payments (PayPal / cash), whichever route writes them:
--   first        — activated_at goes from empty to set;
--   reactivation — a paused / cancelled / discarded payer becomes 'activa' again;
--   renewal      — «Pagó otro mes»: paid_through moves forward AND the row is touched
--                  as a monthly payment (last_touch_kind 'pago_mes', a new last_touch_at).
-- Stripe payments are recorded by the webhook (paid_via 'stripe' is skipped here).
create or replace function public.web_gratis_record_board_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if new.paid_via is null or new.paid_via not in ('paypal','manual') then
    return new;
  end if;
  if old.activated_at is null and new.activated_at is not null then
    k := 'first';
  elsif new.status = 'activa' and old.status in ('pausada','cancelada','descartada') and old.activated_at is not null then
    k := 'reactivation';
  elsif new.paid_through is not null
        and new.paid_through > coalesce(old.paid_through, '-infinity'::date)
        and new.last_touch_kind = 'pago_mes'
        and new.last_touch_at is distinct from old.last_touch_at then
    k := 'renewal';
  else
    return new;
  end if;
  new.last_payment_at := now();
  new.billing_issue := null;
  new.billing_issue_at := null;
  insert into public.web_gratis_payments (signup_id, paid_at, via, kind, paid_through, source)
  values (new.id, now(), new.paid_via, k, new.paid_through, 'board');
  return new;
end;
$$;

revoke all on function public.web_gratis_record_board_payment() from public, anon, authenticated;

drop trigger if exists web_gratis_signups_board_payment on public.web_gratis_signups;
create trigger web_gratis_signups_board_payment
  before update on public.web_gratis_signups
  for each row execute function public.web_gratis_record_board_payment();

-- History: payments made before the ledger existed (never re-alerted).
insert into public.web_gratis_payments (signup_id, paid_at, via, kind, paid_through, source, alerted_at)
select s.id, s.activated_at, s.paid_via, 'first', s.paid_through,
       case when s.paid_via = 'stripe' then 'stripe_checkout' else 'board' end,
       now()
  from public.web_gratis_signups s
 where s.activated_at is not null
   and s.paid_via is not null
   and s.business_name not like 'ZZ %'
   and not exists (select 1 from public.web_gratis_payments p where p.signup_id = s.id);

update public.web_gratis_signups
   set last_payment_at = activated_at
 where activated_at is not null and last_payment_at is null and business_name not like 'ZZ %';
