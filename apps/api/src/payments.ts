import { paymentCreateSchema, paymentVoidSchema } from '@retail-management/contracts'
import { auditLogs, orders, payments, shops, type DbResources } from '@retail-management/db'
import { and, eq, isNull, sum } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireAuth } from './auth.js'

function businessDateInZone(iso: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(iso)
}

function derivePaymentStatus(totalPaise: bigint, paidPaise: bigint): 'pending' | 'partial' | 'paid' {
  if (paidPaise <= 0n) return 'pending'
  if (paidPaise >= totalPaise) return 'paid'
  return 'partial'
}

type PaymentRow = typeof payments.$inferSelect

/** Convert bigint paise fields to decimal strings at the JSON boundary (Fastify cannot serialize BigInt). */
function serializePayment(row: PaymentRow) {
  return {
    ...row,
    amountPaise: row.amountPaise.toString(),
  }
}

export function registerPaymentRoutes(app: FastifyInstance, db: DbResources['db']): void {
  app.get('/api/v1/orders/:orderId/payments', { preHandler: requireAuth }, async (request, reply) => {
    const shopId = request.auth!.shopId
    const orderId = (request.params as { orderId: string }).orderId
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), isNull(orders.deletedAt)))
      .limit(1)
    if (!order) return reply.code(404).send({ error: { code: 'not_found', message: 'Order not found' } })

    const rows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.shopId, shopId), eq(payments.orderId, orderId)))
      .orderBy(payments.paidAt)

    return { data: rows.map(serializePayment) }
  })

  app.post('/api/v1/orders/:orderId/payments', { preHandler: requireAuth }, async (request, reply) => {
    if (request.auth!.role === 'viewer') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Read-only access' } })
    }
    const parsed = paymentCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }

    const shopId = request.auth!.shopId
    const orderId = (request.params as { orderId: string }).orderId
    const amountPaise = BigInt(parsed.data.amountPaise)
    const paidAt = new Date(parsed.data.paidAt)

    try {
      const payment = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), isNull(orders.deletedAt)))
          .for('update')
          .limit(1)
        if (!order) throw new Error('not_found')
        if (order.paymentStatus === 'cancelled') throw new Error('order_cancelled')

        const [shop] = await tx.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, shopId)).limit(1)
        const timeZone = shop?.timezone ?? 'Asia/Kolkata'

        const [{ paidPaise }] = await tx
          .select({ paidPaise: sum(payments.amountPaise) })
          .from(payments)
          .where(
            and(eq(payments.shopId, shopId), eq(payments.orderId, orderId), eq(payments.status, 'valid')),
          )

        const paidSoFar = BigInt(paidPaise ?? 0)
        const nextPaid = paidSoFar + amountPaise
        if (nextPaid > order.totalPaise) throw new Error('overpayment')

        const [row] = await tx
          .insert(payments)
          .values({
            shopId,
            orderId,
            customerId: order.customerId,
            amountPaise,
            paidAt,
            businessDate: businessDateInZone(paidAt, timeZone),
            businessTimezone: timeZone,
            method: parsed.data.method,
            reference: parsed.data.reference ?? null,
            notes: parsed.data.notes ?? null,
            createdByUserId: request.auth!.userId,
          })
          .returning()

        const paymentStatus = derivePaymentStatus(order.totalPaise, nextPaid)
        await tx
          .update(orders)
          .set({ paymentStatus, updatedAt: new Date() })
          .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)))

        await tx.insert(auditLogs).values({
          shopId,
          actorUserId: request.auth!.userId,
          action: 'payment.recorded',
          entityType: 'payment',
          entityId: row!.id,
          after: { orderId, amountPaise: parsed.data.amountPaise },
        })

        return { payment: row!, outstandingPaise: Number(order.totalPaise - nextPaid) }
      })

      return reply.code(201).send({ data: { ...serializePayment(payment.payment), outstandingPaise: payment.outstandingPaise } })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'not_found') {
          return reply.code(404).send({ error: { code: 'not_found', message: 'Order not found' } })
        }
        if (error.message === 'overpayment') {
          return reply.code(400).send({ error: { code: 'overpayment', message: 'Payment exceeds outstanding balance' } })
        }
        if (error.message === 'order_cancelled') {
          return reply.code(400).send({ error: { code: 'order_cancelled', message: 'Cannot record payment on cancelled order' } })
        }
      }
      throw error
    }
  })

  app.post('/api/v1/payments/:paymentId/void', { preHandler: requireAuth }, async (request, reply) => {
    if (request.auth!.role !== 'owner' && request.auth!.role !== 'manager') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Manager access required' } })
    }
    const parsed = paymentVoidSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }
    const shopId = request.auth!.shopId
    const paymentId = (request.params as { paymentId: string }).paymentId

    try {
      await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.shopId, shopId), eq(payments.id, paymentId), eq(payments.status, 'valid')))
        .for('update')
        .limit(1)
      if (!payment) throw new Error('not_found')

      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.shopId, shopId), eq(orders.id, payment.orderId)))
        .for('update')
        .limit(1)
      if (!order) throw new Error('order_missing')

      await tx
        .update(payments)
        .set({
          status: 'voided',
          voidedAt: new Date(),
          voidedByUserId: request.auth!.userId,
          voidReason: parsed.data.reason,
        })
        .where(and(eq(payments.shopId, shopId), eq(payments.id, paymentId)))

      const [{ paidPaise }] = await tx
        .select({ paidPaise: sum(payments.amountPaise) })
        .from(payments)
        .where(
          and(
            eq(payments.shopId, shopId),
            eq(payments.orderId, payment.orderId),
            eq(payments.status, 'valid'),
          ),
        )

      const paid = BigInt(paidPaise ?? 0)
      await tx
        .update(orders)
        .set({
          paymentStatus: derivePaymentStatus(order.totalPaise, paid),
          updatedAt: new Date(),
        })
        .where(and(eq(orders.shopId, shopId), eq(orders.id, payment.orderId)))

      await tx.insert(auditLogs).values({
        shopId,
        actorUserId: request.auth!.userId,
        action: 'payment.voided',
        entityType: 'payment',
        entityId: paymentId,
        before: { status: 'valid' },
        after: { status: 'voided', reason: parsed.data.reason },
      })
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'not_found') {
        return reply.code(404).send({ error: { code: 'not_found', message: 'Payment not found' } })
      }
      if (error instanceof Error && error.message === 'order_missing') {
        return reply.code(500).send({ error: { code: 'order_missing', message: 'Linked order not found' } })
      }
      throw error
    }

    return { success: true }
  })
}
