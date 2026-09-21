-- Scousi routing correction: mixed translation + verb/conjugation questions
-- must use Armenian Verb Conjugation Tool + English to Armenian Translation.

update public.products
set
  url = 'https://armenianverbs.com/',
  active = true,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"awaiting_url":false}'::jsonb,
  updated_at = now()
where key = 'verbs';

-- Requeue the current client-review thread so the v5 classifier can apply the
-- corrected deterministic route and regenerate the draft.
delete from public.drafts
where opportunity_id in (
  select id from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and suppression_reason is null
);

delete from public.classifications
where opportunity_id in (
  select id from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and suppression_reason is null
);

update public.opportunities
set status = 'new', updated_at = now()
where thread_key = 'reddit:1wmgohl'
  and suppression_reason is null;