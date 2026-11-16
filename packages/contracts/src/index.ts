import { z } from 'zod'

export * from './auth.js'
export * from './customers.js'
export * from './orders.js'
export * from './payments.js'

export const paiseToRupees = (paise: number | bigint | string): number =>
  Number(paise) / 100

export const paymentStatusSchema = z.enum(['pending', 'partial', 'paid', 'cancelled'])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

/** Display rupees until API uses paise end-to-end in Batch 5. */
export const formatInr = (rupees: number): string =>
  `₹${rupees.toLocaleString('en-IN')}`
