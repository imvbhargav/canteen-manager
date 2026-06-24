-- Generates sequential atomic ticket references formatted as YYMMDDA0001
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

-- Blocks ticket item creation if the associated menu item is out of stock
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

-- Deducts order amount from user balance and creates a debit transaction log
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

-- Reverts user balance and logs a credit transaction when a ticket fails or cancels
CREATE OR REPLACE FUNCTION handle_ticket_refund()
RETURNS TRIGGER AS $body$
DECLARE
    final_balance NUMERIC;
BEGIN
    IF (NEW.status IN ('CANCELLED', 'FAILED') AND OLD.status NOT IN ('CANCELLED', 'FAILED')) THEN
        UPDATE users 
        SET balance = balance + NEW.total_amount
        WHERE id = NEW.user_id
        RETURNING balance INTO final_balance;

        INSERT INTO wallet_transactions (
            id, user_id, type, amount, balance_after, reference_type, ticket_id, description, idempotency_key, created_at
        ) 
        VALUES (
            gen_random_uuid(), 
            NEW.user_id, 
            'CREDIT', 
            NEW.total_amount, 
            final_balance, 
            'REFUND', 
            NEW.id, 
            CASE 
                WHEN NEW.status = 'CANCELLED' THEN 'Ticket Cancelled Refund'
                ELSE 'Print Failure Refund (' || COALESCE(NEW.print_error_reason, 'UNKNOWN') || ')'
            END, 
            gen_random_uuid(), 
            NOW()
        );
    END IF;

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
--> statement-breakpoint

DROP TRIGGER IF EXISTS tr_on_ticket_refund ON tickets;
--> statement-breakpoint
CREATE TRIGGER tr_on_ticket_refund
    AFTER UPDATE ON tickets
    FOR EACH ROW
    WHEN (NEW.status = 'CANCELLED' OR NEW.status = 'FAILED')
    EXECUTE FUNCTION handle_ticket_refund();