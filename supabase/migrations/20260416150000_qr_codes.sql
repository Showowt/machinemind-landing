-- Programmable QR Redirect System
-- Every printed QR encodes https://machinemindconsulting.com/q/<slug>
-- The destination, gift, and discount are editable forever without reprinting.

-- ========== QR CODES ==========
CREATE TABLE IF NOT EXISTS qr_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  destination   TEXT NOT NULL DEFAULT 'https://machinemindconsulting.com',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  campaign      TEXT,
  logo_key      TEXT,
  style         TEXT NOT NULL DEFAULT 'classic',
  colors        JSONB NOT NULL DEFAULT '{"dark":"#000000","light":"#FFFFFF","accent":"#c9a96e"}'::jsonb,
  gift_config   JSONB,
  discount_config JSONB,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS qr_codes_slug_idx ON qr_codes(slug);
CREATE INDEX IF NOT EXISTS qr_codes_active_idx ON qr_codes(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS qr_codes_campaign_idx ON qr_codes(campaign);

-- ========== QR SCANS ==========
CREATE TABLE IF NOT EXISTS qr_scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id         UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  user_agent    TEXT,
  ip_address    TEXT,
  ip_country    TEXT,
  ip_city       TEXT,
  referer       TEXT,
  device_type   TEXT,
  browser       TEXT,
  os            TEXT,
  destination_served TEXT,
  gift_awarded  BOOLEAN NOT NULL DEFAULT FALSE,
  gift_code     TEXT,
  session_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qr_scans_qr_id_idx ON qr_scans(qr_id);
CREATE INDEX IF NOT EXISTS qr_scans_slug_idx ON qr_scans(slug);
CREATE INDEX IF NOT EXISTS qr_scans_created_at_idx ON qr_scans(created_at DESC);

-- ========== QR GIFTS / DISCOUNTS ISSUED ==========
CREATE TABLE IF NOT EXISTS qr_gifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id         UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  scan_id       UUID REFERENCES qr_scans(id) ON DELETE SET NULL,
  gift_code     TEXT UNIQUE NOT NULL,
  gift_type     TEXT NOT NULL,
  gift_value    TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  user_identifier TEXT,
  redeemed      BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qr_gifts_code_idx ON qr_gifts(gift_code);
CREATE INDEX IF NOT EXISTS qr_gifts_qr_id_idx ON qr_gifts(qr_id);
CREATE INDEX IF NOT EXISTS qr_gifts_redeemed_idx ON qr_gifts(redeemed) WHERE redeemed = FALSE;

-- ========== updated_at TRIGGER ==========
CREATE OR REPLACE FUNCTION update_qr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qr_codes_updated_at ON qr_codes;
CREATE TRIGGER qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_updated_at();

-- ========== RLS ==========
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_codes_public_read_active" ON qr_codes;
CREATE POLICY "qr_codes_public_read_active" ON qr_codes
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "qr_codes_service_all" ON qr_codes;
CREATE POLICY "qr_codes_service_all" ON qr_codes
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "qr_scans_service_all" ON qr_scans;
CREATE POLICY "qr_scans_service_all" ON qr_scans
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "qr_gifts_public_read_by_code" ON qr_gifts;
CREATE POLICY "qr_gifts_public_read_by_code" ON qr_gifts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "qr_gifts_service_all" ON qr_gifts;
CREATE POLICY "qr_gifts_service_all" ON qr_gifts
  FOR ALL USING (auth.role() = 'service_role');

-- ========== DEFAULT SEED: the core MachineMind QR ==========
INSERT INTO qr_codes (slug, name, destination, campaign, style)
VALUES
  ('mm', 'MachineMind Primary', 'https://machinemindconsulting.com', 'core', 'luxury'),
  ('card', 'Business Card QR', 'https://machinemindconsulting.com', 'print', 'luxury'),
  ('voxlink', 'VoxLink Waitlist', 'https://machinemindconsulting.com/voxlink', 'voxlink', 'luxury'),
  ('viceroy', 'Viceroy Capital', 'https://machinemindconsulting.com/viceroy', 'viceroy', 'luxury')
ON CONFLICT (slug) DO NOTHING;
