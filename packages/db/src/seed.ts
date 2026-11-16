import 'dotenv/config'
import * as argon2 from 'argon2'
import { eq } from 'drizzle-orm'
import { createDb } from './index.js'
import { shopMemberships, shopSettings, shops, users } from './schema.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed')
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
if (nodeEnv === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  throw new Error(
    'Refusing to seed production database. Set SEED_ALLOW_PRODUCTION=true only for intentional one-time bootstrap.',
  )
}

const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? 'owner@yuvrajsaree.local').toLowerCase()
const defaultDevPassword = 'ChangeMe-Dev-Only-8'
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? defaultDevPassword

if (nodeEnv === 'production') {
  if (!process.env.SEED_OWNER_PASSWORD || ownerPassword.length < 12) {
    throw new Error('SEED_OWNER_PASSWORD (min 12 characters) is required to seed production.')
  }
}

const YUVRAJ_SLUG = 'yuvraj-saree-center'

const { db, close } = createDb(databaseUrl)

const [existingShop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, YUVRAJ_SLUG)).limit(1)

const shopId =
  existingShop?.id ??
  (
    await db
      .insert(shops)
      .values({
        name: 'Yuvraj Saree Center',
        slug: YUVRAJ_SLUG,
        timezone: 'Asia/Kolkata',
        currencyCode: 'INR',
      })
      .returning({ id: shops.id })
  )[0]!.id

if (existingShop) {
  console.log(`Shop ${YUVRAJ_SLUG} already exists (${shopId}), skipping shop insert`)
}

await db
  .insert(shopSettings)
  .values({
    shopId,
    businessName: 'Yuvraj Saree Center',
    timezone: 'Asia/Kolkata',
    currencyCode: 'INR',
  })
  .onConflictDoNothing({ target: shopSettings.shopId })

const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1)

const ownerId =
  existingUser?.id ??
  (
    await db
      .insert(users)
      .values({
        name: 'Yuvraj Owner',
        email: ownerEmail,
        passwordHash: await argon2.hash(ownerPassword, { type: argon2.argon2id }),
      })
      .returning({ id: users.id })
  )[0]!.id

if (existingUser) {
  console.log(`Owner ${ownerEmail} already exists, password unchanged`)
}

await db
  .insert(shopMemberships)
  .values({ shopId, userId: ownerId, role: 'owner' })
  .onConflictDoNothing({ target: [shopMemberships.shopId, shopMemberships.userId] })

await close()
console.log(`Seeded shop ${YUVRAJ_SLUG} (${shopId}), owner ${ownerEmail}`)
