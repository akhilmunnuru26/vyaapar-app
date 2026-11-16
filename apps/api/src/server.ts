import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, pingDatabase } from '@retail-management/db'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { registerAuthRoutes, registerSecurityPlugins } from './auth.js'
import { registerCustomerRoutes } from './customers.js'
import { loadEnv } from './env.js'
import { registerOrderRoutes } from './orders.js'
import { registerPaymentRoutes } from './payments.js'

const distDir = path.dirname(fileURLToPath(import.meta.url))
const webDist = path.resolve(distDir, '../../web/dist')

async function registerProductionFrontend(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: webDist,
    wildcard: false,
  })

  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? request.url
    if (url.startsWith('/api')) {
      return reply.code(404).send({
        error: { code: 'not_found', message: 'Route not found' },
      })
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      return reply.sendFile('index.html', webDist)
    }
    return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } })
  })
}

async function main(): Promise<void> {
  const env = loadEnv()
  const { db, sql, close } = createDb(env.DATABASE_URL)

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug') },
    trustProxy: env.NODE_ENV === 'production',
  })

  app.decorate('db', db)
  app.decorate('config', { env })

  await registerSecurityPlugins(app, env)

  await app.register(cors, {
    origin: env.APP_ORIGIN,
    credentials: true,
  })

  registerAuthRoutes(app, env, db)
  registerCustomerRoutes(app, db)
  registerOrderRoutes(app, db)
  registerPaymentRoutes(app, db)

  app.get('/healthz', async () => ({ status: 'ok' as const }))

  app.get('/readyz', async (_request, reply) => {
    try {
      await pingDatabase(sql)
      return { status: 'ready' as const, database: 'up' as const }
    } catch {
      return reply.code(503).send({ status: 'not_ready' as const, database: 'down' as const })
    }
  })

  if (env.NODE_ENV === 'production') {
    await registerProductionFrontend(app)
  }

  app.addHook('onClose', async () => {
    await close()
  })

  await app.listen({ host: env.HOST, port: env.PORT })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>['db']
    config: { env: ReturnType<typeof loadEnv> }
  }
}
