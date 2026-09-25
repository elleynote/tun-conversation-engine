insert into public.products (key, name, description, url, intent_keys, priority, active, metadata)
values
  (
    'tun_school',
    'Tun Online Armenian School',
    'Structured Armenian learning for long-term speaking, reading, writing, grammar, vocabulary and dialect development.',
    'https://tunapp.com/',
    array['learn_armenian','heritage_learning','parent_child_learning','speaking_confidence','dialect_learning','grammar_learning','literacy'],
    10,
    true,
    '{"offer":"Try 4 lessons for $1 where relevant.","claims":["Supports both Eastern and Western Armenian learning."]}'::jsonb
  ),
  (
    'translator',
    'English to Armenian Translation',
    'Instant Western Armenian translation and meaning support, positioned around linguistic accuracy.',
    'https://translatearmenian.com/',
    array['translation','meaning','phrase_lookup'],
    20,
    true,
    '{"claims":["Focused on Western Armenian instant translation.","Use for immediate translation and meaning tasks."]}'::jsonb
  ),
  (
    'keyboard',
    'Armenian Keyboard',
    'Browser-based Armenian keyboard with separate Eastern and Western linguistic rules and defined phonetic conversion behavior.',
    'https://armeniankeyboard.com/',
    array['typing_armenian','transliteration','armenian_script'],
    30,
    true,
    '{"claims":["Separate Eastern and Western rules are maintained where orthography, pronunciation, transliteration and verb forms differ.","Uses defined phonetic conversion rules rather than simple one-key character substitution."]}'::jsonb
  ),
  (
    'verbs',
    'Armenian Verb Conjugation Tool',
    'Armenian verb-conjugation reference for tense, verb-form and conjugation lookups.',
    'https://armenianverbs.com/',
    array['verb_question','verb_conjugation','past_tense','present_tense','future_tense','verb_form'],
    40,
    true,
    '{"claims":["Use for Armenian verb conjugation, tense, verb-form and verb-choice questions."],"awaiting_url":false}'::jsonb
  ),
  ('dialect_quiz', 'Eastern / Western Armenian Quiz', 'Reserved for later approval.', null, array['dialect_choice'], 90, false, '{"status":"not_in_current_recommendation_rules"}'::jsonb),
  ('social_network', 'Armenian Social Network', 'Reserved for later approval.', null, array['practice_community'], 90, false, '{"status":"not_in_current_recommendation_rules"}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  url = excluded.url,
  intent_keys = excluded.intent_keys,
  priority = excluded.priority,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.settings (key, value)
values
  ('brand_voice', '{"text":"Casual, helpful, friendly and human. Answer the actual question first. Do not sound corporate or salesy. Recommend at most one relevant Tun resource per thread unless the user clearly needs multiple tools. When recommending something we built, be transparent with natural wording such as \"we built...\" or \"we offer...\"."}'::jsonb),
  ('pipeline', '{"qualification_threshold":3,"auto_publish":false,"human_approval_required":true}'::jsonb),
  ('notifications', '{"channel":"dashboard","email":false,"slack":false}'::jsonb),
  ('response_policy', '{"default":"answer_and_recommend","low_answer_confidence":"recommend_only","sensitive":"do_not_reply","no_forced_promotion":true}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
