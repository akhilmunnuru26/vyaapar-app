import { z } from 'zod'

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phoneE164: z.string().trim().min(8).max(20).optional(),
  alternatePhoneE164: z.string().trim().min(8).max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  whatsappTransactionalOptIn: z.boolean().optional(),
  whatsappMarketingOptIn: z.boolean().optional(),
})

export const customerUpdateSchema = customerCreateSchema.partial()

export type CustomerCreate = z.infer<typeof customerCreateSchema>
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>
