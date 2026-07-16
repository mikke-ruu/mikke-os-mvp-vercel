-- Fund F5-b owner read model, stable source IDs, actor isolation, and
-- idempotent legacy-import save verification. All fixture data rolls back.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_owner_profile_id uuid;
  v_other_user_id uuid;
  first_project_id uuid;
  second_project_id uuid;
  visible_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  source_project_id text;
  source_plan_id text;
  project_payload jsonb;
  plan_payload jsonb;
begin
  select user_id, id into v_owner_user_id, v_owner_profile_id
  from public.profiles order by created_at limit 1;
  select user_id into v_other_user_id
  from public.profiles where user_id <> v_owner_user_id order by created_at limit 1;
  if v_owner_user_id is null or v_other_user_id is null then
    raise exception 'Fund F5-b test requires profiles for two different auth users';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fund_projects'
      and column_name = 'source_local_id'
      and is_nullable <> 'NO'
  ) then
    raise exception 'fund_projects.source_local_id is still nullable';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fund_projects'::regclass
      and conname = 'fund_projects_source_local_id_length_check'
      and pg_get_constraintdef(oid) like '%char_length(source_local_id) >= 1%'
      and pg_get_constraintdef(oid) like '%char_length(source_local_id) <= 160%'
  ) then
    raise exception 'fund_projects source ID length constraint is missing';
  end if;
  if has_table_privilege('anon', 'public.fund_projects', 'select')
    or has_table_privilege('anon', 'public.fund_plans', 'select') then
    raise exception 'anon can read owner-private Fund content';
  end if;

  source_project_id := 'fund-f5b-project-' || suffix;
  source_plan_id := 'fund-f5b-plan-' || suffix;
  project_payload := jsonb_build_object(
    'id', source_project_id,
    'slug', 'fund-f5b-' || suffix,
    'title', 'Fund F5-b first save',
    'shortDescription', 'Owner database read verification',
    'description', 'F5-b fixture',
    'projectType', 'course',
    'campaignType', 'early_application',
    'stage', 'campaign',
    'status', 'open',
    'visibility', 'private',
    'coverImageUrl', '',
    'goalType', 'supporters',
    'goalValue', 3,
    'displayAmount', false,
    'startAt', '',
    'endAt', '',
    'externalPaymentUrl', '',
    'externalApplicationUrl', '',
    'whyNow', '',
    'audience', '',
    'useOfSupport', '',
    'schedule', '',
    'riskNotes', '',
    'cancellationPolicy', '',
    'contactNote', ''
  );
  plan_payload := jsonb_build_array(jsonb_build_object(
    'id', source_plan_id,
    'title', 'Fund F5-b plan',
    'description', '',
    'imageUrl', '',
    'planType', 'early_application',
    'price', 1000,
    'quantityLimit', 3,
    'perPersonLimit', 1,
    'deliveryDate', '',
    'externalPaymentUrl', '',
    'externalApplicationUrl', '',
    'requiredInformationNote', '',
    'requiresShipping', false,
    'status', 'active',
    'sortOrder', 0
  ));

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  first_project_id := public.save_fund_project_content(v_owner_profile_id, project_payload, plan_payload);
  project_payload := jsonb_set(project_payload, '{title}', '"Fund F5-b second save"'::jsonb);
  second_project_id := public.save_fund_project_content(v_owner_profile_id, project_payload, plan_payload);

  if first_project_id <> second_project_id then
    raise exception 'same legacy source ID created a second database project';
  end if;
  select count(*) into visible_count
  from public.fund_projects
  where owner_profile_id = v_owner_profile_id
    and source_local_id = source_project_id
    and title = 'Fund F5-b second save';
  if visible_count <> 1 then
    raise exception 'owner source ID read or idempotent project update failed';
  end if;
  select count(*) into visible_count
  from public.fund_plans
  where project_id = first_project_id and source_local_id = source_plan_id;
  if visible_count <> 1 then
    raise exception 'idempotent save did not leave exactly one source plan';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count
  from public.fund_projects
  where id = first_project_id and owner_profile_id = v_owner_profile_id;
  if visible_count <> 0 then
    raise exception 'another authenticated actor read the owner project';
  end if;
  select count(*) into visible_count
  from public.fund_plans where project_id = first_project_id;
  if visible_count <> 0 then
    raise exception 'another authenticated actor read the owner plan';
  end if;

  execute 'reset role';
  raise notice 'Fund F5-b owner content verification passed; transaction will roll back';
end;
$$;

rollback;
