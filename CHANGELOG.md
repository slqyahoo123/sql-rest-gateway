# Changelog

## v0.1.0 (Initial)

- App: NestJS gateway for PostgreSQL, read‑only by design
- Modules: API (list/detail), security (API key guard, rate limit), metadata/datasource, audit middleware, admin/auth
- Policies: per‑key field whitelist + optional row filter SQL
- Rate limiting: Redis RPS + daily quota with headers
- Observability: global error shape, request id, audit logs
- Admin UI: static HTML/JS with login + CSRF; CRUD for projects/datasource/keys/policies; audit view
- Swagger: docs with optional pre‑authorization (EXAMPLE_API_KEY)
- Public landing page served at `/`
- Docs: Quick Start / ENV / Policies & Queries / Admin Guide / Rate Limits / Launch Kit
- Repo: LICENSE, SECURITY, CONTRIBUTING, Code of Conduct


