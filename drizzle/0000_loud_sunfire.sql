CREATE TYPE "public"."menu_category" AS ENUM('Breakfast', 'Lunch', 'Snacks', 'Beverages');--> statement-breakpoint
CREATE TYPE "public"."counter_status" AS ENUM('ACTIVE', 'PRINTER_ISSUE', 'OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."dietary_type" AS ENUM('veg', 'non-veg');--> statement-breakpoint
CREATE TYPE "public"."otp_status" AS ENUM('PENDING', 'VERIFIED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('CASH', 'RAZORPAY', 'STRIPE', 'UPI');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."printer_type" AS ENUM('LAN', 'BT', 'USB', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."ticket_print_status" AS ENUM('PENDING', 'PRINTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('PENDING', 'READY', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_reference_type" AS ENUM('TOP_UP', 'TICKET_PURCHASE', 'REFUND', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'STAFF', 'ADMIN');--> statement-breakpoint
CREATE TABLE "counter_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counter_id" uuid NOT NULL,
	"previous_status" "counter_status",
	"new_status" "counter_status" NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counter_number" integer NOT NULL,
	"display_name" text NOT NULL,
	"status" "counter_status" DEFAULT 'ACTIVE' NOT NULL,
	"printer_type" "printer_type" DEFAULT 'NONE' NOT NULL,
	"printer_address" text,
	"device_identifier" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counters_counter_number_unique" UNIQUE("counter_number")
);
--> statement-breakpoint
CREATE TABLE "daily_ticket_sequences" (
	"current_date_prefix" varchar(6) PRIMARY KEY NOT NULL,
	"last_sequence_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_order_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"otp_code" varchar(6) NOT NULL,
	"status" "otp_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_order_otps_otp_code_unique" UNIQUE("otp_code"),
	CONSTRAINT "manual_otp_attempts_check" CHECK ("manual_order_otps"."attempts" <= 3)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"category" "menu_category" NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"dietary" "dietary_type" NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_price_check" CHECK ("menu_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_txn_id" text,
	"status" "payment_status" DEFAULT 'INITIATED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_items_qty_check" CHECK ("ticket_items"."quantity" > 0),
	CONSTRAINT "ticket_items_unit_price_check" CHECK ("ticket_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_reference" text,
	"user_id" uuid NOT NULL,
	"counter_id" uuid NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" "ticket_status" DEFAULT 'PENDING' NOT NULL,
	"print_status" "ticket_print_status" DEFAULT 'PENDING' NOT NULL,
	"print_error_reason" text,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticket_reference_unique" UNIQUE("ticket_reference"),
	CONSTRAINT "tickets_total_check" CHECK ("tickets"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_number" text NOT NULL,
	"reference_key" text NOT NULL,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"pin_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivation_reason" text,
	"credential_photo_url" text,
	"batch_year" integer DEFAULT 2026 NOT NULL,
	"expected_graduation_year" integer DEFAULT 2026 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_account_number_unique" UNIQUE("account_number"),
	CONSTRAINT "users_reference_key_unique" UNIQUE("reference_key"),
	CONSTRAINT "users_balance_check" CHECK ("users"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"reference_type" "transaction_reference_type" NOT NULL,
	"ticket_id" uuid,
	"payment_id" uuid,
	"description" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "wallet_txn_amount_check" CHECK ("wallet_transactions"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "counter_status_logs" ADD CONSTRAINT "counter_status_logs_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."counters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_order_otps" ADD CONSTRAINT "manual_order_otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."counters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;

-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job
-- This runs at minute 0 of every hour ('0 * * * *')
-- It deletes attempts older than 1 hour.
SELECT cron.schedule(
    'cleanup_expired_login_attempts', 
    '0 * * * *', 
    $$ DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 hour'; $$
);

-- =====================================================================
-- DATABASE TRIGGER ARTIFACTS FOR CORE CHECKOUT OPERATIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION generate_ticket_reference()
RETURNS TRIGGER AS $body$
DECLARE
    today_prefix TEXT;
    next_sequence INT;
    letter_block CHAR(1);
    num_suffix INT;
    suffix_string TEXT;
BEGIN
    today_prefix := to_char(CURRENT_DATE, 'YYMMDD');

    INSERT INTO daily_ticket_sequences (current_date_prefix, last_sequence_number)
    VALUES (today_prefix, 1)
    ON CONFLICT (current_date_prefix) 
    DO UPDATE SET last_sequence_number = daily_ticket_sequences.last_sequence_number + 1
    RETURNING last_sequence_number INTO next_sequence;

    letter_block := chr(65 + ((next_sequence - 1) / 9999));

    num_suffix := ((next_sequence - 1) % 9999) + 1;
    suffix_string := lpad(num_suffix::text, 4, '0');

    NEW.ticket_reference := today_prefix || letter_block || suffix_string;

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_item_availability()
RETURNS TRIGGER AS $body$
BEGIN
    IF EXISTS (
        SELECT 1 FROM menu_items 
        WHERE id = NEW.menu_item_id AND in_stock = FALSE
    ) THEN
        RAISE EXCEPTION 'Item is currently out of stock' USING ERRCODE = 'X0001';
    END IF;
    
    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION handle_ticket_checkout()
RETURNS TRIGGER AS $body$
DECLARE
    final_balance NUMERIC;
BEGIN
    UPDATE users 
    SET balance = balance - NEW.total_amount
    WHERE id = NEW.user_id
    RETURNING balance INTO final_balance;

    INSERT INTO wallet_transactions (
        id, user_id, type, amount, balance_after, reference_type, ticket_id, description, idempotency_key, created_at
    ) 
    VALUES (
        gen_random_uuid(), NEW.user_id, 'DEBIT', NEW.total_amount, final_balance, 'TICKET_PURCHASE', NEW.id, 'Canteen Checkout', gen_random_uuid(), NOW()
    );

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS tr_generate_ticket_ref ON tickets;
--> statement-breakpoint
CREATE TRIGGER tr_generate_ticket_ref
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_reference();
--> statement-breakpoint

DROP TRIGGER IF EXISTS tr_validate_items ON ticket_items;
--> statement-breakpoint
CREATE TRIGGER tr_validate_items
    BEFORE INSERT ON ticket_items
    FOR EACH ROW
    EXECUTE FUNCTION enforce_item_availability();
--> statement-breakpoint

DROP TRIGGER IF EXISTS tr_on_ticket_inserted ON tickets;
--> statement-breakpoint
CREATE TRIGGER tr_on_ticket_inserted
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION handle_ticket_checkout();