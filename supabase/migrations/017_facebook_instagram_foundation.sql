-- Migration 017: Facebook and Instagram integration foundation for Tun Conversation Engine.
-- Registers Facebook and Instagram as supported listening sources and sets default community rules.

insert into public.sources (key, name, source_type, enabled, config)
values
  ('facebook', 'Facebook Social Listening', 'monitoring', true, '{"platform":"facebook","posting":"extension_or_manual"}'::jsonb),
  ('instagram', 'Instagram Social Listening', 'monitoring', true, '{"platform":"instagram","posting":"extension_or_manual"}'::jsonb)
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
    'facebook', 'general', 'limited', true, true,
    'Engage genuinely in diaspora groups and community discussions. Answer the language question directly before mentioning Tun resources. Be respectful of group rules.',
    'Facebook group and page monitoring. Useful Armenian language answer first; 1 relevant tool link only when helpful.',
    now()
  ),
  (
    'instagram', 'general', 'limited', true, true,
    'Keep comments concise, warm, helpful, and natural. Suitable for mobile readers. Disclose brand ownership transparently.',
    'Instagram hashtag and post monitoring. Punchy, friendly response.',
    now()
  )
on conflict (platform, community) do update set
  rules_text = excluded.rules_text,
  notes = excluded.notes,
  updated_at = now();

insert into public.settings (key, value)
values (
  'multi_platform_support',
  '{"platforms":["reddit","youtube","facebook","instagram"],"extension_posting_enabled":true,"active":true}'::jsonb
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
