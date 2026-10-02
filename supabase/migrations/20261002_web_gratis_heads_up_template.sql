-- Allow the cqv_web_heads_up template in the ledger (2026-10-02).
--
-- The instant "a representative will contact you within 24h — be attentive"
-- WhatsApp sent the moment a number-only quick capture comes in. The messages
-- table's template CHECK whitelists names, so it must learn the new one or the
-- inline send (sendQuickHeadsUp) fails to log and never sends.

alter table public.web_gratis_messages drop constraint if exists web_gratis_messages_template_check;
alter table public.web_gratis_messages add constraint web_gratis_messages_template_check
  check (template = any (array[
    'cqv_web_heads_up',
    'cqv_web_confirm',
    'cqv_web_ready',
    'cqv_web_day28',
    'cqv_web_day30',
    'cqv_web_pause_notice',
    'cqv_web_rescue',
    'cqv_web_renewal'
  ]::text[]));
