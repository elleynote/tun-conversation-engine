-- Correct Reddit root/comment flags for existing grouped rows.
-- A Reddit comment permalink has an extra path segment after the post slug:
-- /comments/{post_id}/{slug}/{comment_id}/
-- A root post stops after the slug.

update public.opportunities
set
  is_thread_root = case
    when original_url ~ '/comments/[^/]+/[^/]+/[^/?#]+/?([?#].*)?$' then false
    else true
  end,
  updated_at = now()
where thread_key is not null
  and original_url is not null
  and original_url like '%reddit.com/%';

-- Re-assert exactly one canonical processable row per non-final Reddit thread.
-- Prefer a true root post when present; otherwise keep the earliest detected row.
with ranked as (
  select
    id,
    row_number() over (
      partition by thread_key
      order by is_thread_root desc, detected_at asc, created_at asc
    ) as rn
  from public.opportunities
  where thread_key is not null
    and status not in ('approved','rejected','posted')
)
update public.opportunities o
set
  status = case when ranked.rn = 1 then 'new' else 'ignored' end,
  suppression_reason = case when ranked.rn = 1 then null else 'thread_context_only' end,
  updated_at = now()
from ranked
where o.id = ranked.id;
