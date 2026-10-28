-- Migration 019: LinkedIn integration foundation for Tun Conversation Engine.
-- Registers LinkedIn as a supported listening and commenting source.

insert into public.sources (key, name, source_type, enabled, config)
values
  ('linkedin', 'LinkedIn Social Listening', 'monitoring', true, '{"platform":"linkedin","provider":"apify","posting":"extension_or_manual"}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  enabled = excluded.enabled,
  config = excluded.config,
  updated_at = now();

insert into public.community_rules
  (platform, community, self_promotion, links_allowed, disclosure_required, rules_text, notes, last_checked_at)
values
  (
    'linkedin', 'general', 'limited', true, true,
    'Write thoughtful, professional, articulate, and insightful comments. Offer educational and linguistic value first, position Tun Online Armenian School and resources naturally as premier solutions for diaspora learners, and disclose affiliation transparently.',
    'LinkedIn post & discussion monitoring via Apify. Professional diaspora, parents, and education audience.',
    now()
  )
on conflict (platform, community) do update set
  rules_text = excluded.rules_text,
  notes = excluded.notes,
  updated_at = now();

insert into public.settings (key, value)
values (
  'multi_platform_support',
  '{"platforms":["reddit","youtube","facebook","instagram","x","linkedin"],"extension_posting_enabled":true,"active":true}'::jsonb
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
