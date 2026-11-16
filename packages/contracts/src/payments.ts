import { z } from 'zod'

export const paymentMethodSchema = z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other'])

export const paymentCreateSchema = z.object({
  amountPaise: z.number().int().positive(),
  paidAt: z.string().datetime(),
  method: paymentMethodSchema,
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
})

export const paymentVoidSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type PaymentCreate = z.infer<typeof paymentCreateSchema>
