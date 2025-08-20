-- Sample setup for demo project and datasource
-- Adjust DSN to your target Postgres holding business tables
INSERT INTO projects(name) VALUES('demo') ON CONFLICT DO NOTHING;

-- Replace connection string to your real data source
-- For MVP 明文写入 dsn_enc；后续改为加密
INSERT INTO datasources(project_id, type, dsn_enc)
SELECT id, 'postgres', 'postgres://postgres:postgres@host.docker.internal:5432/your_db'
FROM projects WHERE name='demo'
ON CONFLICT DO NOTHING;

-- 可选：示例业务表（若你没有现成库，可在同 DSN 建个表试用）
-- CREATE TABLE IF NOT EXISTS public.products (
--   id SERIAL PRIMARY KEY,
--   name TEXT NOT NULL,
--   price NUMERIC(10,2) NOT NULL,
--   is_active BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- INSERT INTO public.products(name, price) VALUES ('Running Shoes',129.99),('Backpack',59.00);

-- API Key 与策略请使用 scripts/gen-api-key.js 生成并插入（会输出明文 Key 与前缀）。
-- 示例：
-- node scripts/gen-api-key.js --project-name demo --rate 10 --quota 50000 \
--   --table public.products --fields id,name,price,created_at --row-filter "is_active = true"
