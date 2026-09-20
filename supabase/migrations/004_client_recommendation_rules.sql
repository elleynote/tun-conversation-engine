alter table public.classifications
  add column if not exists recommended_product_keys text[] not null default '{}',
  add column if not exists response_mode text not null default 'recommend_only',
  add column if not exists answer_confidence numeric(4,3) not null default 0;

alter table public.classifications drop constraint if exists classifications_response_mode_check;
alter table public.classifications
  add constraint classifications_response_mode_check
  check (response_mode in ('answer_and_recommend','recommend_only','answer_only','do_not_reply'));

update public.classifications
set recommended_product_keys = case
  when recommended_product_key is null then '{}'
  else array[recommended_product_key]
end
where cardinality(recommended_product_keys) = 0;

update public.products set
  name = 'Tun Online Armenian School',
  description = 'Structured Armenian learning for long-term speaking, reading, writing, grammar, vocabulary and dialect development.',
  url = 'https://tunapp.com/',
  intent_keys = array['learn_armenian','heritage_learning','parent_child_learning','speaking_confidence','dialect_learning','grammar_learning','literacy'],
  priority = 10,
  active = true,
  metadata = '{"offer":"Try 4 lessons for $1 where relevant.","claims":["Supports both Eastern and Western Armenian learning."]}'::jsonb,
  updated_at = now()
where key = 'tun_school';

update public.products set
  name = 'English to Armenian Translation',
  description = 'Instant Western Armenian translation and meaning support, positioned around linguistic accuracy.',
  url = 'https://translatearmenian.com/',
  intent_keys = array['translation','meaning','phrase_lookup'],
  priority = 20,
  active = true,
  metadata = '{"claims":["Focused on Western Armenian instant translation.","Use for immediate translation and meaning tasks."]}'::jsonb,
  updated_at = now()
where key = 'translator';

update public.products set
  name = 'Armenian Keyboard',
  description = 'Browser-based Armenian keyboard with separate Eastern and Western linguistic rules and defined phonetic conversion behavior.',
  url = 'https://armeniankeyboard.com/',
  intent_keys = array['typing_armenian','transliteration','armenian_script'],
  priority = 30,
  active = true,
  metadata = '{"claims":["Separate Eastern and Western rules are maintained where orthography, pronunciation, transliteration and verb forms differ.","Uses defined phonetic conversion rules rather than simple one-key character substitution."]}'::jsonb,
  updated_at = now()
where key = 'keyboard';

update public.products set
  name = 'Armenian Verb Conjugation Tool',
  description = 'Dedicated Armenian verb-conjugation reference for forms and tense lookups.',
  priority = 40,
  active = true,
  metadata = jsonb_build_object('awaiting_url', url is null),
  updated_at = now()
where key = 'verbs';

update public.products set active = false, updated_at = now() where key in ('dialect_quiz','social_network');

insert into public.settings (key, value)
values
  ('brand_voice', '{"text":"Helpful, warm, practical and human. Answer the person first when it is safe and accurate. Do not sound salesy. Be transparent when recommending a Tun resource."}'::jsonb),
  ('pipeline', '{"qualification_threshold":3,"auto_publish":false,"human_approval_required":true}'::jsonb),
  ('notifications', '{"channel":"dashboard","email":false,"slack":false}'::jsonb),
  ('response_policy', '{"default":"answer_and_recommend","low_answer_confidence":"recommend_only","sensitive":"do_not_reply","no_forced_promotion":true}'::jsonb),
  ('recommendation_rules', '{"priority_rule":"Tun for long-term learning; add utility only for a clear immediate task.","learn":"tun_school","translate":"translator","type":"keyboard","verbs":"verbs","multiple_tools_only_when_needed":true,"do_not_recommend":["culture_only","forced_promotion","sensitive_or_grieving","political","human_native_speaker_request_not_met","recent_duplicate_recommendation"]}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
