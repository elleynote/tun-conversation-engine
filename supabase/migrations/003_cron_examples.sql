-- Optional scheduling examples.
-- Apply only after deploying Edge Functions and deciding how to store the service secret.
-- Supabase supports pg_cron and pg_net for scheduled HTTP calls.
-- Do NOT put service-role keys directly in source control.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recommended production approach:
-- 1. Store the project URL and a cron secret in Supabase Vault.
-- 2. Schedule `ingest-syften` every 1-2 minutes.
-- 3. Schedule `process-pipeline` every 1-2 minutes after ingestion.
--
-- Exact SQL is intentionally not activated until the project URL/secrets are known.
