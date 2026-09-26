-- YouTube foundation for Tun Conversation Engine.
-- No API credentials are stored in the database; YOUTUBE_API_KEY stays in Supabase secrets.

insert into public.sources (key, name, source_type, enabled, config)
values (
  'youtube_api',
  'YouTube Data API',
  'monitoring',
  true,
  '{"mode":"comment_ingestion","posting":"manual"}'::jsonb
)
on conflict (key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  enabled = excluded.enabled,
  config = excluded.config,
  updated_at = now();

insert into public.settings (key, value)
values (
  'youtube_integration',
  '{"enabled":false,"discovery":"syften","comment_ingestion":"youtube_data_api","posting":"manual","oauth_required_for_direct_posting":true}'::jsonb
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
