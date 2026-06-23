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

-- Schedule the stale ticket cleanup job
-- This runs every 5 minutes ('*/5 * * * *')
-- It marks tickets pending for > 10 minutes as CANCELLED and print FAILED
SELECT cron.schedule(
    'cleanup_stale_pending_tickets', 
    '*/5 * * * *', 
    $$ 
    UPDATE tickets
    SET 
        status = 'CANCELLED',
        print_status = 'FAILED',
        print_error_reason = 'PRINT_TIMEOUT_EXPIRED',
        updated_at = NOW()
    WHERE 
        status = 'PENDING'
        AND print_status = 'PENDING'
        AND created_at < NOW() - INTERVAL '10 minutes';
    $$
);