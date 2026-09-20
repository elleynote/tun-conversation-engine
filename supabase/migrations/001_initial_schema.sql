create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  source_type text not null default 'monitoring',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  url text,
  intent_keys text[] not null default '{}',
  priority integer not null default 100,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  external_id text not null,
  platform text not null,
  community text,
  author text,
  title text,
  content text not null,
  original_url text,
  published_at timestamptz,
  detected_at timestamptz not null default now(),
  matched_filter text,
  status text not null default 'new' check (status in ('new','classified','qualified','ignored','drafted','awaiting_review','approved','rejected','posted','failed')),
  source_analysis jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists opportunities_status_idx on public.opportunities(status);
create index if not exists opportunities_detected_at_idx on public.opportunities(detected_at desc);
create index if not exists opportunities_platform_community_idx on public.opportunities(platform, community);

create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  relevance_score smallint not null check (relevance_score between 0 and 5),
  intent text not null,
  dialect text not null default 'unknown' check (dialect in ('western','eastern','unknown')),
  commercial_intent smallint not null default 0 check (commercial_intent between 0 and 5),
  recommended_product_key text,
  should_reply boolean not null default false,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  reason text not null default '',
  model text,
  prompt_version text,
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  community text not null,
  self_promotion text not null default 'unknown',
  links_allowed boolean,
  disclosure_required boolean,
  rules_text text not null default '',
  notes text not null default '',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, community)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  version integer not null default 1,
  body text not null,
  model text,
  status text not null default 'generated' check (status in ('generated','edited','approved','rejected','posted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (opportunity_id, version)
);

create index if not exists drafts_opportunity_version_idx on public.drafts(opportunity_id, version desc);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  action_type text not null,
  actor_user_id uuid,
  external_id text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check (severity in ('debug','info','warning','error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version text not null,
  content text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (key, version)
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS: the web app should use server-side service-role access for administrative operations.
-- Policies below allow authenticated reviewers to read; writes can remain server-side.
alter table public.sources enable row level security;
alter table public.products enable row level security;
alter table public.opportunities enable row level security;
alter table public.classifications enable row level security;
alter table public.community_rules enable row level security;
alter table public.drafts enable row level security;
alter table public.actions enable row level security;
alter table public.events enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.settings enable row level security;

create policy "authenticated read sources" on public.sources for select to authenticated using (true);
create policy "authenticated read products" on public.products for select to authenticated using (true);
create policy "authenticated read opportunities" on public.opportunities for select to authenticated using (true);
create policy "authenticated read classifications" on public.classifications for select to authenticated using (true);
create policy "authenticated read community rules" on public.community_rules for select to authenticated using (true);
create policy "authenticated read drafts" on public.drafts for select to authenticated using (true);
create policy "authenticated read actions" on public.actions for select to authenticated using (true);
create policy "authenticated read events" on public.events for select to authenticated using (true);
create policy "authenticated read prompt versions" on public.prompt_versions for select to authenticated using (true);

insert into public.sources (key, name, source_type)
values ('syften', 'Syften', 'monitoring')
on conflict (key) do nothing;
