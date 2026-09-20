-- Optional development seed. Safe to skip in production.
-- Creates one synthetic Reddit-style opportunity so the live Supabase/OpenAI pipeline
-- can be tested before Syften credentials arrive.

with source_row as (
  insert into public.sources (key, name, source_type, enabled)
  values ('manual_test', 'Manual Test', 'development', true)
  on conflict (key) do update set enabled = true
  returning id
)
insert into public.opportunities (
  source_id,
  external_id,
  platform,
  community,
  author,
  title,
  content,
  original_url,
  status,
  matched_filter,
  raw_payload
)
select
  id,
  'manual-test-001',
  'reddit',
  'r/hayeren',
  'test_user',
  'Where should I start with Western Armenian?',
  'My grandparents spoke Western Armenian and I would really like to learn. I am a complete beginner. Where should I start?',
  null,
  'new',
  'development seed',
  '{"synthetic":true}'::jsonb
from source_row
on conflict (source_id, external_id) do update set
  title = excluded.title,
  content = excluded.content,
  status = 'new',
  updated_at = now();
