-- Fund F5-a public project content, owner isolation, and projection verification.
-- It uses two existing Mikke profiles and rolls all fixture data back.

begin;

do $$
declare
  owner_a_user_id uuid;
  owner_a_profile_id uuid;
  actor_b_user_id uuid;
  actor_b_profile_id uuid;
  v_project_id uuid;
  visible_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  project_payload jsonb;
  plan_payload jsonb;
begin
  if has_table_privilege('anon', 'public.fund_projects', 'select')
    or has_table_privilege('anon', 'public.fund_plans', 'select') then
    raise exception 'anon can directly read owner-private Fund content';
  end if;
  if has_table_privilege('anon', 'public.fund_public_projects', 'insert')
    or has_table_privilege('authenticated', 'public.fund_public_projects', 'update')
    or has_table_privilege('anon', 'public.fund_public_plans', 'delete') then
    raise exception 'public projection tables have direct client write privileges';
  end if;
  if not has_table_privilege('anon', 'public.fund_public_projects', 'select')
    or not has_table_privilege('authenticated', 'public.fund_public_plans', 'select') then
    raise exception 'public projection tables are not explicitly readable';
  end if;

  select user_id, id into owner_a_user_id, owner_a_profile_id
  from public.profiles order by created_at limit 1;
  select user_id, id into actor_b_user_id, actor_b_profile_id
  from public.profiles where user_id <> owner_a_user_id order by created_at limit 1;
  if owner_a_user_id is null or actor_b_user_id is null then
    raise exception 'Fund F5-a RLS test requires profiles for two different auth users';
  end if;

  update public.profiles
  set handle = 'fund_f5_owner_' || suffix
  where id = owner_a_profile_id;

  project_payload := jsonb_build_object(
    'id', 'fund-f5-project-' || suffix,
    'profileSlug', 'client-value-must-not-win',
    'slug', 'fund-f5-' || suffix,
    'title', 'Fund F5-a verification',
    'shortDescription', 'Public-safe summary',
    'description', 'Public project body',
    'projectType', 'course',
    'campaignType', 'early_application',
    'stage', 'campaign',
    'status', 'open',
    'visibility', 'public',
    'coverImageUrl', '',
    'goalType', 'supporters',
    'goalValue', 5,
    'displayAmount', false,
    'startAt', '',
    'endAt', '',
    'externalPaymentUrl', '',
    'externalApplicationUrl', 'https://example.com/fund-f5',
    'whyNow', 'Why now',
    'audience', 'Audience',
    'useOfSupport', 'Use of support',
    'schedule', 'Schedule',
    'riskNotes', 'Risk notes',
    'cancellationPolicy', 'Cancellation policy',
    'contactNote', 'Contact note'
  );
  plan_payload := jsonb_build_array(jsonb_build_object(
    'id', 'fund-f5-plan-' || suffix,
    'title', 'Private price plan',
    'description', 'Public plan description',
    'imageUrl', '',
    'planType', 'early_application',
    'price', 5000,
    'quantityLimit', 10,
    'perPersonLimit', 1,
    'deliveryDate', '',
    'externalPaymentUrl', '',
    'externalApplicationUrl', 'https://example.com/fund-f5-plan',
    'requiredInformationNote', 'Private legal name and email',
    'requiresShipping', true,
    'status', 'active',
    'sortOrder', 0
  ));

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_project_id := public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
  select count(*) into visible_count
  from public.fund_projects
  where id = v_project_id and owner_user_id = owner_a_user_id;
  if visible_count <> 1 then
    raise exception 'owner could not read the saved project';
  end if;
  select count(*) into visible_count
  from public.fund_plans
  where project_id = v_project_id;
  if visible_count <> 1 then
    raise exception 'owner could not read the saved plan';
  end if;

  insert into public.fund_supports (
    project_id, source_local_id, supporter_name, supporter_email,
    support_type, amount, quantity, payment_status, fulfillment_status,
    record_status, source
  ) values (
    v_project_id, 'fund-f5-support-' || suffix, 'Private Supporter',
    'private@example.invalid', 'support', 5000, 1, 'confirmed',
    'not_required', 'valid', 'manual'
  );

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', actor_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.fund_projects where id = v_project_id;
  if visible_count <> 0 then
    raise exception 'another authenticated actor could read the owner project';
  end if;
  select count(*) into visible_count from public.fund_plans where project_id = v_project_id;
  if visible_count <> 0 then
    raise exception 'another authenticated actor could read the owner plan';
  end if;
  begin
    perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
    raise exception 'another authenticated actor saved content for the owner';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*) into visible_count
  from public.fund_public_projects
  where project_id = v_project_id
    and profile_slug = 'fund_f5_owner_' || suffix
    and title = 'Fund F5-a verification'
    and current_value = 1;
  if visible_count <> 1 then
    raise exception 'anon could not read the public-safe project projection or progress';
  end if;
  select count(*) into visible_count
  from public.fund_public_plans
  where project_id = v_project_id
    and title = 'Private price plan'
    and price is null;
  if visible_count <> 1 then
    raise exception 'anon plan projection exposed a hidden price or was missing';
  end if;
  begin
    perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
    raise exception 'anon executed the owner save RPC';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  select count(*) into visible_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('fund_public_projects', 'fund_public_plans')
    and column_name in (
      'supporter_name', 'supporter_email', 'comment', 'amount',
      'required_information_note', 'requires_shipping'
    );
  if visible_count <> 0 then
    raise exception 'public Fund projection contains private supporter or application fields';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  project_payload := jsonb_set(project_payload, '{goalType}', '"amount"'::jsonb);
  project_payload := jsonb_set(project_payload, '{goalValue}', '10000'::jsonb);
  perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
  select count(*) into visible_count
  from public.fund_public_projects
  where project_id = v_project_id
    and goal_value = 0
    and current_value = 0;
  if visible_count <> 1 then
    raise exception 'hidden Fund amount values remained readable in the public project projection';
  end if;

  project_payload := jsonb_set(project_payload, '{displayAmount}', 'true'::jsonb);
  perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
  select count(*) into visible_count
  from public.fund_public_plans
  where project_id = v_project_id and price = 5000;
  if visible_count <> 1 then
    raise exception 'owner amount-display consent did not publish the plan price';
  end if;
  select count(*) into visible_count
  from public.fund_public_projects
  where project_id = v_project_id
    and goal_value = 10000
    and current_value = 5000;
  if visible_count <> 1 then
    raise exception 'owner amount-display consent did not publish the aggregate amount progress';
  end if;

  project_payload := jsonb_set(project_payload, '{visibility}', '"private"'::jsonb);
  perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
  select count(*) into visible_count from public.fund_public_projects where project_id = v_project_id;
  if visible_count <> 0 then
    raise exception 'private project remained in the public projection';
  end if;

  project_payload := jsonb_set(project_payload, '{visibility}', '"unlisted"'::jsonb);
  perform public.save_fund_project_content(owner_a_profile_id, project_payload, plan_payload);
  select count(*) into visible_count from public.fund_public_projects where project_id = v_project_id;
  if visible_count <> 0 then
    raise exception 'unlisted project became enumerable through the public projection';
  end if;

  execute 'reset role';
  raise notice 'Fund F5-a public content and RLS verification passed; transaction will roll back';
end;
$$;

rollback;
