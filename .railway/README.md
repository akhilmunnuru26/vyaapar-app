# Railway Infrastructure as Code

This folder defines the Railway project in `railway.ts`.

## Workflow

1. Install the CLI and SDK: `pnpm add -D railway` (root), `npm i -g @railway/cli`
2. `railway login`
3. `railway link` — select project and environment
4. `railway config plan` — review changes
5. `railway config apply` — apply after confirmation

Do not commit secrets. Set `COOKIE_SECRET` and `APP_ORIGIN` on the `vyaapar` service in the Railway dashboard.

See [docs/DEPLOY-RAILWAY.md](../docs/DEPLOY-RAILWAY.md) for the full deployment guide.
