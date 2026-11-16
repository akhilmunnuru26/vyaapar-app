/**
 * Railway Infrastructure as Code — define desired project state.
 *
 *   railway login && railway link
 *   railway config plan
 *   railway config apply
 *
 * Set COOKIE_SECRET and APP_ORIGIN in the Railway dashboard after generating the public domain.
 *
 * @see https://docs.railway.com/infrastructure-as-code/reference
 */
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

  return project('vyaapar', {
    resources: [db, vyaapar],
  })
})
