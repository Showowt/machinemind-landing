-- Enhanced Leads Table for Ad Traffic Capture
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_interest ON leads(interest);
