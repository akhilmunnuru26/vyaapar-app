import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const shopStatusEnum = pgEnum('shop_status', ['active', 'suspended', 'closed'])
export const userStatusEnum = pgEnum('user_status', ['active', 'disabled'])
export const membershipRoleEnum = pgEnum('membership_role', ['owner', 'manager', 'staff', 'viewer'])
export const membershipStatusEnum = pgEnum('membership_status', ['active', 'disabled'])
export const paymentStatusEnum = pgEnum('order_payment_status', [
  'pending',
  'partial',
  'paid',
  'cancelled',
])
export const paymentRecordStatusEnum = pgEnum('payment_record_status', ['valid', 'voided'])
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'other',
])
export const templateStatusEnum = pgEnum('whatsapp_template_status', [
  'approved',
  'pending',
  'rejected',
  'disabled',
])
export const messageDirectionEnum = pgEnum('message_direction', ['outbound', 'inbound'])
export const messageStatusEnum = pgEnum('message_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'received',
])

export const shops = pgTable(
  'shops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    currencyCode: char('currency_code', { length: 3 }).notNull().default('INR'),
    status: shopStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('shops_status_idx').on(table.status)],
)

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    phoneE164: text('phone_e164').unique(),
    passwordHash: text('password_hash').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    index('sessions_user_id_expires_at_idx').on(table.userId, table.expiresAt),
    index('sessions_expires_at_idx').on(table.expiresAt),
    index('sessions_revoked_at_idx').on(table.revokedAt),
  ],
)

export const shopMemberships = pgTable(
  'shop_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull(),
    status: membershipStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('shop_memberships_shop_id_id_key').on(table.shopId, table.id),
    unique('shop_memberships_shop_user_key').on(table.shopId, table.userId),
    index('shop_memberships_user_status_idx').on(table.userId, table.status),
    index('shop_memberships_shop_role_idx').on(table.shopId, table.role),
    index('shop_memberships_shop_status_idx').on(table.shopId, table.status),
  ],
)

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phoneE164: text('phone_e164'),
    alternatePhoneE164: text('alternate_phone_e164'),
    email: text('email'),
    address: text('address'),
    whatsappTransactionalOptIn: boolean('whatsapp_transactional_opt_in').notNull().default(false),
    whatsappTransactionalOptInAt: timestamp('whatsapp_transactional_opt_in_at', {
      withTimezone: true,
    }),
    whatsappTransactionalOptInSource: text('whatsapp_transactional_opt_in_source'),
    whatsappMarketingOptIn: boolean('whatsapp_marketing_opt_in').notNull().default(false),
    whatsappMarketingOptInAt: timestamp('whatsapp_marketing_opt_in_at', { withTimezone: true }),
    whatsappMarketingOptInSource: text('whatsapp_marketing_opt_in_source'),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('customers_shop_id_id_key').on(table.shopId, table.id),
    uniqueIndex('customers_shop_phone_active_idx')
      .on(table.shopId, table.phoneE164)
      .where(sql`${table.phoneE164} is not null and ${table.deletedAt} is null`),
    index('customers_shop_name_idx').on(table.shopId, table.name),
    index('customers_shop_deleted_at_idx').on(table.shopId, table.deletedAt),
  ],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull(),
    orderNumber: text('order_number').notNull(),
    orderDate: date('order_date').notNull(),
    dueDate: date('due_date'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    subtotalPaise: bigint('subtotal_paise', { mode: 'bigint' }).notNull(),
    discountPaise: bigint('discount_paise', { mode: 'bigint' }).notNull().default(sql`0`),
    totalPaise: bigint('total_paise', { mode: 'bigint' }).notNull(),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('orders_shop_id_id_key').on(table.shopId, table.id),
    unique('orders_shop_order_number_key').on(table.shopId, table.orderNumber),
    foreignKey({
      columns: [table.shopId, table.customerId],
      foreignColumns: [customers.shopId, customers.id],
    }).onDelete('restrict'),
    index('orders_shop_order_date_idx').on(table.shopId, table.orderDate),
    index('orders_shop_due_date_idx').on(table.shopId, table.dueDate),
    index('orders_shop_payment_status_idx').on(table.shopId, table.paymentStatus),
    index('orders_shop_customer_idx').on(table.shopId, table.customerId),
    index('orders_shop_deleted_at_idx').on(table.shopId, table.deletedAt),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').notNull(),
    description: text('description').notNull(),
    sku: text('sku'),
    quantity: integer('quantity').notNull().default(1),
    unitPricePaise: bigint('unit_price_paise', { mode: 'bigint' }).notNull(),
    lineTotalPaise: bigint('line_total_paise', { mode: 'bigint' }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('order_items_shop_id_id_key').on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }).onDelete('cascade'),
    index('order_items_shop_order_idx').on(table.shopId, table.orderId),
    index('order_items_shop_sku_idx').on(table.shopId, table.sku),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    amountPaise: bigint('amount_paise', { mode: 'bigint' }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    businessDate: date('business_date').notNull(),
    businessTimezone: text('business_timezone').notNull(),
    method: paymentMethodEnum('method').notNull(),
    reference: text('reference'),
    notes: text('notes'),
    status: paymentRecordStatusEnum('status').notNull().default('valid'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    voidReason: text('void_reason'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('payments_shop_id_id_key').on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.shopId, table.customerId],
      foreignColumns: [customers.shopId, customers.id],
    }).onDelete('restrict'),
    index('payments_shop_paid_at_idx').on(table.shopId, table.paidAt),
    index('payments_shop_business_date_idx').on(table.shopId, table.businessDate),
    index('payments_shop_order_idx').on(table.shopId, table.orderId),
    index('payments_shop_customer_idx').on(table.shopId, table.customerId),
    index('payments_shop_status_idx').on(table.shopId, table.status),
  ],
)

export const whatsappAccounts = pgTable(
  'whatsapp_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('meta_cloud_api'),
    wabaId: text('waba_id').notNull(),
    phoneNumberId: text('phone_number_id').notNull().unique(),
    displayPhoneNumber: text('display_phone_number'),
    status: text('status').notNull().default('active'),
    accessTokenSecretRef: text('access_token_secret_ref').notNull(),
    webhookVerifyTokenSecretRef: text('webhook_verify_token_secret_ref').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('whatsapp_accounts_shop_id_key').on(table.shopId),
    index('whatsapp_accounts_shop_status_idx').on(table.shopId, table.status),
  ],
)

export const whatsappMessageTemplates = pgTable(
  'whatsapp_message_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    languageCode: text('language_code').notNull().default('en'),
    category: text('category').notNull(),
    status: templateStatusEnum('status').notNull(),
    body: text('body').notNull(),
    metaTemplateId: text('meta_template_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('whatsapp_templates_shop_id_id_key').on(table.shopId, table.id),
    unique('whatsapp_templates_shop_name_lang_key').on(table.shopId, table.name, table.languageCode),
    index('whatsapp_templates_shop_status_idx').on(table.shopId, table.status),
    index('whatsapp_templates_shop_category_idx').on(table.shopId, table.category),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id'),
    orderId: uuid('order_id'),
    paymentId: uuid('payment_id'),
    templateId: uuid('template_id'),
    direction: messageDirectionEnum('direction').notNull(),
    channel: text('channel').notNull().default('whatsapp'),
    toPhoneE164: text('to_phone_e164'),
    fromPhoneE164: text('from_phone_e164'),
    templateName: text('template_name'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    providerMessageId: text('provider_message_id'),
    idempotencyKey: text('idempotency_key'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    status: messageStatusEnum('status').notNull().default('queued'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('messages_shop_id_id_key').on(table.shopId, table.id),
    uniqueIndex('messages_shop_idempotency_idx')
      .on(table.shopId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    uniqueIndex('messages_provider_message_id_idx')
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    foreignKey({
      columns: [table.shopId, table.customerId],
      foreignColumns: [customers.shopId, customers.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [table.shopId, table.paymentId],
      foreignColumns: [payments.shopId, payments.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [table.shopId, table.templateId],
      foreignColumns: [whatsappMessageTemplates.shopId, whatsappMessageTemplates.id],
    }).onDelete('set null'),
    index('messages_shop_created_at_idx').on(table.shopId, table.createdAt),
    index('messages_shop_customer_created_at_idx').on(table.shopId, table.customerId, table.createdAt),
    index('messages_shop_status_idx').on(table.shopId, table.status),
  ],
)

export const shopSettings = pgTable(
  'shop_settings',
  {
    shopId: uuid('shop_id')
      .primaryKey()
      .references(() => shops.id, { onDelete: 'cascade' }),
    businessName: text('business_name').notNull(),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    currencyCode: char('currency_code', { length: 3 }).notNull().default('INR'),
    defaultPaymentTermsDays: integer('default_payment_terms_days'),
    reminderTemplateId: uuid('reminder_template_id'),
    settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.shopId, table.reminderTemplateId],
      foreignColumns: [whatsappMessageTemplates.shopId, whatsappMessageTemplates.id],
    }).onDelete('set null'),
  ],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_shop_created_at_idx').on(table.shopId, table.createdAt),
    index('audit_logs_shop_entity_idx').on(table.shopId, table.entityType, table.entityId),
    index('audit_logs_actor_created_at_idx').on(table.actorUserId, table.createdAt),
  ],
)
