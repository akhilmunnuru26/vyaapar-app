# Railway implementation handoff (Agent mode pending)

**Status:** Code changes from this handoff have been applied. Run local verification and Railway `config plan` before first production deploy.

---

## Blocker

Cursor Plan mode allows only markdown/canvas edits. User approved Agent mode but mode switch was rejected by the IDE. **Apply the file changes below in Agent mode** to complete the task.

---

## Files to create

### `.railway/railway.ts`

Same content as in [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md) §3.

### `.railway/README.md`

Run `railway config init` or copy Railway’s generated README (plan/apply instructions).

### `packages/contracts/tsconfig.build.json` + `packages/db/tsconfig.build.json`

See plan — `outDir: dist`, `declaration: true`.

### `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5434:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vyaapar_dev
    volumes:
      - vyaapar_pg_data:/var/lib/postgresql/data
volumes:
  vyaapar_pg_data:
```

---

## Files to modify (summary)

| File | Change |
|------|--------|
| `package.json` | `railway:build`, `railway:start`; devDep `railway`; remove split `railway:build:web` as primary |
| `packages/contracts/package.json` | `build`: `tsc -p tsconfig.build.json`; exports → `dist/index.js` |
| `packages/db/package.json` | Same; fix `./schema` export to `./dist/schema.js` |
| `apps/api/package.json` | `start`: `node dist/server.js`; add `@fastify/static`; move `tsx` to devDependencies |
| `apps/api/src/server.ts` | Production static + SPA fallback + API 404 JSON |
| `apps/api/src/env.ts` | Optional `LOG_LEVEL`, META vars optional; document only |
| `apps/api/src/auth.ts` | Prefer `SameSite=lax` when same host as `APP_ORIGIN` |
| `packages/db/src/seed.ts` | Production guards; `onConflictDoNothing` for shop_settings |
| `.env.example` | Local-only DB warning; prod env section; META placeholders |
| `README.md` | Single-service deploy summary |
| `apps/api/railway.toml`, `apps/web/railway.toml` | Top comment: LEGACY — do not use for new services |
| `apps/web/package.json` | `serve` / `start` optional for local static preview only |

---

## Root scripts (target)

```json
"railway:build": "pnpm --filter @retail-management/contracts build && pnpm --filter @retail-management/db build && pnpm --filter @retail-management/web build && pnpm --filter @retail-management/api build",
"railway:start": "pnpm --filter @retail-management/api start"
```

---

## `apps/api/src/server.ts` — production static (sketch)

After registering API routes and health endpoints, when `env.NODE_ENV === 'production'`:

1. Resolve `webDist = path.join(fileURLToPath(import.meta.url), '../../web/dist')`.
2. `register(@fastify/static, { root: webDist })`.
3. `setNotFoundHandler`: if URL starts with `/api` → JSON 404; else GET/HEAD → `sendFile('index.html')`.

---

## Seed hardening (target behavior)

- Abort if `NODE_ENV===production` && `SEED_ALLOW_PRODUCTION!==true`.
- Abort if production without `SEED_OWNER_PASSWORD` (min length).
- `shop_settings`: `onConflictDoNothing`.
- Log skip when shop/user already exists.

---

## Local verification commands (run after code apply)

```bash
pnpm install --frozen-lockfile
pnpm railway:build
# .env: local DATABASE_URL, APP_ORIGIN=http://127.0.0.1:3000, COOKIE_SECRET=...
pnpm railway:start
curl -s http://127.0.0.1:3000/healthz
curl -s http://127.0.0.1:3000/readyz
curl -s http://127.0.0.1:3000/api/v1/auth/me
```

Optional: `pnpm db:seed` on local DB only; `pnpm typecheck`.

---

## Final report template (fill after Agent applies + tests)

1. **Files created** — list paths  
2. **Files modified** — list paths  
3. **IaC** — `.railway/railway.ts` with `preDeploy`, `healthcheck`  
4. **PostgreSQL** — docker-compose + docs  
5. **`pnpm railway:build`** — pass/fail  
6. **`pnpm railway:start`** — pass/fail  
7. **Health** — /healthz, /readyz outputs  
8. **API** — /api/v1/auth/me 401, unknown /api JSON 404  
9. **Seed** — grep guards in seed.ts; local idempotent test  
10. **Manual Railway** — plan/apply, domain, env, seed once  
11. **Blockers** — any

**Do not claim production deployment succeeded** until manual Railway checklist in DEPLOY-RAILWAY.md is done.
