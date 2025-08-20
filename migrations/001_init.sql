-- Metadata schema for SQL→API Gateway
CREATE TABLE IF NOT EXISTS projects (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datasources (
	id SERIAL PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	type TEXT NOT NULL DEFAULT 'postgres',
	dsn_enc TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_datasources_project ON datasources(project_id);

CREATE TABLE IF NOT EXISTS api_keys (
	id SERIAL PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key_hash TEXT NOT NULL,
	key_prefix TEXT NOT NULL,
	active BOOLEAN NOT NULL DEFAULT TRUE,
	rate_rps INTEGER NOT NULL DEFAULT 5,
	daily_quota INTEGER NOT NULL DEFAULT 10000,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);

CREATE TABLE IF NOT EXISTS key_policies (
	id SERIAL PRIMARY KEY,
	api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
	table_fqn TEXT NOT NULL,
	allowed_fields JSONB NOT NULL DEFAULT '[]',
	row_filter_sql TEXT
);
CREATE INDEX IF NOT EXISTS idx_key_policies_key ON key_policies(api_key_id);
CREATE INDEX IF NOT EXISTS idx_key_policies_table ON key_policies(table_fqn);

CREATE TABLE IF NOT EXISTS audit_logs (
	id BIGSERIAL PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
	route TEXT NOT NULL,
	method TEXT NOT NULL,
	query_json JSONB,
	status INTEGER NOT NULL,
	duration_ms INTEGER NOT NULL,
	row_count INTEGER,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_time ON audit_logs(project_id, created_at DESC);
