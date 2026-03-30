-- Viceroy Private Capital — Lead Management Schema
-- Tracks assessment form submissions and scraped/enriched leads

CREATE TABLE IF NOT EXISTS viceroy_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  asset_categories TEXT[] DEFAULT '{}',
  estimated_equity TEXT,
  alignment_score INTEGER DEFAULT 0,
  source TEXT DEFAULT 'assessment_form',
  city TEXT,
  state TEXT,
  property_address TEXT,
  linkedin_url TEXT,
  company TEXT,
  title TEXT,
  objectives TEXT,
  decision_authority TEXT,
  timeframe TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'contacted', 'engaged', 'participating', 'declined', 'archived')),
  investor_model TEXT,
  notes TEXT,
  enrichment_status TEXT DEFAULT 'raw' CHECK (enrichment_status IN ('raw', 'partial', 'enriched')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_alignment ON viceroy_leads(alignment_score DESC);
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_status ON viceroy_leads(status);
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_source ON viceroy_leads(source);
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_email ON viceroy_leads(email);
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_state ON viceroy_leads(state);
CREATE INDEX IF NOT EXISTS idx_viceroy_leads_created ON viceroy_leads(created_at DESC);

-- RLS
ALTER TABLE viceroy_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access (server-side only)
CREATE POLICY "Service role full access" ON viceroy_leads
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon can insert (assessment form submissions)
CREATE POLICY "Anon can submit assessments" ON viceroy_leads
  FOR INSERT
  WITH CHECK (source = 'assessment_form');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_viceroy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER viceroy_leads_updated_at
  BEFORE UPDATE ON viceroy_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_viceroy_updated_at();

-- Viceroy conversation tracking (for qualification chat)
CREATE TABLE IF NOT EXISTS viceroy_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  lead_id UUID REFERENCES viceroy_leads(id),
  alignment_score INTEGER DEFAULT 0,
  investor_model TEXT,
  investor_model_confidence INTEGER DEFAULT 0,
  gate_reached INTEGER DEFAULT 1,
  quality TEXT DEFAULT 'exploring',
  message_count INTEGER DEFAULT 0,
  advanced_to_assessment BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viceroy_conv_session ON viceroy_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_viceroy_conv_score ON viceroy_conversations(alignment_score DESC);

ALTER TABLE viceroy_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role conv access" ON viceroy_conversations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
