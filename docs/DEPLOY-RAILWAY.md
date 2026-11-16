# Deploy on Railway (MVP — single service)

This guide deploys **one Railway application service** (`vyaapar`) plus **PostgreSQL**. Fastify serves the React SPA and `/api/v1` on the **same public origin**. Infrastructure is defined in [`.railway/railway.ts`](../.railway/railway.ts) (Railway Infrastructure as Code).

**Legacy:** [`apps/api/railway.toml`](../apps/api/railway.toml) and [`apps/web/railway.toml`](../apps/web/railway.toml) are deprecated Config-as-Code files. Do **not** attach them to new services. Use IaC or dashboard settings below.

**This document does not create Railway resources.** You run `railway config plan` / `apply` yourself.

---

## Architecture

| Resource | Name | Role |
|----------|------|------|
| Database | `postgres` | Managed PostgreSQL |
| App | `vyaapar` | `pnpm railway:build` → Fastify + `apps/web/dist` |

**Public routes (one domain):**

- `/` — React SPA (static)
- `/api/v1/*` — REST API
- `/healthz` — process health (no DB)
- `/readyz` — DB connectivity

```mermaid
flowchart LR
  Browser --> vyaapar[vyaapar_service]
  vyaapar --> API["/api/v1"]
  vyaapar --> SPA[web_dist]
  API --> postgres[(postgres)]
```

---

## 1. Railway account and project

1. Sign up at [railway.com](https://railway.com) (GitHub login recommended).
2. Create an **empty project** or use `railway init` after CLI login.
3. Link the GitHub repo: `akhilmunnuru26/vyaapar-app` (or your fork).

---

## 2. PostgreSQL (production only)

1. In the project canvas: **+ New** → **Database** → **PostgreSQL**.
2. Wait until the service is **Active**.
3. Production `DATABASE_URL` is provided by Railway **only on the linked `vyaapar` service** via IaC (`db.env.DATABASE_URL`).

**Never** copy production `DATABASE_URL` to your laptop `.env`.

---

## 3. Infrastructure as Code

### Install tooling

```bash
pnpm add -D railway   # root devDependency — evaluates .railway/railway.ts
npm i -g @railway/cli # or use npx railway
railway login
```

CLI **5.42.1+** required for IaC ([docs](https://docs.railway.com/infrastructure-as-code)).

### Authoring file

Create [`.railway/railway.ts`](../.railway/railway.ts) (verified SDK fields from [IaC reference](https://docs.railway.com/infrastructure-as-code/reference)):

```ts
import { defineRailway, github, postgres, project, service } from 'railway/iac'

export default defineRailway(() => {
  const db = postgres('postgres')

  const vyaapar = service('vyaapar', {
    source: github('akhilmunnuru26/vyaapar-app'),
    build: 'pnpm railway:build',
    start: 'pnpm railway:start',
    preDeploy: 'pnpm db:migrate',
    healthcheck: '/healthz',
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      DATABASE_URL: db.env.DATABASE_URL,
    },
  })

  return project('vyaapar', { resources: [db, vyaapar] })
})
```

**No secrets in this file.** Set after apply:

| Variable | Where |
|----------|--------|
| `COOKIE_SECRET` | Railway → `vyaapar` → Variables (min 32 chars) |
| `APP_ORIGIN` | Full public URL, e.g. `https://vyaapar-production-xxxx.up.railway.app` (no trailing slash) |

Optional (future WhatsApp): `META_WHATSAPP_*` — document only; not required for MVP login.

### Plan and apply

```bash
cd /path/to/vyaapar-app
railway link          # select project + environment
railway config plan   # review creates/updates for postgres + vyaapar
railway config apply  # confirm when diff looks correct
```

**Do not run `apply` in CI without review.** Destructive changes need `railway config apply --yes --confirm-destructive`.

If Railway reports a service still managed by `railway.toml`, clear the **Config file** path in that service’s Settings (do not use legacy toml for new services).

---

## 4. Dashboard mirror (if not using apply)

Single service **`vyaapar`**, repo root `/`:

| Setting | Value |
|---------|--------|
| Build Command | `pnpm install --frozen-lockfile && pnpm railway:build` |
| Start Command | `pnpm railway:start` |
| Pre-deploy Command | `pnpm db:migrate` |
| Healthcheck Path | `/healthz` |
| Healthcheck Timeout | `120` |
| Watch paths | `apps/**`, `packages/**`, `.railway/**` |

---

## 5. Environment variables (`vyaapar` service)

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NODE_ENV` | Yes (prod) | `production` (set in IaC) |
| `PORT` | Auto | Railway injects |
| `DATABASE_URL` | Yes | Reference Postgres (IaC) |
| `APP_ORIGIN` | Yes | `https://<your-public-domain>` |
| `COOKIE_SECRET` | Yes | Random ≥ 32 characters |
| `SESSION_TTL_DAYS` | No | `14` |
| `LOG_LEVEL` | No | `info` |
| `SEED_*` | Seed only | Not set on deploy service |
| `META_WHATSAPP_*` | Future | Optional |

Validated at API startup via [`apps/api/src/env.ts`](../apps/api/src/env.ts).

---

## 6. Build and deploy

**Build order** (root `pnpm railway:build`):

1. `packages/contracts` → `dist/`
2. `packages/db` → `dist/`
3. `apps/web` → `dist/`
4. `apps/api` → `dist/` → `node dist/server.js`

**Runtime:** compiled JavaScript only (no `tsx` in production).

Git push to the linked branch triggers a Railway build/deploy.

---

## 7. Database migrations

- Migrations live in [`packages/db/migrations/`](../packages/db/migrations/).
- **Pre-deploy:** `pnpm db:migrate` (Drizzle) — runs **once per deploy**, not from each app instance at startup.
- **Do not** generate new migrations during deploy (`db:generate` is dev-only).
- **Never** drop production tables via deploy scripts.

### Backup and restore (manual)

1. Railway Postgres service → **Backups** (plan-dependent) or use `pg_dump` from a one-off machine with a **read-only** connection.
2. Restore: `pg_restore` / `psql` into a **new** database or maintenance window; re-test with `pnpm db:migrate` on a staging clone first.

---

## 8. One-time owner seed (manual)

**Not** part of build, start, or pre-deploy.

```bash
railway link   # vyaapar service context
railway run pnpm db:seed
```

Production guards (see [`packages/db/src/seed.ts`](../packages/db/src/seed.ts)):

- `NODE_ENV=production` requires `SEED_ALLOW_PRODUCTION=true`
- Requires explicit `SEED_OWNER_PASSWORD` (strong password)
- Idempotent: no password overwrite, no shop_settings overwrite

---

## 9. Public domain

1. `vyaapar` service → **Settings** → **Networking** → **Generate Domain**.
2. Set `APP_ORIGIN` to that `https://…` URL.
3. Redeploy if needed.

SPA and API share this origin; browsers use relative `/api/v1` (no `VITE_API_ORIGIN` required).

---

## 10. Health checks

| Path | Expected |
|------|----------|
| `GET /healthz` | `{"status":"ok"}` |
| `GET /readyz` | `{"status":"ready","database":"up"}` after migrate |

Railway uses `/healthz` for deploy health.

---

## 11. Local development (separate from production)

### PostgreSQL

**Option A — Docker (recommended):**

```bash
docker compose up -d
```

Compose publishes Postgres on host port **5434** (not 5432) to avoid clashing with other local databases.

**Option B — local Postgres 16** — create database `vyaapar_dev`.

Use **only** in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/vyaapar_dev
```

See [`.env.example`](../.env.example).

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev              # Vite :5173 + API :3000 (separate ports)
```

### Local production-mode smoke test (single port)

```bash
pnpm railway:build
# Copy .env with local DATABASE_URL, APP_ORIGIN=http://127.0.0.1:3000, COOKIE_SECRET=...
pnpm railway:start
```

Verify:

- `GET http://127.0.0.1:3000/healthz`
- `GET http://127.0.0.1:3000/readyz`
- `GET http://127.0.0.1:3000/` (SPA)
- `GET http://127.0.0.1:3000/api/v1/auth/me` → 401 JSON
- Unknown `GET /api/v1/no-such` → JSON 404 (not `index.html`)

---

## 12. Troubleshooting

| Symptom | Check |
|---------|--------|
| Build fails on `argon2` | `.npmrc` / `only-built-dependencies`; run `pnpm approve-builds` locally if needed |
| `readyz` down | `DATABASE_URL`, Postgres up, pre-deploy migrate logs |
| Login fails in prod | `APP_ORIGIN` exact match to browser URL; `COOKIE_SECRET` set |
| SPA 404 on refresh | SPA fallback must run for non-`/api` GET |
| IaC vs toml conflict | Remove dashboard config file path for legacy toml |
| Cross-origin (split deploy) | **Not used in MVP** — see appendix |

---

## Appendix: Split API + Web (not MVP)

Two Railway services on different `*.up.railway.app` hosts are **cross-site**. Session cookies require `SameSite=None; Secure`, correct CORS `credentials`, and `VITE_API_ORIGIN` at web build time. Many browsers restrict third-party cookies. Prefer **single `vyaapar` service** unless you use one custom domain in front of both.

---

## Remaining manual checklist after repo is ready

1. `railway config plan` → `railway config apply`
2. Generate public domain
3. Set `COOKIE_SECRET` and `APP_ORIGIN`
4. Confirm pre-deploy migrate succeeded
5. `railway run pnpm db:seed` (once, with production guards)
6. Login via browser

Local verification passing does **not** mean production is live until the checklist is complete.
