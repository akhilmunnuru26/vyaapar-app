import { loginBodySchema } from '@retail-management/contracts'
import {
  sessions,
  shopMemberships,
  shops,
  users,
  type DbResources,
} from '@retail-management/db'
import type { ApiEnv } from './env.js'
import cookie from '@fastify/cookie'
import csrf from '@fastify/csrf-protection'
import rateLimit from '@fastify/rate-limit'
import * as argon2 from 'argon2'
import { createHmac, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const SESSION_COOKIE = 'ys_session'

function sessionCookieOptions(env: ApiEnv, request: FastifyRequest) {
  const appHost = new URL(env.APP_ORIGIN).host
  const reqHost = request.hostname
  const sameOrigin = appHost === reqHost
  return {
    path: '/',
    httpOnly: true as const,
    sameSite: (env.NODE_ENV === 'production' && !sameOrigin ? 'none' : 'lax') as 'lax' | 'none',
    secure: env.NODE_ENV === 'production',
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  }
}

export type RequestAuth = {
  userId: string
  shopId: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  sessionId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuth | null
  }
  interface FastifyContextConfig {
    csrfProtection?: boolean
  }
}

function sessionTokenHash(rawToken: string, secret: string): string {
  return createHmac('sha256', secret).update(rawToken).digest('hex')
}

async function resolveSession(
  db: DbResources['db'],
  rawToken: string | undefined,
  secret: string,
): Promise<RequestAuth | null> {
  if (!rawToken) return null
  const hash = sessionTokenHash(rawToken, secret)
  const now = new Date()

  const [match] = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      shopId: shops.id,
      role: shopMemberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(
      shopMemberships,
      and(eq(shopMemberships.userId, users.id), eq(shopMemberships.status, 'active')),
    )
    .innerJoin(shops, eq(shopMemberships.shopId, shops.id))
    .where(
      and(
        eq(sessions.sessionTokenHash, hash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, 'active'),
        eq(shops.status, 'active'),
      ),
    )
    .limit(1)

  if (!match) return null

  return {
    sessionId: match.sessionId,
    userId: match.userId,
    shopId: match.shopId,
    role: match.role,
  }
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = request.server.config.env.COOKIE_SECRET
  const auth = await resolveSession(request.server.db, request.cookies[SESSION_COOKIE], secret)
  if (!auth) {
    await reply.code(401).send({ error: { code: 'unauthorized', message: 'Login required' } })
    return
  }
  request.auth = auth
}

export async function registerSecurityPlugins(app: FastifyInstance, env: ApiEnv): Promise<void> {
  await app.register(cookie, { secret: env.COOKIE_SECRET, hook: 'onRequest' })
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
  })
  await app.register(csrf, {
    sessionPlugin: '@fastify/cookie',
  })
}

export function registerAuthRoutes(app: FastifyInstance, env: ApiEnv, db: DbResources['db']): void {
  app.decorateRequest('auth', null)

  app.post(
    '/api/v1/auth/login',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '15 minutes' },
        csrfProtection: false,
      },
    },
    async (request, reply) => {
      const body = loginBodySchema.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'Invalid login', details: body.error.flatten() },
        })
      }

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(and(sql`lower(${users.email}) = ${body.data.email}`, eq(users.status, 'active')))
        .limit(1)

      if (!user || !(await argon2.verify(user.passwordHash, body.data.password))) {
        return reply.code(401).send({ error: { code: 'invalid_credentials', message: 'Invalid email or password' } })
      }

      const rawToken = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

      await db.insert(sessions).values({
        userId: user.id,
        sessionTokenHash: sessionTokenHash(rawToken, env.COOKIE_SECRET),
        expiresAt,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      })

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

      reply.setCookie(SESSION_COOKIE, rawToken, sessionCookieOptions(env, request))

      const auth = await resolveSession(db, rawToken, env.COOKIE_SECRET)
      if (!auth) {
        return reply.code(500).send({ error: { code: 'session_error', message: 'Could not establish session' } })
      }

      const [shop] = await db
        .select({
          id: shops.id,
          name: shops.name,
          slug: shops.slug,
          timezone: shops.timezone,
        })
        .from(shops)
        .where(eq(shops.id, auth.shopId))
        .limit(1)

      return {
        user: { id: user.id, name: user.name, email: user.email },
        shop: { ...shop!, role: auth.role },
      }
    },
  )

  app.post(
    '/api/v1/auth/logout',
    { preHandler: requireAuth, config: { csrfProtection: false } },
    async (request, reply) => {
      if (request.auth) {
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.id, request.auth.sessionId))
      }
      reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(env, request))
      return { success: true as const }
    },
  )

  app.get('/api/v1/auth/csrf', { config: { csrfProtection: false } }, async (_request, reply) => {
    const token = reply.generateCsrf()
    return { token }
  })

  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth!
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    const [shop] = await db
      .select({ id: shops.id, name: shops.name, slug: shops.slug, timezone: shops.timezone })
      .from(shops)
      .where(eq(shops.id, auth.shopId))
      .limit(1)

    return {
      user: user!,
      shop: { ...shop!, role: auth.role },
    }
  })
}

export { requireAuth }
