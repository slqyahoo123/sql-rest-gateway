# SQL→API Gateway (NestJS) — Read‑only REST for Postgres

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Release](https://img.shields.io/github/v/release/slqyahoo123/sql-rest-gateway?display_name=tag)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Docker](https://img.shields.io/badge/docker-compose-blue?logo=docker)

Website: https://lingxinzhisuan.github.io/sql-rest-gateway

Self‑hosted, secure, read‑only SQL→API gateway for PostgreSQL.

## Features
- Read‑only by design (least‑privilege DSN, AES‑256‑GCM encryption)
- Per‑key policies (field whitelist, optional row filter SQL)
- Rate limiting & daily quota via Redis (standard response headers)
- Structured audit logs and request id
- Admin UI (single HTML/JS page with CSRF)
- Swagger docs with optional pre‑authorization for demo

## Quick Start

Run with Docker (recommended)
```
docker compose up -d
# App:    http://localhost:3000
# Swagger: http://localhost:3000/docs
```

Run locally
```
npm install
npm run start:dev
```

Environment
```
cp env.example .env
```
See `docs/en/ENV_Variables.md` for all variables.

Admin sign‑in (dev)
```
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"token":"admin_dev"}'
```
The response sets cookies and returns a `csrf_token` for protected admin writes.

Issue an API key (example)
```
curl -s -X POST http://localhost:3000/admin/keys/issue \
  -H 'Content-Type: application/json' \
  -H 'x-admin-token: admin_dev' \
  -H 'x-csrf-token: <CSRF_FROM_LOGIN>' \
  -d '{
    "project_id": 1,
    "rate_rps": 5,
    "daily_quota": 10000,
    "table_fqn": "public.products",
    "allowed_fields": ["id","name","price"],
    "row_filter_sql": "is_active = true"
  }'
```

Call the API (read‑only)
```
curl "http://localhost:3000/api/public.products?select=id,name,price&limit=10" \
  -H "Authorization: Bearer <PLAINTEXT_API_KEY>"
```

Swagger pre‑authorization (demo)
```
# PowerShell
$env:EXAMPLE_API_KEY = "<PLAINTEXT_API_KEY>"; npm run start:dev
```
Open `http://localhost:3000/docs` — the key will be pre‑authorized.

Health check
```
curl -s http://localhost:3000/health
```

## Docs
- Quick Start: `docs/en/Quick_Start.md`
- ENV: `docs/en/ENV_Variables.md`
- Policies & Queries: `docs/en/Policies_and_Queries.md`
- Admin Guide: `docs/en/Admin_Guide.md`
- Rate Limits: `docs/en/Rate_Limits.md`
- Launch Kit: `docs/en/Launch_Kit.md`

## License
Internal prototype; license to be added.
