import { orderCreateSchema, orderUpdateSchema } from '@retail-management/contracts'
import {
  customers,
  orderItems,
  orders,
  payments,
  type DbResources,
} from '@retail-management/db'
import { and, desc, eq, ilike, isNull, or, sql, sum } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAuth } from './auth.js'

function denyWrite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth!.role === 'viewer') {
    void reply.code(403).send({ error: { code: 'forbidden', message: 'Read-only access' } })
    return true
  }
  return false
}

function derivePaymentStatus(totalPaise: bigint, paidPaise: bigint): 'pending' | 'partial' | 'paid' {
  if (paidPaise <= 0n) return 'pending'
  if (paidPaise >= totalPaise) return 'paid'
  return 'partial'
}

function orderTotals(items: { quantity: number; unitPricePaise: number }[], discountPaise: number) {
  const subtotalPaise = items.reduce(
    (acc, item) => acc + BigInt(item.quantity) * BigInt(item.unitPricePaise),
    0n,
  )
  const discount = BigInt(discountPaise)
  const totalPaise = subtotalPaise - discount
  if (totalPaise < 0n) throw new Error('invalid_total')
  return { subtotalPaise, discountPaise: discount, totalPaise }
}

type OrderRow = typeof orders.$inferSelect
type OrderItemRow = typeof orderItems.$inferSelect

/** Convert bigint paise fields to decimal strings at the JSON boundary (Fastify cannot serialize BigInt). */
function serializeOrder(row: OrderRow) {
  return {
    ...row,
    subtotalPaise: row.subtotalPaise.toString(),
    discountPaise: row.discountPaise.toString(),
    totalPaise: row.totalPaise.toString(),
  }
}

function serializeOrderItem(row: OrderItemRow) {
  return {
    ...row,
    unitPricePaise: row.unitPricePaise.toString(),
    lineTotalPaise: row.lineTotalPaise.toString(),
  }
}

export function registerOrderRoutes(app: FastifyInstance, db: DbResources['db']): void {
  app.get('/api/v1/orders', { preHandler: requireAuth }, async (request) => {
    const shopId = request.auth!.shopId
    const query = request.query as { q?: string; status?: string }
    const q = (query.q ?? '').trim()
    const status = query.status

    const paidSq = db
      .select({
        orderId: payments.orderId,
        paidPaise: sum(payments.amountPaise).as('paid_paise'),
      })
      .from(payments)
      .where(and(eq(payments.shopId, shopId), eq(payments.status, 'valid')))
      .groupBy(payments.orderId)
      .as('paid_sq')

    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderDate: orders.orderDate,
        dueDate: orders.dueDate,
        paymentStatus: orders.paymentStatus,
        totalPaise: orders.totalPaise,
        customerName: customers.name,
        customerPhone: customers.phoneE164,
        paidPaise: sql<string>`coalesce(${paidSq.paidPaise}, 0)`,
        itemsSummary: sql<string>`(
          select string_agg(${orderItems.description}, ', ')
          from ${orderItems}
          where ${orderItems.shopId} = ${orders.shopId}
            and ${orderItems.orderId} = ${orders.id}
        )`,
      })
      .from(orders)
      .innerJoin(customers, and(eq(customers.shopId, shopId), eq(customers.id, orders.customerId)))
      .leftJoin(paidSq, eq(paidSq.orderId, orders.id))
      .where(
        and(
          eq(orders.shopId, shopId),
          isNull(orders.deletedAt),
          q
            ? or(
                ilike(customers.name, `%${q}%`),
                ilike(customers.phoneE164, `%${q}%`),
                ilike(orders.orderNumber, `%${q}%`),
              )
            : undefined,
          status && status !== 'All orders' && status !== 'Overdue'
            ? eq(orders.paymentStatus, status.toLowerCase() as 'pending' | 'partial' | 'paid' | 'cancelled')
            : undefined,
        ),
      )
      .orderBy(desc(orders.orderDate))
      .limit(100)

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

    return {
      data: rows.map((row) => {
        const total = Number(row.totalPaise)
        const paid = Number(row.paidPaise ?? 0)
        const outstanding = total - paid
        const overdue =
          row.paymentStatus !== 'cancelled' &&
          outstanding > 0 &&
          row.dueDate != null &&
          String(row.dueDate) < today
        return {
          id: row.id,
          name: row.customerName,
          phone: row.customerPhone ?? '',
          items: row.itemsSummary ?? '',
          amountPaise: total,
          paidPaise: paid,
          outstandingPaise: outstanding,
          status: row.paymentStatus,
          statusLabel: row.paymentStatus.charAt(0).toUpperCase() + row.paymentStatus.slice(1),
          due: row.dueDate,
          overdue,
          orderNumber: row.orderNumber,
          orderDate: row.orderDate,
        }
      }),
    }
  })

  app.post('/api/v1/orders', { preHandler: requireAuth }, async (request, reply) => {
    if (denyWrite(request, reply)) return
    const parsed = orderCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }
    const shopId = request.auth!.shopId
    let totals
    try {
      totals = orderTotals(parsed.data.items, parsed.data.discountPaise)
    } catch {
      return reply.code(400).send({ error: { code: 'invalid_total', message: 'Order total cannot be negative' } })
    }

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.shopId, shopId),
          eq(customers.id, parsed.data.customerId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1)
    if (!customer) {
      return reply.code(400).send({ error: { code: 'invalid_customer', message: 'Customer not found in shop' } })
    }

    const orderNumber =
      parsed.data.orderNumber ??
      `YS-${parsed.data.orderDate.replaceAll('-', '')}-${Math.floor(Math.random() * 9000 + 1000)}`

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          shopId,
          customerId: parsed.data.customerId,
          orderNumber,
          orderDate: parsed.data.orderDate,
          dueDate: parsed.data.dueDate ?? null,
          paymentStatus: 'pending',
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          totalPaise: totals.totalPaise,
          notes: parsed.data.notes ?? null,
          createdByUserId: request.auth!.userId,
        })
        .returning()

      await tx.insert(orderItems).values(
        parsed.data.items.map((item) => ({
          shopId,
          orderId: order!.id,
          description: item.description,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unitPricePaise: BigInt(item.unitPricePaise),
          lineTotalPaise: BigInt(item.quantity) * BigInt(item.unitPricePaise),
          notes: item.notes ?? null,
        })),
      )

      return order!
    })

    return reply.code(201).send({ data: serializeOrder(result) })
  })

  app.get('/api/v1/orders/:orderId', { preHandler: requireAuth }, async (request, reply) => {
    const shopId = request.auth!.shopId
    const orderId = (request.params as { orderId: string }).orderId
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), isNull(orders.deletedAt)))
      .limit(1)
    if (!order) return reply.code(404).send({ error: { code: 'not_found', message: 'Order not found' } })

    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.shopId, shopId), eq(orderItems.orderId, orderId)))

    return { data: { ...serializeOrder(order), items: items.map(serializeOrderItem) } }
  })

  app.patch('/api/v1/orders/:orderId', { preHandler: requireAuth }, async (request, reply) => {
    if (denyWrite(request, reply)) return
    const parsed = orderUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'validation_error', details: parsed.error.flatten() } })
    }
    const shopId = request.auth!.shopId
    const orderId = (request.params as { orderId: string }).orderId

    try {
      await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), isNull(orders.deletedAt)))
        .for('update')
        .limit(1)
      if (!existing) throw new Error('not_found')

      let subtotalPaise = existing.subtotalPaise
      let discountPaise = existing.discountPaise
      let totalPaise = existing.totalPaise

      if (parsed.data.items) {
        const totals = orderTotals(
          parsed.data.items,
          parsed.data.discountPaise ?? Number(existing.discountPaise),
        )
        subtotalPaise = totals.subtotalPaise
        discountPaise = totals.discountPaise
        totalPaise = totals.totalPaise
        await tx.delete(orderItems).where(and(eq(orderItems.shopId, shopId), eq(orderItems.orderId, orderId)))
        await tx.insert(orderItems).values(
          parsed.data.items.map((item) => ({
            shopId,
            orderId,
            description: item.description,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPricePaise: BigInt(item.unitPricePaise),
            lineTotalPaise: BigInt(item.quantity) * BigInt(item.unitPricePaise),
            notes: item.notes ?? null,
          })),
        )
      } else if (parsed.data.discountPaise != null) {
        discountPaise = BigInt(parsed.data.discountPaise)
        totalPaise = subtotalPaise - discountPaise
        if (totalPaise < 0n) throw new Error('invalid_total')
      }

      const [{ paidPaise }] = await tx
        .select({ paidPaise: sum(payments.amountPaise) })
        .from(payments)
        .where(
          and(eq(payments.shopId, shopId), eq(payments.orderId, orderId), eq(payments.status, 'valid')),
        )

      const paid = BigInt(paidPaise ?? 0)
      if (paid > totalPaise) throw new Error('paid_exceeds_total')

      await tx
        .update(orders)
        .set({
          customerId: parsed.data.customerId ?? existing.customerId,
          orderDate: parsed.data.orderDate ?? existing.orderDate,
          dueDate: parsed.data.dueDate === undefined ? existing.dueDate : parsed.data.dueDate,
          notes: parsed.data.notes === undefined ? existing.notes : parsed.data.notes,
          subtotalPaise,
          discountPaise,
          totalPaise,
          paymentStatus: derivePaymentStatus(totalPaise, paid),
          updatedAt: new Date(),
        })
        .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)))
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'not_found') {
          return reply.code(404).send({ error: { code: 'not_found', message: 'Order not found' } })
        }
        if (error.message === 'invalid_total') {
          return reply.code(400).send({ error: { code: 'invalid_total', message: 'Order total cannot be negative' } })
        }
        if (error.message === 'paid_exceeds_total') {
          return reply
            .code(400)
            .send({ error: { code: 'paid_exceeds_total', message: 'Total cannot be below amount already paid' } })
        }
      }
      throw error
    }

    return reply.send({ success: true })
  })

  app.delete('/api/v1/orders/:orderId', { preHandler: requireAuth }, async (request, reply) => {
    if (request.auth!.role !== 'owner' && request.auth!.role !== 'manager') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Manager access required' } })
    }
    const shopId = request.auth!.shopId
    const orderId = (request.params as { orderId: string }).orderId
    const [row] = await db
      .update(orders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), isNull(orders.deletedAt)))
      .returning({ id: orders.id })
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Order not found' } })
    return { success: true }
  })
}
