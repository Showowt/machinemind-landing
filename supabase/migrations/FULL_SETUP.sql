-- ============================================
-- MachineMind Full Lead Capture System
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 1: SOFIA CRM (Conversation Tracking)
-- ============================================

-- Conversations table
CREATE TABLE IF NOT EXISTS sofia_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'booked', 'lost', 'follow_up')),
  lead_quality TEXT NOT NULL DEFAULT 'cold' CHECK (lead_quality IN ('hot', 'warm', 'cold', 'unqualified')),
  lead_info JSONB NOT NULL DEFAULT '{}',
  message_count INTEGER NOT NULL DEFAULT 0,
  booked_call BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  user_agent TEXT,
  ip_country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS sofia_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES sofia_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sofia Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_session ON sofia_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON sofia_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_quality ON sofia_conversations(lead_quality);
CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON sofia_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_booked ON sofia_conversations(booked_call) WHERE booked_call = TRUE;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON sofia_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON sofia_messages(timestamp DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON sofia_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sofia RLS
ALTER TABLE sofia_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sofia_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert conversations"
  ON sofia_conversations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can update own session"
  ON sofia_conversations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can insert messages"
  ON sofia_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to conversations"
  ON sofia_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to messages"
  ON sofia_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sofia Dashboard Stats View
CREATE OR REPLACE VIEW sofia_dashboard_stats AS
SELECT
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE status = 'active') as active_conversations,
  COUNT(*) FILTER (WHERE booked_call = true) as booked_calls,
  COUNT(*) FILTER (WHERE lead_quality = 'hot') as hot_leads,
  COUNT(*) FILTER (WHERE lead_quality = 'warm') as warm_leads,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days,
  ROUND(
    COUNT(*) FILTER (WHERE booked_call = true)::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    1
  ) as booking_rate
FROM sofia_conversations;

GRANT SELECT ON sofia_dashboard_stats TO anon, service_role;

-- ============================================
-- PART 2: LEADS TABLE (Contact Form)
-- ============================================

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'portfolio',
  language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Leads Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);

-- Leads updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Leads RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to leads"
  ON leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Leads Dashboard Stats View
CREATE OR REPLACE VIEW leads_dashboard_stats AS
SELECT
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
  COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
  COUNT(*) FILTER (WHERE status = 'converted') as converted_leads,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    1
  ) as conversion_rate
FROM leads;

GRANT SELECT ON leads_dashboard_stats TO anon, service_role;

-- ============================================
-- DONE! Tables created:
-- - sofia_conversations
-- - sofia_messages
-- - leads
-- Views created:
-- - sofia_dashboard_stats
-- - leads_dashboard_stats
-- ============================================
