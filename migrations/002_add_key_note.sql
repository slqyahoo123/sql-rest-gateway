-- Add note column to api_keys
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS note TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
