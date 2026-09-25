-- Web gratis — client websites (2026-09-25).
--
-- Each submitted signup gets ONE generated website: AI-written content (SiteContentV1 JSON,
-- src/lib/web-gratis/site-content.ts) rendered by the multi-tenant `mm-sites` app at
-- https://<slug>.machinemindconsulting.com (or a custom domain later). Phil approves every
-- site before it goes live (status draft → published); publishing sets the signup's
-- site_url + delivered_at, which fires the existing "cqv_web_ready" WhatsApp.
--
-- Additive only. RLS on, no anon/authenticated access (server-side service role only).

create table if not exists public.web_gratis_sites (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null unique references public.web_gratis_signups(id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  status text not null default 'generating'
    check (status in ('generating', 'draft', 'published', 'paused', 'failed', 'archived')),
  content jsonb,
  version integer not null default 0,
  instructions text,
  preview_token text not null default replace(gen_random_uuid()::text, '-', ''),
  custom_domain text unique
    check (custom_domain is null or custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  domain_status text,
  sources jsonb not null default '{}'::jsonb,
  generation_error text,
  generation_attempts integer not null default 0,
  generation_lease_until timestamptz,
  generated_at timestamptz,
  published_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_gratis_sites_status_idx on public.web_gratis_sites (status);

drop trigger if exists web_gratis_sites_updated_at on public.web_gratis_sites;
create trigger web_gratis_sites_updated_at
  before update on public.web_gratis_sites
  for each row execute function public.web_gratis_set_updated_at();

-- Visits and contact clicks on client sites (no PII: ua_hash is a daily-salted hash).
create table if not exists public.web_gratis_site_events (
  id bigserial primary key,
  site_id uuid not null references public.web_gratis_sites(id) on delete cascade,
  kind text not null
    check (kind in ('view', 'whatsapp_click', 'call_click', 'map_click', 'social_click', 'email_click')),
  path text,
  referrer text,
  country text,
  ua_hash text,
  created_at timestamptz not null default now()
);

create index if not exists web_gratis_site_events_site_idx on public.web_gratis_site_events (site_id, created_at desc);
create index if not exists web_gratis_site_events_kind_idx on public.web_gratis_site_events (site_id, kind);

alter table public.web_gratis_sites enable row level security;
alter table public.web_gratis_site_events enable row level security;
revoke all on public.web_gratis_sites from anon, authenticated;
revoke all on public.web_gratis_site_events from anon, authenticated;

-- Public images of PUBLISHED sites (logo + chosen photos copied from the private bucket).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'web-gratis-public', 'web-gratis-public', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2026-09-25: the live cron must never alert on D5 harness rows ("ZZ …") — they share this DB.
create or replace function public.web_gratis_enqueue_abandoned(p_idle_minutes integer default 20)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  n integer;
begin
  insert into public.web_gratis_outbox (dedupe_key, kind, signup_id)
  select 'abandoned:' || s.id, 'abandoned', s.id
    from public.web_gratis_signups s
   where s.status = 'borrador'
     and s.updated_at < now() - make_interval(mins => greatest(p_idle_minutes, 5))
     and s.created_at > now() - interval '3 days'
     and s.business_name not like 'ZZ %'
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$function$;
