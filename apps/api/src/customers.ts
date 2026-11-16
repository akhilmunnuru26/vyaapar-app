import { customerCreateSchema, customerUpdateSchema } from '@retail-management/contracts'
import { customers, type DbResources } from '@retail-management/db'
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAuth } from './auth.js'

function denyWrite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth!.role === 'viewer') {
    void reply.code(403).send({ error: { code: 'forbidden', message: 'Read-only access' } })
    return true
  }
  return false
}

export function registerCustomerRoutes(app: FastifyInstance, db: DbResources['db']): void {
  app.get('/api/v1/customers', { preHandler: requireAuth }, async (request) => {
    const shopId = request.auth!.shopId
    const q = typeof request.query === 'object' && request.query && 'q' in request.query
      ? String(request.query.q ?? '').trim()
      : ''

    const rows = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.shopId, shopId),
          isNull(customers.deletedAt),
          q
            ? or(ilike(customers.name, `%${q}%`), ilike(customers.phoneE164, `%${q}%`))
            : undefined,
        ),
      )
      .orderBy(customers.name)
      .limit(100)

    return { data: rows }
  })

  app.post('/api/v1/customers', { preHandler: requireAuth }, async (request, reply) => {
    if (denyWrite(request, reply)) return
    const parsed = customerCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }
    const shopId = request.auth!.shopId
    const now = new Date()
    const [row] = await db
      .insert(customers)
      .values({
        shopId,
        name: parsed.data.name,
        phoneE164: parsed.data.phoneE164 ?? null,
        alternatePhoneE164: parsed.data.alternatePhoneE164 ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        whatsappTransactionalOptIn: parsed.data.whatsappTransactionalOptIn ?? false,
        whatsappTransactionalOptInAt: parsed.data.whatsappTransactionalOptIn ? now : null,
        whatsappMarketingOptIn: parsed.data.whatsappMarketingOptIn ?? false,
        whatsappMarketingOptInAt: parsed.data.whatsappMarketingOptIn ? now : null,
      })
      .returning()
    return reply.code(201).send({ data: row })
  })

  app.get('/api/v1/customers/:customerId', { preHandler: requireAuth }, async (request, reply) => {
    const shopId = request.auth!.shopId
    const customerId = (request.params as { customerId: string }).customerId
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.shopId, shopId), eq(customers.id, customerId), isNull(customers.deletedAt)),
      )
      .limit(1)
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Customer not found' } })
    return { data: row }
  })

  app.patch('/api/v1/customers/:customerId', { preHandler: requireAuth }, async (request, reply) => {
    if (denyWrite(request, reply)) return
    const parsed = customerUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }
    const shopId = request.auth!.shopId
    const customerId = (request.params as { customerId: string }).customerId
    const [row] = await db
      .update(customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(customers.shopId, shopId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .returning()
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Customer not found' } })
    return { data: row }
  })
}
