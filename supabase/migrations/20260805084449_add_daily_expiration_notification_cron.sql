/*
# Add daily cron job for expiration notifications

1. Changes
   - Creates a pg_cron job that fires once per day at 08:00 UTC.
   - The job calls the `expiration-notifications` edge function via pg_net HTTP extension.

2. Notes
   - The job uses the service role key for authentication.
   - It runs daily and the edge function handles the logic for deciding
     which digest/alert emails to send based on user preferences.
*/

-- Remove existing job if re-running
SELECT cron.unschedule('daily-expiration-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-expiration-notifications'
);

-- Schedule daily at 08:00 UTC
SELECT cron.schedule(
  'daily-expiration-notifications',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/expiration-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
