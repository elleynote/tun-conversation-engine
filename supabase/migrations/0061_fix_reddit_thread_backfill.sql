-- Fix Reddit thread-key backfill for Syften records.
-- Do not depend on the platform field because Syften backend labels can vary.

update public.opportunities
set
  thread_key = 'reddit:' || (regexp_match(original_url, '/comments/([^/]+)/'))[1],
  is_thread_root = (
    original_url ~ '^https?://(www\.)?reddit\.com/r/[^/]+/comments/[^/]+/[^/]+/?(?:\?.*)?$'
  )
where original_url is not null
  and original_url ~ '^https?://(www\.)?reddit\.com/'
  and original_url ~ '/comments/[^/]+/';

-- Clear stale AI outputs for grouped Reddit rows that are not final decisions.
delete from public.drafts
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key is not null
    and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed')
);

delete from public.classifications
where opportunity_id in (
  select id
  from public.opportunities
  where thread_key is not null
    and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed')
);

-- Keep exactly one canonical row per Reddit thread.
-- Prefer the actual root post; otherwise use the earliest detected item.
with ranked as (
  select
    id,
    row_number() over (
      partition by thread_key
      order by is_thread_root desc, detected_at asc, created_at asc
    ) as rn
  from public.opportunities
  where thread_key is not null
    and status in ('new','classified','qualified','ignored','drafted','awaiting_review','failed')
)
update public.opportunities o
set
  status = case when ranked.rn = 1 then 'new' else 'ignored' end,
  suppression_reason = case when ranked.rn = 1 then null else 'thread_context_only' end,
  updated_at = now()
from ranked
where o.id = ranked.id;
