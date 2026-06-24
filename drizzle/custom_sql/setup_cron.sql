CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint

-- Purges login attempts older than 1 hour every hour on the hour
SELECT cron.schedule(
    'cleanup_expired_login_attempts', 
    '0 * * * *', 
    $$ DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 hour'; $$
);
--> statement-breakpoint

-- Cancels tickets stuck in PENDING status for over 10 minutes every 5 minutes
SELECT cron.schedule(
    'cleanup_stale_pending_tickets', 
    '*/5 * * * *', 
    $$ 
    UPDATE tickets
    SET 
        status = 'CANCELLED',
        print_error_reason = 'PRINT_TIMEOUT_EXPIRED',
        updated_at = NOW()
    WHERE 
        status = 'PENDING'
        AND created_at < NOW() - INTERVAL '10 minutes';
    $$
);