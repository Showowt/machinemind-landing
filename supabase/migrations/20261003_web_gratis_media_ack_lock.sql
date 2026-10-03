-- One acknowledgment per media burst (2026-10-03).
--
-- A client who sends several photos at once produces several inbound webhooks
-- that Vercel runs as PARALLEL lambdas. Each read the conversation history
-- before the others had written their ack, so the history-based dedupe
-- (laterInMediaBurst / sentRecently) missed and every photo drew its own
-- "¡Recibida!" — JAhandmade got the same line 8× in 3 seconds. The only
-- race-proof guard is an atomic claim in the database, where the parallel
-- inbound handlers serialize.
--
-- claim_media_ack(key, window) inserts one row per (key, time-bucket); the
-- unique PK means exactly one concurrent caller wins a bucket. The winner acks,
-- the rest stay silent. `key` is the signup id when known, else the phone, so
-- it also covers bursts from numbers with no signup yet.

create table if not exists public.web_gratis_media_ack (
  key text not null,
  bucket bigint not null,
  created_at timestamptz not null default now(),
  primary key (key, bucket)
);

create index if not exists web_gratis_media_ack_created_idx on public.web_gratis_media_ack (created_at);

alter table public.web_gratis_media_ack enable row level security;
revoke all on public.web_gratis_media_ack from anon, authenticated;

-- Returns true only for the FIRST caller in this key's current time bucket.
create or replace function public.web_gratis_claim_media_ack(p_key text, p_window_sec integer default 120)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  b bigint := floor(extract(epoch from now()) / greatest(p_window_sec, 30))::bigint;
begin
  insert into public.web_gratis_media_ack (key, bucket)
  values (p_key, b)
  on conflict (key, bucket) do nothing;
  get diagnostics n = row_count;
  -- Keep the table tiny: drop this key's old buckets.
  delete from public.web_gratis_media_ack where key = p_key and bucket < b - 5;
  return n > 0;
end;
$$;

revoke all on function public.web_gratis_claim_media_ack(text, integer) from public, anon, authenticated;
grant execute on function public.web_gratis_claim_media_ack(text, integer) to service_role;
