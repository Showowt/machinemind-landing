-- Free-website funnel (El Salvador) — machinemindconsulting.com/web
-- Project: elflfrdutbvkzqylaazw (Machine Mind Site Admin)
--
-- One row per business that starts the onboarding form. Step 1 creates the row
-- as 'borrador' (so a half-finished form is still a reachable lead); the final
-- submit flips it to 'nuevo'. Every row owns a referral_code; referred_by_id
-- builds the referral graph. Server routes use the service role only — anon and
-- authenticated have no access at all.

create table if not exists public.web_gratis_signups (
  id uuid primary key,
  status text not null default 'borrador'
    check (status in ('borrador','nuevo','en_construccion','entregada','compartida','activa','pausada','cancelada','descartada')),
  step smallint not null default 1 check (step between 1 and 3),
  lang text not null default 'es' check (lang in ('es','en')),

  business_name text not null check (char_length(btrim(business_name)) between 2 and 120),
  business_type text not null check (char_length(btrim(business_type)) between 2 and 200),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),

  services text[] not null default '{}' check (cardinality(services) <= 20),
  differentiator text check (char_length(differentiator) <= 1000),
  hours text check (char_length(hours) <= 300),
  instagram text check (char_length(instagram) <= 200),
  facebook text check (char_length(facebook) <= 300),
  style text check (char_length(style) <= 500),
  site_goal text check (site_goal in ('whatsapp','citas','mostrar')),

  logo_paths text[] not null default '{}' check (cardinality(logo_paths) <= 4),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 12),

  referral_code text not null unique check (referral_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  referred_by_id uuid references public.web_gratis_signups(id) on delete set null,
  ref_raw text check (char_length(ref_raw) <= 64),

  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  utm_term text check (char_length(utm_term) <= 200),
  fbclid text check (char_length(fbclid) <= 500),
  landing_url text check (char_length(landing_url) <= 1000),
  user_agent text check (char_length(user_agent) <= 500),
  ip_hash text check (char_length(ip_hash) <= 64),

  terms_accepted_at timestamptz,
  share_commitment_at timestamptz,
  whatsapp_consent_at timestamptz,
  submitted_at timestamptz,

  -- Ops lifecycle (filled by the team as the site is built and delivered)
  delivered_at timestamptz,
  site_url text,
  shared_at timestamptz,
  free_until date,
  activated_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint web_gratis_no_self_referral
    check (referred_by_id is null or referred_by_id <> id),
  -- A submitted request must carry the price + share acknowledgements and content.
  constraint web_gratis_submitted_complete
    check (status = 'borrador' or (
      submitted_at is not null
      and terms_accepted_at is not null
      and share_commitment_at is not null
      and cardinality(services) >= 1
    ))
);

-- One live request per business (same WhatsApp + same name). Drafts and
-- discarded/cancelled rows don't block a fresh request.
create unique index if not exists web_gratis_one_live_per_business
  on public.web_gratis_signups (whatsapp, lower(btrim(business_name)))
  where status not in ('borrador','descartada','cancelada');

create index if not exists web_gratis_status_created_idx
  on public.web_gratis_signups (status, created_at desc);
create index if not exists web_gratis_referred_by_idx
  on public.web_gratis_signups (referred_by_id) where referred_by_id is not null;
create index if not exists web_gratis_ip_created_idx
  on public.web_gratis_signups (ip_hash, created_at desc);
create index if not exists web_gratis_whatsapp_idx
  on public.web_gratis_signups (whatsapp);

create or replace function public.web_gratis_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists web_gratis_updated_at on public.web_gratis_signups;
create trigger web_gratis_updated_at
  before update on public.web_gratis_signups
  for each row execute function public.web_gratis_set_updated_at();

alter table public.web_gratis_signups enable row level security;
revoke all on public.web_gratis_signups from anon, authenticated;

-- Referral leaderboard: who brought whom, and how many of those activated.
create or replace view public.web_gratis_referral_stats
with (security_invoker = true) as
select
  r.id,
  r.business_name,
  r.whatsapp,
  r.referral_code,
  r.status,
  count(c.id) filter (where c.status <> 'borrador') as referred_submitted,
  count(c.id) filter (where c.status = 'activa') as referred_active
from public.web_gratis_signups r
left join public.web_gratis_signups c on c.referred_by_id = r.id
group by r.id;

revoke all on public.web_gratis_referral_stats from anon, authenticated;

-- Private bucket for logos + photos. Uploads happen only through signed upload
-- URLs minted server-side; no storage.objects policies are granted to clients.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'web-gratis', 'web-gratis', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
