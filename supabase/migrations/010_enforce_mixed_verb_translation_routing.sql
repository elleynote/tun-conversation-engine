-- Reprocess the known "We agreed" test thread after deterministic mixed
-- verb + translation routing was added to the classifier.

delete from public.drafts
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and suppression_reason is null
);

delete from public.classifications
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key = 'reddit:1wmgohl'
    and suppression_reason is null
);

update public.opportunities
set status = 'new',
    updated_at = now()
where thread_key = 'reddit:1wmgohl'
  and suppression_reason is null;
