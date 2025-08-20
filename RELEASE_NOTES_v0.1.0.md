# Release v0.1.0

First public MVP of SQL→API Gateway (NestJS), a self‑hosted, read‑only REST API for PostgreSQL.

Highlights
- Read‑only by design; DSN encryption (AES‑256‑GCM)
- API: list/detail with select/where/order/cursor
- Policies: per‑key field whitelist + optional row filter SQL
- Security: API key guard, admin login (token/hash) with CSRF
- Rate limiting: Redis RPS + daily quota with headers
- Observability: request-id, global error shape, audit logs
- Admin UI: static HTML/JS for projects/datasource/keys/policies/audit
- Docs: Quick Start / ENV / Policies / Admin Guide / Rate Limits / Launch Kit
- Landing page served at `/`

Notes
- Intended for read‑only use cases; write operations are out of scope
- Configure environment per `docs/en/ENV_Variables.md`
