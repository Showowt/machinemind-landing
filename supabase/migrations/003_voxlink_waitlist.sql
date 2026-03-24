-- VoxLink Waitlist Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS voxlink_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  phone TEXT,
  email TEXT,
  position INTEGER NOT NULL,
  referrer TEXT DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique on phone (primary identifier — WhatsApp)
CREATE UNIQUE INDEX IF NOT EXISTS idx_voxlink_phone ON voxlink_waitlist(phone) WHERE phone IS NOT NULL AND phone != '';

-- Unique on email (fallback identifier)
CREATE UNIQUE INDEX IF NOT EXISTS idx_voxlink_email ON voxlink_waitlist(email) WHERE email IS NOT NULL AND email != '';

-- Index for counting/ordering
CREATE INDEX IF NOT EXISTS idx_voxlink_created ON voxlink_waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voxlink_position ON voxlink_waitlist(position);

-- RLS
ALTER TABLE voxlink_waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert (waitlist form)
CREATE POLICY "Public can insert voxlink waitlist"
  ON voxlink_waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public can read count only (for counter)
CREATE POLICY "Public can count voxlink waitlist"
  ON voxlink_waitlist FOR SELECT
  TO anon
  USING (true);

-- Service role full access (admin dashboard)
CREATE POLICY "Service role full access voxlink waitlist"
  ON voxlink_waitlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
