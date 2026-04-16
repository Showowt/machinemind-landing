INSERT INTO qr_codes (slug, name, destination, campaign, style)
VALUES
  ('take', 'Take Kangaroo', 'https://takekangaroo.com', 'kangaroo', 'luxury'),
  ('buy',  'Buy Kangaroo',  'https://buykangaroo.com', 'kangaroo', 'luxury'),
  ('fun',  'FunGuys',       'https://funguys.biz',     'funguys',  'luxury')
ON CONFLICT (slug) DO UPDATE
  SET destination = EXCLUDED.destination,
      name = EXCLUDED.name,
      campaign = EXCLUDED.campaign,
      active = TRUE;
