-- AI TECH LAB MVP
-- Discovery and approval data for HQ. Automated ingestion is intentionally
-- service-side only; browser clients receive read access plus narrow RPCs.

create table public.mikkeos_ai_tech_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  publisher text not null,
  official_url text not null,
  feed_url text,
  source_kind text not null default 'official' check (source_kind in ('official', 'trusted_media')),
  priority smallint not null default 5 check (priority between 1 and 5),
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mikkeos_ai_tech_news (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.mikkeos_ai_tech_sources(id) on delete restrict,
  external_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  summary text not null default '',
  why_it_matters text not null default '',
  source_url text not null,
  category text not null check (category in ('ai_general', 'openai_codex', 'claude', 'google', 'image', 'web_ui', 'video', 'automation', 'new_tools')),
  importance_score smallint not null default 3 check (importance_score between 1 and 5),
  status text not null default 'published' check (status in ('published', 'hidden')),
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  unique (source_url)
);

create index mikkeos_ai_tech_news_published_idx
  on public.mikkeos_ai_tech_news(status, published_at desc nulls last);
create index mikkeos_ai_tech_news_category_idx
  on public.mikkeos_ai_tech_news(category, published_at desc nulls last);

create table public.mikkeos_ai_tech_candidates (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null unique references public.mikkeos_ai_tech_news(id) on delete cascade,
  category text not null check (category in ('image', 'web_ui', 'video', 'development', 'automation', 'content', 'new_feature')),
  use_places text[] not null default '{}',
  possible_use text not null,
  expected_benefit text not null default '',
  impact_score smallint not null default 3 check (impact_score between 1 and 5),
  confidence_score smallint not null default 3 check (confidence_score between 1 and 5),
  effort text not null default 'medium' check (effort in ('small', 'medium', 'large')),
  risk text not null default 'medium' check (risk in ('low', 'medium', 'high')),
  test_idea text not null default '',
  status text not null default 'candidate' check (status in ('candidate', 'approved_for_lab', 'held', 'dismissed')),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mikkeos_ai_tech_candidates_status_impact_idx
  on public.mikkeos_ai_tech_candidates(status, impact_score desc, evaluated_at desc);

create table public.mikkeos_ai_tech_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_number bigint generated always as identity unique,
  candidate_id uuid not null unique references public.mikkeos_ai_tech_candidates(id) on delete restrict,
  title text not null,
  objective text not null,
  test_plan text not null,
  safety_scope text not null default '本番環境へ接続せず、専用worktreeまたはダミー素材で検証する。',
  status text not null default 'approved' check (status in ('approved', 'running', 'result_ready', 'adopted', 'held', 'rejected')),
  result_summary text not null default '',
  quality_result text not null default '',
  mobile_result text not null default '',
  speed_result text not null default '',
  cost_result text not null default '',
  environment_risk text not null default '',
  recommendation text not null default '',
  implementation_item_id uuid references public.mikkeos_implementation_items(id) on delete set null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mikkeos_ai_tech_experiments_status_idx
  on public.mikkeos_ai_tech_experiments(status, updated_at desc);
create index mikkeos_ai_tech_experiments_implementation_item_idx
  on public.mikkeos_ai_tech_experiments(implementation_item_id)
  where implementation_item_id is not null;
create index mikkeos_ai_tech_experiments_approved_by_idx
  on public.mikkeos_ai_tech_experiments(approved_by);
create index mikkeos_ai_tech_experiments_decided_by_idx
  on public.mikkeos_ai_tech_experiments(decided_by)
  where decided_by is not null;

create table public.mikkeos_ai_tech_adoptions (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null unique references public.mikkeos_ai_tech_experiments(id) on delete restrict,
  title text not null,
  area text not null check (area in ('web', 'image', 'video', 'development', 'automation', 'content', 'product')),
  summary text not null,
  method_markdown text not null default '',
  codex_target_kind text not null default 'pending' check (codex_target_kind in ('pending', 'skill', 'agents', 'template', 'prompt', 'rule')),
  codex_target_path text,
  integration_status text not null default 'pending' check (integration_status in ('pending', 'documented', 'integrated', 'retired')),
  adopted_by uuid not null references auth.users(id) on delete restrict,
  adopted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mikkeos_ai_tech_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  title text not null,
  summary text not null,
  important_news_ids uuid[] not null default '{}',
  candidate_ids uuid[] not null default '{}',
  experiment_ids uuid[] not null default '{}',
  adoption_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mikkeos_ai_tech_adoptions_adopted_by_idx
  on public.mikkeos_ai_tech_adoptions(adopted_by);

create or replace function public.mikkeos_ai_tech_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'mikkeos_ai_tech_sources',
    'mikkeos_ai_tech_news',
    'mikkeos_ai_tech_candidates',
    'mikkeos_ai_tech_experiments',
    'mikkeos_ai_tech_adoptions',
    'mikkeos_ai_tech_weekly_reports'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.mikkeos_ai_tech_touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end;
$$;

alter table public.mikkeos_ai_tech_sources enable row level security;
alter table public.mikkeos_ai_tech_news enable row level security;
alter table public.mikkeos_ai_tech_candidates enable row level security;
alter table public.mikkeos_ai_tech_experiments enable row level security;
alter table public.mikkeos_ai_tech_adoptions enable row level security;
alter table public.mikkeos_ai_tech_weekly_reports enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'mikkeos_ai_tech_sources',
    'mikkeos_ai_tech_news',
    'mikkeos_ai_tech_candidates',
    'mikkeos_ai_tech_experiments',
    'mikkeos_ai_tech_adoptions',
    'mikkeos_ai_tech_weekly_reports'
  ]
  loop
    execute format(
      'create policy "Active HQ staff can read %1$s" on public.%1$I for select to authenticated using (exists (select 1 from public.mikkeos_hq_staff_members staff where staff.user_id = (select auth.uid()) and staff.is_active))',
      table_name
    );
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

grant select (id, source_key, name, publisher, official_url, feed_url, source_kind, priority, is_active, last_fetched_at, created_at, updated_at)
  on public.mikkeos_ai_tech_sources to authenticated;
grant select (id, source_id, title, summary, why_it_matters, source_url, category, importance_score, status, published_at, fetched_at, created_at, updated_at)
  on public.mikkeos_ai_tech_news to authenticated;
grant select on public.mikkeos_ai_tech_candidates to authenticated;
grant select on public.mikkeos_ai_tech_experiments to authenticated;
grant select on public.mikkeos_ai_tech_adoptions to authenticated;
grant select on public.mikkeos_ai_tech_weekly_reports to authenticated;

grant select, insert, update on
  public.mikkeos_ai_tech_sources,
  public.mikkeos_ai_tech_news,
  public.mikkeos_ai_tech_candidates,
  public.mikkeos_ai_tech_experiments,
  public.mikkeos_ai_tech_adoptions,
  public.mikkeos_ai_tech_weekly_reports
to service_role;

revoke all on sequence public.mikkeos_ai_tech_experiments_experiment_number_seq from public, anon, authenticated;
grant usage, select on sequence public.mikkeos_ai_tech_experiments_experiment_number_seq to service_role;

create or replace function public.mikkeos_ai_tech_approve_for_lab(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  experiment_id uuid;
begin
  if actor_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = actor_id and staff.is_active and staff.role in ('owner', 'admin')
  ) then
    raise exception 'AI TECH LAB approval permission required';
  end if;

  if not exists (
    select 1 from public.mikkeos_ai_tech_candidates candidate
    where candidate.id = p_candidate_id and candidate.status in ('candidate', 'held', 'approved_for_lab')
  ) then
    raise exception 'AI TECH LAB candidate unavailable';
  end if;

  insert into public.mikkeos_ai_tech_experiments as existing_experiment (
    candidate_id, title, objective, test_plan, approved_by
  )
  select
    candidate.id,
    news.title,
    candidate.possible_use,
    coalesce(nullif(candidate.test_idea, ''), '小規模な比較サンプルを作成し、品質・速度・費用・既存環境への影響を確認する。'),
    actor_id
  from public.mikkeos_ai_tech_candidates candidate
  join public.mikkeos_ai_tech_news news on news.id = candidate.news_id
  where candidate.id = p_candidate_id
  on conflict (candidate_id) do update
    set status = case
      when existing_experiment.status in ('held', 'rejected') then 'approved'
      else existing_experiment.status
    end,
    approved_by = actor_id,
    approved_at = now()
  returning id into experiment_id;

  update public.mikkeos_ai_tech_candidates
  set status = 'approved_for_lab'
  where id = p_candidate_id;

  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (actor_id, 'approve_for_lab', 'mikkeos_ai_tech_experiments', experiment_id, jsonb_build_object('candidate_id', p_candidate_id));

  return experiment_id;
end;
$$;

create or replace function public.mikkeos_ai_tech_decide_experiment(
  p_experiment_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  next_status text;
  adoption_area text;
begin
  if actor_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = actor_id and staff.is_active and staff.role in ('owner', 'admin')
  ) then
    raise exception 'AI TECH LAB decision permission required';
  end if;

  next_status := case p_decision
    when 'adopt' then 'adopted'
    when 'hold' then 'held'
    when 'reject' then 'rejected'
    else null
  end;
  if next_status is null then raise exception 'Invalid AI TECH LAB decision'; end if;

  if not exists (
    select 1 from public.mikkeos_ai_tech_experiments experiment
    where experiment.id = p_experiment_id and experiment.status in ('result_ready', 'held')
  ) then
    raise exception 'Experiment result is not ready for decision';
  end if;

  update public.mikkeos_ai_tech_experiments
  set status = next_status,
      decided_by = actor_id,
      decided_at = now(),
      decision_note = coalesce(trim(p_note), '')
  where id = p_experiment_id;

  if next_status = 'adopted' then
    select case candidate.category
      when 'web_ui' then 'web'
      when 'new_feature' then 'product'
      else candidate.category
    end
    into adoption_area
    from public.mikkeos_ai_tech_experiments experiment
    join public.mikkeos_ai_tech_candidates candidate on candidate.id = experiment.candidate_id
    where experiment.id = p_experiment_id;

    insert into public.mikkeos_ai_tech_adoptions as existing_adoption (
      experiment_id, title, area, summary, adopted_by
    )
    select experiment.id, experiment.title, adoption_area,
      coalesce(nullif(experiment.result_summary, ''), experiment.recommendation), actor_id
    from public.mikkeos_ai_tech_experiments experiment
    where experiment.id = p_experiment_id
    on conflict (experiment_id) do update
      set summary = excluded.summary,
          adopted_by = excluded.adopted_by,
          adopted_at = now(),
          integration_status = case
            when existing_adoption.integration_status = 'retired' then 'pending'
            else existing_adoption.integration_status
          end;
  end if;

  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (actor_id, 'decide_experiment', 'mikkeos_ai_tech_experiments', p_experiment_id, jsonb_build_object('decision', p_decision));

  return next_status;
end;
$$;

revoke all on function public.mikkeos_ai_tech_touch_updated_at() from public, anon, authenticated;
revoke all on function public.mikkeos_ai_tech_approve_for_lab(uuid) from public, anon;
revoke all on function public.mikkeos_ai_tech_decide_experiment(uuid, text, text) from public, anon;
grant execute on function public.mikkeos_ai_tech_approve_for_lab(uuid) to authenticated;
grant execute on function public.mikkeos_ai_tech_decide_experiment(uuid, text, text) to authenticated;

insert into public.mikkeos_ai_tech_sources (
  source_key, name, publisher, official_url, feed_url, source_kind, priority
)
values
  ('openai-news', 'OpenAI News', 'OpenAI', 'https://openai.com/news/', 'https://openai.com/news/rss.xml', 'official', 5),
  ('google-ai-developers', 'Google AI for Developers', 'Google', 'https://ai.google.dev/gemini-api/docs/changelog', 'https://developers.googleblog.com/feeds/posts/default', 'official', 5),
  ('github-changelog', 'GitHub Changelog', 'GitHub', 'https://github.blog/changelog/', 'https://github.blog/changelog/feed/', 'official', 5)
on conflict (source_key) do update
set name = excluded.name,
    publisher = excluded.publisher,
    official_url = excluded.official_url,
    feed_url = excluded.feed_url,
    source_kind = excluded.source_kind,
    priority = excluded.priority,
    is_active = true;

comment on table public.mikkeos_ai_tech_news is
  'Japanese AI news summaries for HQ; raw collection metadata is server-side only.';
comment on table public.mikkeos_ai_tech_candidates is
  'Practical mikkeOS use candidates selected from news before any experiment starts.';
comment on table public.mikkeos_ai_tech_experiments is
  'Small, isolated AI technology experiments requiring explicit HQ approval.';
comment on table public.mikkeos_ai_tech_adoptions is
  'Approved mikkeOS practices awaiting or completing Codex skill/rule/template integration.';
