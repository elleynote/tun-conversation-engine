-- Client review-flow and routing update (Sep 26, 2026)
-- Records the no-login MVP decision, aligns verb routing with Elley's matrix,
-- and requeues pending review items so the latest classifier/drafter rules apply.

insert into public.settings (key, value)
values
  (
    'access_policy',
    '{"mode":"no_login","signup_enabled":false,"single_business_manual_access":true,"future_multi_business_auth":true}'::jsonb
  ),
  (
    'recommendation_rules',
    '{"learn":"tun_school","translate_immediate":"translator","type_immediate":"keyboard","verb_lookup":["tun_school","verbs"],"verb_plus_translation":["tun_school","verbs","translator"],"simple_one_off_translation":"translator_only","long_term_learning_priority":"tun_school","multiple_tools_only_when_jobs_cross":true,"culture_or_preservation_without_direct_language_need":"no_product_recommendation","already_answered_is_not_automatic_ignore":true,"one_primary_reply_per_thread":true}'::jsonb
  ),
  (
    'review_flow',
    '{"next_suggestion_enabled":true,"dismiss_enabled":true,"dismiss_removes_from_active_queue":true}'::jsonb
  )
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

-- Reprocess all non-final canonical opportunities with the updated routing.
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

-- The current "We agreed" test thread was approved during routing QA but not posted.
-- Requeue it so the updated Tun + verb tool + translator route can be verified.
delete from public.drafts
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and status <> 'posted'
);

delete from public.classifications
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and status <> 'posted'
);

update public.opportunities
set
  status = 'new',
  suppression_reason = null,
  updated_at = now()
where thread_key = 'reddit:1wmgohl'
  and status <> 'posted';
