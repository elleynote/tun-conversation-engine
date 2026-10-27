-- Migration 018: X (Twitter) integration foundation for Tun Conversation Engine.
-- Registers X / Twitter as a supported listening source and sets default community rules.

insert into public.sources (key, name, source_type, enabled, config)
values
  ('x', 'X (Twitter) Social Listening', 'monitoring', true, '{"platform":"x","posting":"extension_or_manual"}'::jsonb)
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
    'x', 'general', 'limited', true, true,
    'Keep replies concise, punchy, conversational, and strictly under 280 characters. Answer the question directly before adding a relevant Tun link. Disclose affiliation naturally.',
    'X (Twitter) real-time listening via Syften. Punchy, helpful reply under 280 chars.',
    now()
  )
on conflict (platform, community) do update set
  rules_text = excluded.rules_text,
  notes = excluded.notes,
  updated_at = now();

insert into public.settings (key, value)
values (
  'multi_platform_support',
  '{"platforms":["reddit","youtube","facebook","instagram","x"],"extension_posting_enabled":true,"active":true}'::jsonb
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
