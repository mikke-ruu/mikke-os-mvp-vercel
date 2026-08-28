-- AI TECH LAB production-safe RLS and approval verification.
-- Requires the AI TECH LAB migration. All fixture rows are rolled back.

begin;

set local lock_timeout = '3s';
set local statement_timeout = '45s';
set local idle_in_transaction_session_timeout = '60s';

do $test$
declare
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_owner uuid := gen_random_uuid();
  v_analyst uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_source uuid;
  v_news uuid := gen_random_uuid();
  v_candidate uuid := gen_random_uuid();
  v_experiment uuid;
  v_count integer;
  v_allowed boolean;
begin
  insert into auth.users(id, email)
  values
    (v_owner, 'ai-tech-lab-owner-' || v_suffix || '@example.invalid'),
    (v_analyst, 'ai-tech-lab-analyst-' || v_suffix || '@example.invalid'),
    (v_outsider, 'ai-tech-lab-outsider-' || v_suffix || '@example.invalid');

  insert into public.mikkeos_hq_staff_members(user_id, role, is_active)
  values (v_owner, 'owner', true), (v_analyst, 'analyst', true);

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'mikkeos_ai_tech_%'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) <> 6 then
    raise exception 'AI TECH LAB RLS count mismatch';
  end if;

  if has_table_privilege('anon', 'public.mikkeos_ai_tech_sources', 'select')
    or has_function_privilege('anon', 'public.mikkeos_ai_tech_approve_for_lab(uuid)', 'execute')
    or has_function_privilege('anon', 'public.mikkeos_ai_tech_decide_experiment(uuid,text,text)', 'execute') then
    raise exception 'anon privilege boundary mismatch';
  end if;

  if has_column_privilege('authenticated', 'public.mikkeos_ai_tech_news', 'raw_metadata', 'select')
    or has_column_privilege('authenticated', 'public.mikkeos_ai_tech_news', 'external_id', 'select')
    or has_table_privilege('authenticated', 'public.mikkeos_ai_tech_sources', 'insert')
    or has_table_privilege('authenticated', 'public.mikkeos_ai_tech_candidates', 'update')
    or has_table_privilege('authenticated', 'public.mikkeos_ai_tech_experiments', 'delete') then
    raise exception 'browser privilege boundary mismatch';
  end if;

  if not has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'select')
    or not has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'insert')
    or not has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'update')
    or has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'delete')
    or has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'truncate')
    or has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'references')
    or has_table_privilege('service_role', 'public.mikkeos_ai_tech_news', 'trigger') then
    raise exception 'service role ingestion privilege mismatch';
  end if;

  select source.id into v_source
  from public.mikkeos_ai_tech_sources source
  where source.source_key = 'openai-news';

  insert into public.mikkeos_ai_tech_news(
    id, source_id, external_id, title, summary, why_it_matters,
    source_url, category, importance_score
  )
  values (
    v_news, v_source, 'rls-' || v_suffix, 'AI TECH LAB transaction test',
    'summary', 'why', 'https://example.invalid/ai-tech-lab-' || v_suffix,
    'openai_codex', 5
  );

  insert into public.mikkeos_ai_tech_candidates(
    id, news_id, category, use_places, possible_use, expected_benefit,
    impact_score, confidence_score, effort, risk, test_idea
  )
  values (
    v_candidate, v_news, 'development', array['Codex'], '承認フロー検証',
    '品質向上', 5, 5, 'small', 'low', 'fixture比較'
  );

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  v_allowed := true;
  begin
    perform 1 from public.mikkeos_ai_tech_sources;
  exception when others then
    v_allowed := false;
  end;
  if v_allowed then raise exception 'anon read AI TECH LAB'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.mikkeos_ai_tech_sources;
  if v_count <> 0 then raise exception 'nonstaff read AI TECH LAB'; end if;
  v_allowed := true;
  begin
    perform public.mikkeos_ai_tech_approve_for_lab(v_candidate);
  exception when others then
    v_allowed := false;
  end;
  if v_allowed then raise exception 'nonstaff approved LAB test'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_analyst, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_analyst::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.mikkeos_ai_tech_sources;
  if v_count <> 3 then raise exception 'analyst source visibility mismatch'; end if;
  v_allowed := true;
  begin
    perform public.mikkeos_ai_tech_approve_for_lab(v_candidate);
  exception when others then
    v_allowed := false;
  end;
  if v_allowed then raise exception 'analyst approved LAB test'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select public.mikkeos_ai_tech_approve_for_lab(v_candidate) into v_experiment;
  select count(*) into v_count
  from public.mikkeos_ai_tech_experiments experiment
  where experiment.id = v_experiment and experiment.status = 'approved';
  if v_count <> 1 then raise exception 'owner approval state mismatch'; end if;

  v_allowed := true;
  begin
    insert into public.mikkeos_ai_tech_sources(source_key, name, publisher, official_url)
    values ('browser-write', 'Browser', 'Browser', 'https://example.invalid');
  exception when others then
    v_allowed := false;
  end;
  if v_allowed then raise exception 'owner browser wrote source directly'; end if;

  execute 'reset role';
  update public.mikkeos_ai_tech_experiments experiment
  set status = 'result_ready', result_summary = 'fixture result', recommendation = '採用推奨'
  where experiment.id = v_experiment;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  if public.mikkeos_ai_tech_decide_experiment(v_experiment, 'adopt', 'transaction test') <> 'adopted' then
    raise exception 'owner adoption decision mismatch';
  end if;
  select count(*) into v_count
  from public.mikkeos_ai_tech_adoptions adoption
  where adoption.experiment_id = v_experiment;
  if v_count <> 1 then raise exception 'adoption ledger missing'; end if;

  execute 'reset role';
  select count(*) into v_count
  from public.mikkeos_hq_audit_logs audit
  where audit.entity_type = 'mikkeos_ai_tech_experiments'
    and audit.entity_id = v_experiment
    and audit.action in ('approve_for_lab', 'decide_experiment');
  if v_count <> 2 then raise exception 'AI TECH LAB audit count mismatch'; end if;

  raise notice 'AI TECH LAB RLS verification passed; transaction will roll back';
end
$test$;

rollback;
