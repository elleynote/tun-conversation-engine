-- Group Reddit posts/comments into one conversation opportunity.
-- Existing non-final Reddit rows are reset so the canonical thread can be reprocessed
-- with full thread context and sibling comments suppressed.

alter table public.opportunities
  add column if not exists thread_key text,
  add column if not exists is_thread_root boolean not null default true,
  add column if not exists suppression_reason text;

create index if not exists opportunities_thread_key_idx
  on public.opportunities(thread_key);

-- Backfill Reddit thread ids from standard Reddit post/comment URLs.
update public.opportunities
set
  thread_key = 'reddit:' || substring(original_url from '/comments/([^/]+)/'),
  is_thread_root = case
    when original_url ~ '/comments/[^/]+/[^/]+/?(\?.*)?$' then true
    else false
  end
where platform = 'reddit'
  and original_url is not null
  and original_url ~ '/comments/([^/]+)/';

-- Remove stale AI outputs for non-final grouped Reddit rows so they can be
-- evaluated once, using the full thread as context.
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

-- Prefer the actual Reddit post as the canonical opportunity. If Syften only
-- supplied comments, use the earliest detected item as the canonical row.
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
