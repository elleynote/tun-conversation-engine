-- Client-approved launch-flow updates (Sep 22, 2026)
-- Applies revised recommendation rules, manual Reddit posting, verb tool URL,
-- first-person Tun voice, and requeues items previously ignored only because
-- the thread already had an answer.

update public.products
set
  url = 'https://armenianverbs.com/',
  description = 'Armenian verb-conjugation reference for tense, verb-form and conjugation lookups.',
  active = true,
  metadata = '{"claims":["Use for Armenian verb conjugation, tense, verb-form and verb-choice questions."],"awaiting_url":false}'::jsonb,
  updated_at = now()
where key = 'verbs';

insert into public.settings (key, value)
values
  ('brand_voice', '{"text":"Helpful, warm, practical and human. Speak as Tun and our own ecosystem using first-person language (we/our). Answer the person first when safe and accurate. Do not sound salesy. When the school offer is relevant, say: We offer 4 lessons for $1."}'::jsonb),
  ('response_policy', '{"default":"answer_and_recommend","low_answer_confidence":"recommend_only","sensitive":"do_not_reply","no_forced_promotion":true,"already_answered_can_still_reply":true,"add_distinct_value":true,"one_primary_reply_per_thread":true,"comment_reply_requires_human_promotion":true,"manual_reddit_posting":true}'::jsonb),
  ('recommendation_rules', '{"priority_rule":"Tun for long-term learning; add utilities for clear immediate tasks.","learn":"tun_school","translate":"translator","type":"keyboard","verbs":"verbs","verb_plus_translation":["verbs","translator"],"multiple_tools_only_when_needed":true,"already_answered_is_not_automatic_ignore":true,"one_primary_reply_per_thread":true,"comment_reply_requires_human_promotion":true,"do_not_recommend":["culture_only","forced_promotion","sensitive_or_grieving","political","human_native_speaker_request_not_met","recent_duplicate_recommendation"]}'::jsonb),
  ('launch_config', '{"domain":"https://scousi.com","reddit_posting":"manual","reddit_api_approved":false}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Remove the manual ".test" suffix used during earlier approval-flow testing.
update public.drafts
set body = regexp_replace(body, '\.?test\s*$', '', 'i')
where opportunity_id in (
  select id from public.opportunities where external_id = 'manual-test-001'
)
and body ~* '\.?test\s*$';

-- Requeue canonical threads that were ignored by the old strict
-- "already answered => do not reply" rule so v4 can evaluate them again.
update public.opportunities
set status = 'new', updated_at = now()
where id in (
  select c.opportunity_id
  from public.classifications c
  join public.opportunities o on o.id = c.opportunity_id
  where c.prompt_version = 'v3-thread-answer-gate'
    and o.suppression_reason is null
    and (c.reason ilike '%already%' or c.reason ilike '%answered%')
    and o.status = 'ignored'
);

delete from public.drafts
where opportunity_id in (
  select c.opportunity_id
  from public.classifications c
  join public.opportunities o on o.id = c.opportunity_id
  where c.prompt_version = 'v3-thread-answer-gate'
    and o.suppression_reason is null
    and (c.reason ilike '%already%' or c.reason ilike '%answered%')
);

delete from public.classifications
where prompt_version = 'v3-thread-answer-gate'
  and opportunity_id in (
    select id from public.opportunities
    where suppression_reason is null
      and status = 'new'
  );
