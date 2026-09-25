-- Reddit policy hardening from client/Riezal feedback (Sep 2026)
-- Adds subreddit-specific behavior, filters AutoModerator history,
-- refreshes brand voice, and confirms the verb tool URL.

update public.products
set
  url = 'https://armenianverbs.com/',
  description = 'Armenian verb-conjugation reference for tense, verb-form and conjugation lookups.',
  intent_keys = array['verb_question','verb_conjugation','past_tense','present_tense','future_tense','verb_form'],
  active = true,
  metadata = '{"claims":["Use for Armenian verb conjugation, tense, verb-form and verb-choice questions."],"awaiting_url":false}'::jsonb,
  updated_at = now()
where key = 'verbs';

insert into public.settings (key, value)
values (
  'brand_voice',
  '{"text":"Casual, helpful, friendly and human. Answer the actual question first. Do not sound corporate or salesy. Recommend at most one relevant Tun resource per thread unless the user clearly needs multiple tools. When recommending something we built, be transparent with natural wording such as \"we built...\" or \"we offer...\"."}'::jsonb
)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.community_rules
  (platform, community, self_promotion, links_allowed, disclosure_required, rules_text, notes, last_checked_at)
values
  (
    'reddit','hayeren','limited',true,true,
    'No formal subreddit rules were posted when reviewed. Keep participation genuine and self-promotion minimal.',
    'Most flexible monitored subreddit. Helpful answer first; one relevant resource only when it clearly helps.',
    now()
  ),
  (
    'reddit','armenian','prohibited',false,true,
    'This subreddit explicitly prohibits advertising and promotion. Never include Tun product links or promotional copy.',
    'Promotion blocked. Language questions may be redirected by moderators to r/hayeren.',
    now()
  ),
  (
    'reddit','armenia','limited',true,true,
    'Reply only when the discussion is genuinely about Armenia. Use Armenian or English only; no transliteration. Avoid off-topic language promotion.',
    'Strict topicality. Do not engage simply because Armenian language is mentioned.',
    now()
  ),
  (
    'reddit','languagelearning','prohibited',false,true,
    'Self-promotion of owned content/apps requires moderator permission. Provide a useful answer without direct Tun product links unless approval is obtained.',
    'Promotion blocked until moderator approval.',
    now()
  ),
  (
    'reddit','translator','prohibited',false,true,
    'Self-promotion/advertising is prohibited. AI-generated or machine translations are not allowed.',
    'manual_reply_only. A human reviewer must write the final reply; do not auto-generate a translation.',
    now()
  ),
  (
    'reddit','linguistics','prohibited',false,true,
    'Translation requests and language-learning advice are generally redirected elsewhere, and bots are prohibited.',
    'deprioritize_or_drop. Low-value target for automated engagement.',
    now()
  ),
  (
    'reddit','genealogy','limited',true,true,
    'Occasional self-promotion is acceptable only alongside genuine community contribution. No affiliate links or URL shorteners.',
    'Use full direct URLs only. Reply only when tied to genealogy, heritage, family-language or translation research.',
    now()
  ),
  (
    'reddit','askmiddleeast','limited',true,true,
    'English only. Conversation must be meaningfully related to the MENA region and the reply must add real value.',
    'Keep replies natural and low-pressure.',
    now()
  )
on conflict (platform, community) do update set
  self_promotion = excluded.self_promotion,
  links_allowed = excluded.links_allowed,
  disclosure_required = excluded.disclosure_required,
  rules_text = excluded.rules_text,
  notes = excluded.notes,
  last_checked_at = excluded.last_checked_at,
  updated_at = now();

-- Historical AutoModerator rows should never be surfaced as reply opportunities.
update public.opportunities
set
  status = 'ignored',
  suppression_reason = coalesce(suppression_reason, 'automoderator'),
  updated_at = now()
where lower(regexp_replace(coalesce(author,''), '^u/', '', 'i')) = 'automoderator'
  and status not in ('posted','approved','rejected');
