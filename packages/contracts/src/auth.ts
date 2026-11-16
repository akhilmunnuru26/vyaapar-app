import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8),
})

export type LoginBody = z.infer<typeof loginBodySchema>

export const membershipRoleSchema = z.enum(['owner', 'manager', 'staff', 'viewer'])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
})

export const activeShopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  role: membershipRoleSchema,
})

export const authMeResponseSchema = z.object({
  user: authUserSchema,
  shop: activeShopSchema,
})

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
