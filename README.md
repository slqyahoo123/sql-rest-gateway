# SQL→API Gateway (NestJS) - MVP Skeleton

本项目为“安全只读 · 默认 REST · 可自托管”的 SQL→API 平台（首发 Postgres）的最小可运行骨架，便于快速迭代 MVP。

## 目录结构

```
sql-rest-gateway/
  ├─ src/
  │  ├─ api/
  │  │  ├─ api.controller.ts
  │  │  └─ api.module.ts
  │  ├─ health/
  │  │  ├─ health.controller.ts
  │  │  └─ health.module.ts
  │  ├─ app.module.ts
  │  └─ main.ts
  ├─ migrations/
  │  └─ 001_init.sql
  ├─ env.example
  ├─ docker-compose.yml
  ├─ scripts/
  │  ├─ gen-api-key.js
  │  └─ init-demo.js
  ├─ package.json
  ├─ tsconfig.json
  ├─ tsconfig.build.json
  └─ nest-cli.json
```

## 快速开始

1) 复制环境变量

```
cp env.example .env
```

2) 启动依赖（Postgres 元数据库 + Redis）与应用（推荐）

```
docker compose up -d
```

3) 一键初始化 Demo（要求提前准备好业务库 DSN）

```
META_DB_URL=postgres://postgres:postgres@localhost:5432/sqlrest_meta \
API_KEY_HASH_SALT=change_me \
node scripts/init-demo.js \
  --project-name demo \
  --datasource-dsn "postgres://postgres:postgres@host.docker.internal:5432/your_db" \
  --table public.products \
  --fields id,name,price,created_at \
  --row-filter "is_active = true" \
  --rate 10 --quota 50000
```

执行后会输出 `api_key_plaintext` 与示例 cURL 请求。

4) 本地开发（不使用 docker 跑 app）

```
npm install
npm run start:dev
```

5) 手动调用示例
- 健康检查：`GET http://localhost:3000/health` → `{ ok: true }`
- 列表：`GET http://localhost:3000/api/public.products?select=id,name,price&limit=10`（携带 `Authorization: Bearer <API_KEY>`）
- 详情：`GET http://localhost:3000/api/public.products/1`（携带 `Authorization: Bearer <API_KEY>`）

> 说明：MVP 已具备字段白名单、行级过滤、限流/配额与审计；后续继续完善错误码、OpenAPI 与管理界面。

## 环境变量
- `APP_PORT` 服务端口
- `META_DB_URL` 元数据库（Postgres）
- `REDIS_URL` Redis（限流/配额）
- `API_KEY_HASH_SALT` Key 哈希盐
- `ADMIN_TOKEN` 管理登录令牌（默认 `admin_dev`，请修改）
- `DISABLE_RATE_LIMIT` 设为 `true` 可临时关闭限流（便于本地无 Redis 验证）

## 元数据迁移
启动后会自动应用 `migrations/001_init.sql` 初始化结构（通过 Postgres 容器挂载）。

## 下一步待办
- 详见 docs/GoToMarket_Overseas_CN.md 与 docs/Systematic_Analysis_Guide_CN.md

## 项目计划（4 周）

### 第 1 周（准备）
- [ ] 完成英文文档与落地页初稿（Quick Start / ENV 表 / Policy / Rate Limit / Admin）
- [ ] 搭建在线 Demo（公共 Swagger + 预授权示例 Key，每小时轮换）
- [ ] README 徽章/roadmap/security/contributing 完成；开启 GitHub Discussions
- [ ] 埋点（Plausible 或 PostHog）与 UTM 短链

### 第 2 周（内容 + 外联）
- [ ] 发布 2 篇教程与 1 篇对比文（PostgREST 替代）
- [ ] 录制 60s 演示视频（含 Docker 一键起与策略示例）
- [ ] 准备 Product Hunt / Show HN 素材，约 5 位友好评论者

### 第 3 周（首发）
- [ ] 在 Product Hunt / Show HN / Reddit（r/selfhosted 等）发布并运营评论
- [ ] 监控 Uptime/错误率/429，滚动修复
- [ ] 私信 20 家目标公司（Postgres-first）并提供接入支持

### 第 4 周（放大）
- [ ] 1.0 加固发布与总结博文
- [ ] 收集 Logo/证言并更新网站与 README
- [ ] Console.dev 以及目录站投递；上线一键部署按钮（Render/Fly/DO）

> 任务追踪：建议在 GitHub 创建 Milestones（Week1~Week4）与对应 Issues，将以上清单拆分到具体任务。详见 `docs/PROJECT_PLAN_CN.md`。

## 许可
仅用于内部原型验证，后续补充许可证。
