-- REVIEW ONLY. Never auto-run. No credential lookup, role creation, GRANT, cron or send.
-- Apply only through the authorized migration owner after isolated PostgreSQL validation.
BEGIN;
CREATE SCHEMA billing_private;
CREATE TABLE billing_private.records (
 record_key text PRIMARY KEY, program text NOT NULL CHECK(program IN ('web_gratis_fixed_v1','simmerdown_october2026_v1')),
 account_id text NOT NULL CHECK(account_id='acct_1QvaObIS8EYk0ASL'), livemode boolean NOT NULL,
 owner_id text NOT NULL, tenant_id text NOT NULL, signup_id uuid REFERENCES public.web_gratis_signups(id) ON DELETE RESTRICT,
 site_id uuid REFERENCES public.web_gratis_sites(id) ON DELETE RESTRICT, client_id text, billing_period text,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0), state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((program='web_gratis_fixed_v1' AND signup_id IS NOT NULL AND site_id IS NOT NULL AND billing_period IS NULL)
 OR (program='simmerdown_october2026_v1' AND client_id IS NOT NULL AND billing_period='2026-10' AND signup_id IS NULL AND site_id IS NULL))
);
CREATE UNIQUE INDEX website_identity ON billing_private.records(account_id,livemode,site_id) WHERE program='web_gratis_fixed_v1';
CREATE UNIQUE INDEX simmer_period ON billing_private.records(account_id,livemode,client_id,billing_period) WHERE program='simmerdown_october2026_v1';
CREATE TABLE billing_private.identity_bindings (
 record_key text NOT NULL REFERENCES billing_private.records(record_key), role text NOT NULL CHECK(role IN ('client','operator')),
 issuer text NOT NULL, subject text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), verified_by text NOT NULL,
 evidence_ref text NOT NULL, revoked_at timestamptz, PRIMARY KEY(record_key,role,issuer,subject)
);
CREATE TABLE billing_private.customer_bindings (
 account_id text NOT NULL, livemode boolean NOT NULL, customer_id text NOT NULL, owner_id text NOT NULL,
 tenant_id text NOT NULL, client_id text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), evidence_ref text NOT NULL,
 PRIMARY KEY(account_id,livemode,customer_id)
);
CREATE TABLE billing_private.attempts (
 attempt_id text PRIMARY KEY, record_key text NOT NULL REFERENCES billing_private.records(record_key), generation integer,
 kind text NOT NULL CHECK(kind IN ('trial','charge_now','combined','recurring_only')), request_json text NOT NULL,
 request_sha256 char(64) NOT NULL, created_at_epoch bigint NOT NULL, expires_at_epoch bigint NOT NULL,
 submit_before_epoch bigint NOT NULL, status text NOT NULL CHECK(status IN ('creating','open','complete','expired')),
 session_id text, url text, CHECK(expires_at_epoch>created_at_epoch), CHECK(submit_before_epoch=expires_at_epoch-2700)
);
CREATE UNIQUE INDEX attempt_generation ON billing_private.attempts(record_key,generation) WHERE generation IS NOT NULL;
CREATE UNIQUE INDEX current_attempt ON billing_private.attempts(record_key) WHERE status IN ('creating','open','complete');
CREATE TABLE billing_private.provider_objects (
 account_id text NOT NULL, livemode boolean NOT NULL, object_kind text NOT NULL CHECK(object_kind IN ('session','subscription','invoice','payment_intent')),
 object_id text NOT NULL, record_key text NOT NULL REFERENCES billing_private.records(record_key),
 attempt_id text REFERENCES billing_private.attempts(attempt_id), evidence_digest char(64) NOT NULL,
 PRIMARY KEY(account_id,livemode,object_kind,object_id)
);
CREATE TABLE billing_private.webhook_events (
 account_id text NOT NULL, livemode boolean NOT NULL, event_id text NOT NULL, body_sha256 char(64) NOT NULL,
 record_key text NOT NULL REFERENCES billing_private.records(record_key), event_type text NOT NULL,
 provider_created_epoch bigint NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,livemode,event_id)
);
CREATE TABLE billing_private.payments (
 account_id text NOT NULL, livemode boolean NOT NULL, payment_key text NOT NULL,
 record_key text NOT NULL REFERENCES billing_private.records(record_key), invoice_id text, payment_intent_id text, session_id text NOT NULL,
 source text NOT NULL CHECK(source IN ('subscription_invoice','one_time_link')), billing_period text,
 cents integer NOT NULL CHECK(cents>0), currency text NOT NULL CHECK(currency='usd'), paid_at_epoch bigint NOT NULL,
 service_period_end_epoch bigint, receipt_digest char(64) NOT NULL, PRIMARY KEY(account_id,livemode,payment_key),
 CHECK(invoice_id IS NOT NULL OR payment_intent_id IS NOT NULL)
);
CREATE UNIQUE INDEX invoice_once ON billing_private.payments(account_id,livemode,invoice_id) WHERE invoice_id IS NOT NULL;
CREATE UNIQUE INDEX intent_once ON billing_private.payments(account_id,livemode,payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX october_once ON billing_private.payments(record_key,billing_period) WHERE billing_period='2026-10';
CREATE TABLE billing_private.audit (
 record_key text NOT NULL REFERENCES billing_private.records(record_key), sequence bigint NOT NULL,
 at_epoch bigint NOT NULL, kind text NOT NULL, actor_subject text NOT NULL, evidence_ref text NOT NULL, correlation_id text NOT NULL,
 PRIMARY KEY(record_key,sequence)
);
CREATE TABLE billing_private.reminder_outbox (
 record_key text NOT NULL REFERENCES billing_private.records(record_key), go_live_epoch bigint NOT NULL,
 day smallint NOT NULL CHECK(day IN (15,20)), due_epoch bigint NOT NULL, window_end_epoch bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('drafted','held','dispatching','sent','failed','suppressed')),
 template_revision text NOT NULL, link_generation integer NOT NULL, provider_message_id text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(record_key,go_live_epoch,day), CHECK(due_epoch=go_live_epoch+day*86400), CHECK(window_end_epoch=due_epoch+86400)
);
CREATE FUNCTION billing_private.enforce_record_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(OLD.record_key,OLD.program,OLD.account_id,OLD.livemode,OLD.owner_id,OLD.tenant_id,OLD.signup_id,OLD.site_id,OLD.client_id,OLD.billing_period)
 IS DISTINCT FROM ROW(NEW.record_key,NEW.program,NEW.account_id,NEW.livemode,NEW.owner_id,NEW.tenant_id,NEW.signup_id,NEW.site_id,NEW.client_id,NEW.billing_period) THEN RAISE EXCEPTION 'billing identity immutable'; END IF;
 IF NEW.program='web_gratis_fixed_v1' THEN
  IF NOT EXISTS(SELECT 1 FROM public.web_gratis_sites WHERE id=NEW.site_id AND signup_id=NEW.signup_id) THEN RAISE EXCEPTION 'site binding mismatch'; END IF;
  IF NEW.state->>'ownerId' IS DISTINCT FROM NEW.owner_id OR NEW.state->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR NEW.state->>'siteId' IS DISTINCT FROM NEW.site_id::text OR NEW.state->>'signupId' IS DISTINCT FROM NEW.signup_id::text THEN RAISE EXCEPTION 'state binding mismatch'; END IF;
  IF NEW.state->>'goLiveAt' IS NOT NULL THEN
   IF NEW.state->>'trialEnd' IS NULL OR (NEW.state->>'trialEnd')::bigint<>(NEW.state->>'goLiveAt')::bigint+2592000
    OR NEW.state->'acceptance'->>'at' IS NULL OR NEW.state->'approval'->>'at' IS NULL
    OR (NEW.state->'acceptance'->>'at')::bigint>(NEW.state->>'goLiveAt')::bigint
    OR (NEW.state->'approval'->>'at')::bigint>(NEW.state->>'goLiveAt')::bigint THEN RAISE EXCEPTION 'fixed deadline invalid'; END IF;
  ELSIF NEW.state->>'trialEnd' IS NOT NULL THEN RAISE EXCEPTION 'trial without publication'; END IF;
  IF TG_OP='UPDATE' AND OLD.state->>'goLiveAt' IS NOT NULL AND
    (OLD.state - ARRAY['attempts','link','withdrawnAt','messaging','subscriptionId','customerId','enrollment','paymentMethodReady','cancelAtPeriodEnd','paidThrough','invoices','events','reminders','audit'])
    IS DISTINCT FROM (NEW.state - ARRAY['attempts','link','withdrawnAt','messaging','subscriptionId','customerId','enrollment','paymentMethodReady','cancelAtPeriodEnd','paidThrough','invoices','events','reminders','audit']) THEN RAISE EXCEPTION 'agreement immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_binding BEFORE INSERT OR UPDATE ON billing_private.records FOR EACH ROW EXECUTE FUNCTION billing_private.enforce_record_binding();
CREATE FUNCTION billing_private.enforce_attempt_immutability() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.attempt_id,NEW.record_key,NEW.generation,NEW.kind,NEW.request_json,NEW.request_sha256,NEW.created_at_epoch,NEW.expires_at_epoch,NEW.submit_before_epoch)
 IS DISTINCT FROM ROW(OLD.attempt_id,OLD.record_key,OLD.generation,OLD.kind,OLD.request_json,OLD.request_sha256,OLD.created_at_epoch,OLD.expires_at_epoch,OLD.submit_before_epoch) THEN RAISE EXCEPTION 'request immutable'; END IF;
 IF OLD.session_id IS NOT NULL AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN RAISE EXCEPTION 'session immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attempt_frozen BEFORE UPDATE ON billing_private.attempts FOR EACH ROW EXECUTE FUNCTION billing_private.enforce_attempt_immutability();
CREATE FUNCTION billing_private.reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'append only billing ledger'; END $$;
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON billing_private.webhook_events FOR EACH ROW EXECUTE FUNCTION billing_private.reject_ledger_mutation();
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON billing_private.payments FOR EACH ROW EXECUTE FUNCTION billing_private.reject_ledger_mutation();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON billing_private.audit FOR EACH ROW EXECUTE FUNCTION billing_private.reject_ledger_mutation();
CREATE TRIGGER provider_owner_immutable BEFORE UPDATE OR DELETE ON billing_private.provider_objects FOR EACH ROW EXECUTE FUNCTION billing_private.reject_ledger_mutation();
-- No public grants. Migration owner must separately review exact existing runtime privileges.
COMMIT;
