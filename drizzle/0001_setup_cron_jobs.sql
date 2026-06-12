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