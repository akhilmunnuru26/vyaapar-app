CREATE TYPE "public"."membership_role" AS ENUM('owner', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'bank_transfer', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('valid', 'voided');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('pending', 'partial', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shop_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template_status" AS ENUM('approved', 'pending', 'rejected', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text,
	"alternate_phone_e164" text,
	"email" text,
	"address" text,
	"whatsapp_transactional_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_transactional_opt_in_at" timestamp with time zone,
	"whatsapp_transactional_opt_in_source" text,
	"whatsapp_marketing_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_marketing_opt_in_at" timestamp with time zone,
	"whatsapp_marketing_opt_in_source" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_shop_id_id_key" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"payment_id" uuid,
	"template_id" uuid,
	"direction" "message_direction" NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"to_phone_e164" text,
	"from_phone_e164" text,
	"template_name" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_message_id" text,
	"idempotency_key" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_shop_id_id_key" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"description" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"line_total_paise" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_shop_id_id_key" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"order_date" date NOT NULL,
	"due_date" date,
	"payment_status" "order_payment_status" DEFAULT 'pending' NOT NULL,
	"subtotal_paise" bigint NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_shop_id_id_key" UNIQUE("shop_id","id"),
	CONSTRAINT "orders_shop_order_number_key" UNIQUE("shop_id","order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"business_date" date NOT NULL,
	"business_timezone" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"notes" text,
	"status" "payment_record_status" DEFAULT 'valid' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	"void_reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_shop_id_id_key" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "sessions_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE "shop_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_memberships_shop_id_id_key" UNIQUE("shop_id","id"),
	CONSTRAINT "shop_memberships_shop_user_key" UNIQUE("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency_code" char(3) DEFAULT 'INR' NOT NULL,
	"default_payment_terms_days" integer,
	"reminder_template_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency_code" char(3) DEFAULT 'INR' NOT NULL,
	"status" "shop_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone_e164" text,
	"password_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"provider" text DEFAULT 'meta_cloud_api' NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"display_phone_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"access_token_secret_ref" text NOT NULL,
	"webhook_verify_token_secret_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_accounts_phone_number_id_unique" UNIQUE("phone_number_id"),
	CONSTRAINT "whatsapp_accounts_shop_id_key" UNIQUE("shop_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"language_code" text DEFAULT 'en' NOT NULL,
	"category" text NOT NULL,
	"status" "whatsapp_template_status" NOT NULL,
	"body" text NOT NULL,
	"meta_template_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_templates_shop_id_id_key" UNIQUE("shop_id","id"),
	CONSTRAINT "whatsapp_templates_shop_name_lang_key" UNIQUE("shop_id","name","language_code")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_customer_id_customers_shop_id_id_fk" FOREIGN KEY ("shop_id","customer_id") REFERENCES "public"."customers"("shop_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_payment_id_payments_shop_id_id_fk" FOREIGN KEY ("shop_id","payment_id") REFERENCES "public"."payments"("shop_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_template_id_whatsapp_message_templates_shop_id_id_fk" FOREIGN KEY ("shop_id","template_id") REFERENCES "public"."whatsapp_message_templates"("shop_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_customer_id_customers_shop_id_id_fk" FOREIGN KEY ("shop_id","customer_id") REFERENCES "public"."customers"("shop_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_customer_id_customers_shop_id_id_fk" FOREIGN KEY ("shop_id","customer_id") REFERENCES "public"."customers"("shop_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_reminder_template_id_whatsapp_message_templates_shop_id_id_fk" FOREIGN KEY ("shop_id","reminder_template_id") REFERENCES "public"."whatsapp_message_templates"("shop_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_shop_created_at_idx" ON "audit_logs" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_shop_entity_idx" ON "audit_logs" USING btree ("shop_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_at_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_shop_phone_active_idx" ON "customers" USING btree ("shop_id","phone_e164") WHERE "customers"."phone_e164" is not null and "customers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customers_shop_name_idx" ON "customers" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "customers_shop_deleted_at_idx" ON "customers" USING btree ("shop_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_shop_idempotency_idx" ON "messages" USING btree ("shop_id","idempotency_key") WHERE "messages"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_provider_message_id_idx" ON "messages" USING btree ("provider_message_id") WHERE "messages"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_shop_created_at_idx" ON "messages" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_shop_customer_created_at_idx" ON "messages" USING btree ("shop_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_shop_status_idx" ON "messages" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "order_items_shop_order_idx" ON "order_items" USING btree ("shop_id","order_id");--> statement-breakpoint
CREATE INDEX "order_items_shop_sku_idx" ON "order_items" USING btree ("shop_id","sku");--> statement-breakpoint
CREATE INDEX "orders_shop_order_date_idx" ON "orders" USING btree ("shop_id","order_date");--> statement-breakpoint
CREATE INDEX "orders_shop_due_date_idx" ON "orders" USING btree ("shop_id","due_date");--> statement-breakpoint
CREATE INDEX "orders_shop_payment_status_idx" ON "orders" USING btree ("shop_id","payment_status");--> statement-breakpoint
CREATE INDEX "orders_shop_customer_idx" ON "orders" USING btree ("shop_id","customer_id");--> statement-breakpoint
CREATE INDEX "orders_shop_deleted_at_idx" ON "orders" USING btree ("shop_id","deleted_at");--> statement-breakpoint
CREATE INDEX "payments_shop_paid_at_idx" ON "payments" USING btree ("shop_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_shop_business_date_idx" ON "payments" USING btree ("shop_id","business_date");--> statement-breakpoint
CREATE INDEX "payments_shop_order_idx" ON "payments" USING btree ("shop_id","order_id");--> statement-breakpoint
CREATE INDEX "payments_shop_customer_idx" ON "payments" USING btree ("shop_id","customer_id");--> statement-breakpoint
CREATE INDEX "payments_shop_status_idx" ON "payments" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_revoked_at_idx" ON "sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "shop_memberships_user_status_idx" ON "shop_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "shop_memberships_shop_role_idx" ON "shop_memberships" USING btree ("shop_id","role");--> statement-breakpoint
CREATE INDEX "shop_memberships_shop_status_idx" ON "shop_memberships" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "shops_status_idx" ON "shops" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_shop_status_idx" ON "whatsapp_accounts" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "whatsapp_templates_shop_status_idx" ON "whatsapp_message_templates" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "whatsapp_templates_shop_category_idx" ON "whatsapp_message_templates" USING btree ("shop_id","category");