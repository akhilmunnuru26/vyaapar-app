import { z } from 'zod'

const paise = z.number().int().nonnegative()

export const orderItemInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitPricePaise: paise,
  sku: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export const orderCreateSchema = z.object({
  customerId: z.string().uuid(),
  orderNumber: z.string().trim().min(1).max(64).optional(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  discountPaise: paise.default(0),
  notes: z.string().max(5000).optional(),
  items: z.array(orderItemInputSchema).min(1),
})

export const orderUpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  discountPaise: paise.optional(),
  notes: z.string().max(5000).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1).optional(),
})

export type OrderCreate = z.infer<typeof orderCreateSchema>
export type OrderUpdate = z.infer<typeof orderUpdateSchema>
