-- Free-website funnel — review fixes to the WhatsApp/payments automation.
-- Project: elflfrdutbvkzqylaazw. Additive only (one column, one function body).
--
-- paid_through: PayPal / manual payers pay one month at a time, so the board
-- needs to know until when the month is covered (Stripe renews on its own and
-- alerts on failed charges). Set on "→ Activa" by hand, extended by "Pagó otro
-- mes" and by applying a referral credit.
--
-- web_gratis_board_stats(): + renewals_due (PayPal/manual payers whose month
-- ends within 3 days or already ended), recontact_due (paused sites whose
-- 60-day re-contact date has come) and paid_unbuilt (paid before delivery,
-- still being built) for the board and the daily summary.

alter table public.web_gratis_signups
  add column if not exists paid_through date;

create index if not exists web_gratis_paid_through_idx
  on public.web_gratis_signups (paid_through) where status = 'activa' and paid_through is not null;

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
