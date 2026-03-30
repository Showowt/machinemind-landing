-- Viceroy Email Outreach — Campaign Tracking

CREATE TABLE IF NOT EXISTS viceroy_email_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES viceroy_leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  sequence_step INTEGER NOT NULL DEFAULT 1, -- 1, 2, or 3
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'opened', 'clicked', 'replied', 'unsubscribed')),
  resend_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viceroy_email_lead ON viceroy_email_sends(lead_id);
CREATE INDEX IF NOT EXISTS idx_viceroy_email_status ON viceroy_email_sends(status);
CREATE INDEX IF NOT EXISTS idx_viceroy_email_step ON viceroy_email_sends(sequence_step);
CREATE INDEX IF NOT EXISTS idx_viceroy_email_email ON viceroy_email_sends(email);

ALTER TABLE viceroy_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role email access" ON viceroy_email_sends
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
