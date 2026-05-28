ALTER TABLE sessions ADD COLUMN token_family TEXT;
ALTER TABLE sessions ADD COLUMN replaced_by INTEGER;
ALTER TABLE sessions ADD COLUMN revoked_reason TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN last_used_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_family ON sessions(token_family);
