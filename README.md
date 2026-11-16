# Retail Management SaaS (Vyaapar)

Monorepo for Yuvraj Saree Center retail order, payment, and WhatsApp workflows.

## Stack

- **apps/web** — React 19, Vite, React Router, TanStack Query, Tabler UI
- **apps/api** — Fastify 5, Zod, health/ready checks, PostgreSQL via `packages/db`
- **packages/db** — Drizzle schema, migrations, seed (`Yuvraj Saree Center`)
- **packages/contracts** — shared Zod schemas and display helpers
- **packages/config** — shared TypeScript config

## Prerequisites

- Node.js LTS
- [pnpm](https://pnpm.io) 9+
- PostgreSQL **locally** (or `docker compose up -d`) — see [`.env.example`](.env.example)

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d   # optional local Postgres 16
pnpm db:migrate
pnpm db:seed
```

## Development

```bash
pnpm dev:web   # http://127.0.0.1:5173
pnpm dev:api   # http://127.0.0.1:3000
pnpm dev       # builds workspace packages, then web + api
```

Health (API):

- `GET http://127.0.0.1:3000/healthz` — process up (no DB)
- `GET http://127.0.0.1:3000/readyz` — DB connectivity

```bash
pnpm build
pnpm typecheck
pnpm railway:build   # production artifact order: contracts → db → web → api
```

### Database

```bash
pnpm db:generate   # after schema changes (dev only)
pnpm db:migrate
pnpm db:seed       # manual; idempotent; see production guards in packages/db/src/seed.ts
```

### Auth & API

Cookie session under `/api/v1/auth`. Domain routes for customers, orders, payments — see [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md).

Default dev login after seed: `owner@yuvrajsaree.local` / `SEED_OWNER_PASSWORD` from `.env`.

## Deploy on Railway (MVP)

**One service** (`vyaapar`) + Postgres. Fastify serves `/api/v1` and the React SPA on the **same domain**.

- **[docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md)** — IaC (`.railway/railway.ts`), `railway config plan/apply`, migrations, env vars, manual seed.
- **Never** use production `DATABASE_URL` on your laptop.

## Environment

See [`.env.example`](.env.example). Never commit real secrets.
