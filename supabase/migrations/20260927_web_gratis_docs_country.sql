-- Web gratis — El Salvador + Colombia, documents, richer business info, $19/mes (2026-09-24).
--
-- Additive only. Applied before the code that uses it; the live code ignores the new columns.
--   • country            'SV' | 'CO' | 'OTHER' — which market the business is in (copy, validation, alerts)
--   • document_paths     menus, price lists, catalogs, brochures (bucket web-gratis, like photo_paths)
--   • existing_website   a site they already have — we offer to update it for free
--   • address            street address / Google Maps link for the site's location block
--   • contact_email      optional public email for the site
--   • extra_notes        "¿Algo más que debamos saber?"
--   • bucket web-gratis  accepts Office/text documents and logo design files; 25 MB per file
--   • PayPal fallback link $20 → $19

alter table public.web_gratis_signups
  add column if not exists country text,
  add column if not exists document_paths text[] not null default '{}',
  add column if not exists existing_website text,
  add column if not exists address text,
  add column if not exists contact_email text,
  add column if not exists extra_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'web_gratis_signups_country_check'
  ) then
    alter table public.web_gratis_signups
      add constraint web_gratis_signups_country_check
      check (country is null or country in ('SV', 'CO', 'OTHER'));
  end if;
end $$;

-- Backfill country from the WhatsApp number for any existing rows.
update public.web_gratis_signups
set country = case
  when whatsapp like '+503%' then 'SV'
  when whatsapp like '+57%' then 'CO'
  else 'OTHER'
end
where country is null and whatsapp is not null;

create index if not exists web_gratis_signups_country_idx on public.web_gratis_signups (country);

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
      'image/svg+xml', 'image/vnd.adobe.photoshop', 'application/postscript', 'application/illustrator',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/plain', 'text/csv'
    ]
where id = 'web-gratis';

update public.web_gratis_settings
set paypal_link = 'https://paypal.me/MachineMind/19USD', updated_at = now()
where paypal_link = 'https://paypal.me/MachineMind/20USD';
