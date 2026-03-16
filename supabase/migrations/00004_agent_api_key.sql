-- ============================================================
-- Per-tenant Agent API Key
-- ============================================================

-- Add dedicated agent_api_key column to tenants
ALTER TABLE tenants
  ADD COLUMN agent_api_key TEXT UNIQUE;

-- Backfill existing tenants with generated keys
UPDATE tenants
SET agent_api_key = 'wai_' || encode(extensions.gen_random_bytes(32), 'hex')
WHERE agent_api_key IS NULL;

-- Make non-nullable now that all rows are filled
ALTER TABLE tenants
  ALTER COLUMN agent_api_key SET NOT NULL;
