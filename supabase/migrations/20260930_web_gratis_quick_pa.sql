-- Web gratis — number-only quick capture + Panamá + Fernanda's shift (2026-09-30).
--
-- Phil's pivot: the /web page now captures ONLY the WhatsApp number. Fernanda
-- calls the moment it arrives (9:00–18:00 El Salvador, Mon–Sat, editable on the
-- board); outside her shift the funnel line's responder holds the conversation.
-- The business fields arrive later — her call, WhatsApp, or the team form
-- (/web?form=full&draft=<id>) — into the SAME row, so nothing is duplicated.
-- Panamá opens alongside El Salvador.

-- 1) Number-only rows: business fields become nullable; quick_capture_at marks
--    a row born from the quick form. Their length CHECKs pass NULL untouched.
alter table public.web_gratis_signups
  alter column business_name drop not null,
  alter column business_type drop not null,
  alter column city drop not null,
  add column if not exists quick_capture_at timestamptz;

-- A promoted (non-borrador) row must still be complete — now explicitly
-- including the fields that used to be NOT NULL. 'descartada' is exempt too:
-- a dead draft (bad number, asked not to be called) is discarded as-is.
alter table public.web_gratis_signups drop constraint if exists web_gratis_submitted_complete;
alter table public.web_gratis_signups add constraint web_gratis_submitted_complete
  check (status in ('borrador', 'descartada') or (
    submitted_at is not null
    and terms_accepted_at is not null
    and share_commitment_at is not null
    and cardinality(services) >= 1
    and business_name is not null
    and business_type is not null
    and city is not null
  ));

-- "Por llamar" board view: quick captures still waiting as borrador.
create index if not exists web_gratis_quick_pending_idx
  on public.web_gratis_signups (quick_capture_at desc)
  where status = 'borrador' and quick_capture_at is not null;

-- 2) Panamá is a market of its own (was recorded as OTHER).
alter table public.web_gratis_signups drop constraint if exists web_gratis_signups_country_check;
alter table public.web_gratis_signups add constraint web_gratis_signups_country_check
  check (country is null or country in ('SV', 'CO', 'PA', 'OTHER'));

update public.web_gratis_signups
set country = 'PA'
where whatsapp like '+507%' and (country is null or country = 'OTHER');

-- 3) Fernanda's shift, on the El Salvador clock (editable from the board).
--    agent_days: ISO weekday digits, 1=Monday … 7=Sunday.
alter table public.web_gratis_settings
  add column if not exists agent_start_hour smallint not null default 9
    check (agent_start_hour between 0 and 23),
  add column if not exists agent_end_hour smallint not null default 18
    check (agent_end_hour between 1 and 24),
  add column if not exists agent_days text not null default '123456'
    check (agent_days ~ '^[1-7]{1,7}$');

-- 4) Follow-up discipline (Fernanda): every lead being worked carries its next
--    action. The board surfaces overdue ones first; the 9am digest lists them.
alter table public.web_gratis_signups
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists follow_up_note text check (follow_up_note is null or char_length(follow_up_note) <= 300),
  add column if not exists call_attempts smallint not null default 0 check (call_attempts >= 0),
  add column if not exists last_call_outcome text
    check (last_call_outcome is null or last_call_outcome in ('contestada', 'no_contesto', 'numero_malo'));

create index if not exists web_gratis_follow_up_idx
  on public.web_gratis_signups (next_follow_up_at)
  where next_follow_up_at is not null;

-- 5) Quick captures are not "abandoned forms": they already fired their
--    call-now alert and live in the board's "Por llamar" view.
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
     and s.quick_capture_at is null
     and s.updated_at < now() - make_interval(mins => greatest(p_idle_minutes, 5))
     and s.created_at > now() - interval '3 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 6) board stats: + por_llamar (quick captures waiting for their call) and
--    Fernanda's follow-up queue (overdue / due today, SV clock).
create or replace function public.web_gratis_board_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('day', now() at time zone 'America/El_Salvador') at time zone 'America/El_Salvador') as today_sv,
           (now() at time zone 'America/El_Salvador')::date as today_date
  )
  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(status, n)
        from (select status, count(*) as n from public.web_gratis_signups group by status) t), '{}'::jsonb),
    'por_llamar', (select count(*) from public.web_gratis_signups
                    where status = 'borrador' and quick_capture_at is not null),
    'seguimientos_vencidos', (select count(*) from public.web_gratis_signups
                               where next_follow_up_at is not null and next_follow_up_at < now()
                                 and status not in ('pausada', 'cancelada', 'descartada')),
    'seguimientos_hoy', (select count(*) from public.web_gratis_signups, bounds
                          where next_follow_up_at is not null
                            and next_follow_up_at >= now()
                            and next_follow_up_at < bounds.today_sv + interval '1 day'
                            and status not in ('pausada', 'cancelada', 'descartada')),
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
    'credits_pending', (select count(*) from public.web_gratis_referral_credits where applied_at is null),
    'renewals_due', (select count(*) from public.web_gratis_signups, bounds
                      where status = 'activa' and paid_via in ('paypal','manual')
                        and paid_through is not null and paid_through <= bounds.today_date + 3),
    'recontact_due', (select count(*) from public.web_gratis_signups, bounds
                       where status = 'pausada' and recontact_after is not null and recontact_after <= bounds.today_date),
    'paid_unbuilt', (select count(*) from public.web_gratis_signups
                      where status in ('nuevo','en_construccion') and activated_at is not null)
  );
$$;
revoke all on function public.web_gratis_board_stats() from public, anon, authenticated;
grant execute on function public.web_gratis_board_stats() to service_role;
