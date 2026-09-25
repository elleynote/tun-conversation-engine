-- Align live classification/drafting with Elley's recommendation matrix and
-- Riezal's latest Reddit brand-voice guidance.

insert into public.settings (key, value)
values
  (
    'brand_voice',
    '{"text":"Casual, helpful, friendly and human. Not corporate or salesy. Answer the actual question genuinely first. The reply should read like a knowledgeable person who knows a lot about Armenian, not like a company account. Only recommend once per thread. When an owned resource is genuinely relevant, disclose it naturally with wording such as \"we built...\" or \"we offer...\"."}'::jsonb
  ),
  (
    'response_policy',
    '{"default":"answer_and_recommend","low_answer_confidence":"recommend_only","sensitive":"do_not_reply","no_forced_promotion":true,"preservation_policy_without_direct_need":"answer_only","already_answered_can_still_reply":true,"add_distinct_value":true,"one_primary_reply_per_thread":true,"comment_reply_requires_human_promotion":true,"manual_reddit_posting":true}'::jsonb
  ),
  (
    'recommendation_rules',
    '{"learn":"tun_school","translate_immediate":"translator","type_immediate":"keyboard","verb_lookup":"verbs","simple_one_off_translation":"translator_only","long_term_learning_priority":"tun_school","multiple_tools_only_when_jobs_cross":true,"culture_or_preservation_without_direct_language_need":"no_product_recommendation","already_answered_is_not_automatic_ignore":true,"one_primary_reply_per_thread":true}'::jsonb
  )
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

-- Reprocess all non-final canonical opportunities so the existing dashboard
-- queue is regenerated with the latest client-approved rules.
delete from public.drafts
where opportunity_id in (
  select id
  from public.opportunities
  where suppression_reason is null
    and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed')
);

delete from public.classifications
where opportunity_id in (
  select id
  from public.opportunities
  where suppression_reason is null
    and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed')
);

update public.opportunities
set
  status = 'new',
  updated_at = now()
where suppression_reason is null
  and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed');
