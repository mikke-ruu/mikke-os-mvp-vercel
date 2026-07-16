-- Fund F5-d owner support/payment/fulfillment source, supporter privacy, and
-- claim/participation compatibility. All fixture data rolls back.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_owner_profile_id uuid;
  v_supporter_user_id uuid;
  v_project_id uuid;
  v_support_id uuid;
  v_second_support_id uuid;
  v_participation_id uuid;
  v_invite_token text;
  affected_count integer;
  visible_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  project_source_id text;
  support_source_id text;
  project_payload jsonb;
  support_payload jsonb;
begin
  if has_table_privilege('anon', 'public.fund_supports', 'select') then
    raise exception 'anon can directly read owner-private Fund supports';
  end if;
  if not has_table_privilege('authenticated', 'public.fund_supports', 'select')
    or not has_table_privilege('authenticated', 'public.fund_supports', 'update') then
    raise exception 'authenticated owner support privileges are missing';
  end if;
  if has_function_privilege('anon', 'public.save_fund_support(uuid,text,jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.save_fund_support(uuid,text,jsonb)', 'execute') then
    raise exception 'support save RPC privileges are incorrect';
  end if;

  select user_id, id into v_owner_user_id, v_owner_profile_id
  from public.profiles order by created_at limit 1;
  select user_id into v_supporter_user_id
  from public.profiles where user_id <> v_owner_user_id order by created_at limit 1;
  if v_owner_user_id is null or v_supporter_user_id is null then
    raise exception 'Fund F5-d test requires profiles for two different auth users';
  end if;

  update public.profiles
  set handle = 'fund_f5d_owner_' || suffix
  where id = v_owner_profile_id;

  project_source_id := 'fund-f5d-project-' || suffix;
  support_source_id := 'fund-f5d-support-' || suffix;
  project_payload := jsonb_build_object(
    'id', project_source_id,
    'slug', 'fund-f5d-' || suffix,
    'title', 'Fund F5-d project',
    'shortDescription', '',
    'description', 'Support management fixture',
    'projectType', 'activity',
    'campaignType', 'support',
    'stage', 'campaign',
    'status', 'open',
    'visibility', 'public',
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
  support_payload := jsonb_build_object(
    'id', support_source_id,
    'planId', '',
    'supporterName', '  Private Supporter  ',
    'supporterEmail', 'private@example.invalid',
    'publicName', 'Owner private alias',
    'isAnonymous', false,
    'supportType', 'support',
    'amount', 5000,
    'quantity', 1,
    'paymentStatus', 'pending',
    'fulfillmentStatus', 'waiting',
    'recordStatus', 'valid',
    'comment', 'Owner-only management memo',
    'source', 'External form',
    'supportedAt', '2026-07-16'
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_project_id := public.save_fund_project_content(v_owner_profile_id, project_payload, '[]'::jsonb);
  v_support_id := public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);

  select count(*) into visible_count
  from public.fund_supports
  where id = v_support_id
    and source_local_id = support_source_id
    and supporter_name = 'Private Supporter'
    and public_name = 'Owner private alias'
    and comment = 'Owner-only management memo'
    and completed_at is null
    and cancelled_at is null;
  if visible_count <> 1 then
    raise exception 'owner support was not saved with normalized private fields';
  end if;
  select count(*) into visible_count
  from public.fund_public_projects
  where project_id = v_project_id and current_value = 1;
  if visible_count <> 1 then
    raise exception 'valid support did not update public aggregate progress';
  end if;

  support_payload := jsonb_set(support_payload, '{supporterName}', '"Private Supporter Updated"'::jsonb);
  support_payload := jsonb_set(support_payload, '{paymentStatus}', '"confirmed"'::jsonb);
  support_payload := jsonb_set(support_payload, '{fulfillmentStatus}', '"completed"'::jsonb);
  v_second_support_id := public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
  if v_second_support_id <> v_support_id then
    raise exception 'same support source ID created a duplicate database support';
  end if;
  select count(*) into visible_count
  from public.fund_supports
  where id = v_support_id
    and supporter_name = 'Private Supporter Updated'
    and completed_at is not null;
  if visible_count <> 1 then
    raise exception 'idempotent support update or completion timestamp failed';
  end if;

  select invite_token into v_invite_token
  from public.create_fund_support_claim(v_support_id, now() + interval '1 day');
  if v_invite_token is null then
    raise exception 'owner could not create a claim for the database-owned support';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_supporter_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_supporter_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.fund_supports where id = v_support_id;
  if visible_count <> 0 then
    raise exception 'supporter could read owner-private support fields';
  end if;
  update public.fund_supports set supporter_name = 'Forbidden update' where id = v_support_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then
    raise exception 'supporter directly updated an owner-private support';
  end if;
  begin
    perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
    raise exception 'supporter saved support data for the owner';
  exception when insufficient_privilege then null;
  end;

  v_participation_id := public.accept_fund_support_claim(v_invite_token);
  perform public.update_fund_participation_consent(
    v_participation_id,
    null,
    'granted',
    'F5-d public supporter',
    'public_name'
  );
  select count(*) into visible_count
  from public.fund_participations
  where id = v_participation_id and supporter_user_id = v_supporter_user_id;
  if visible_count <> 1 then
    raise exception 'supporter participation was not preserved for the database-owned support';
  end if;
  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id
    and display_name = 'F5-d public supporter';
  if visible_count <> 1 then
    raise exception 'consent-bound public participation was not projected';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  support_payload := jsonb_set(support_payload, '{fulfillmentStatus}', '"waiting"'::jsonb);
  perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
  select count(*) into visible_count from public.fund_supports where id = v_support_id and completed_at is null;
  if visible_count <> 1 then
    raise exception 'leaving completed fulfillment did not clear completed_at';
  end if;

  support_payload := jsonb_set(support_payload, '{paymentStatus}', '"cancelled"'::jsonb);
  perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
  select count(*) into visible_count from public.fund_supports where id = v_support_id and cancelled_at is not null;
  if visible_count <> 1 then
    raise exception 'cancelled support did not receive cancelled_at';
  end if;
  select count(*) into visible_count from public.fund_public_projects where project_id = v_project_id and current_value = 0;
  if visible_count <> 1 then
    raise exception 'cancelled support remained in public aggregate progress';
  end if;

  support_payload := jsonb_set(support_payload, '{paymentStatus}', '"pending"'::jsonb);
  support_payload := jsonb_set(support_payload, '{recordStatus}', '"invalid"'::jsonb);
  perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
  select count(*) into visible_count from public.fund_supports where id = v_support_id and cancelled_at is null;
  if visible_count <> 1 then
    raise exception 'leaving cancelled payment did not clear cancelled_at';
  end if;
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 0 then
    raise exception 'invalid support remained in the public participation projection';
  end if;

  support_payload := jsonb_set(support_payload, '{recordStatus}', '"valid"'::jsonb);
  perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 1 then
    raise exception 'valid support did not restore its consent-bound participation projection';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id
    and display_name = 'F5-d public supporter';
  if visible_count <> 1 then
    raise exception 'anon could not read the consent-bound public participation';
  end if;
  begin
    perform public.save_fund_support(v_owner_profile_id, project_source_id, support_payload);
    raise exception 'anon executed the owner support save RPC';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  select count(*) into visible_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('fund_public_projects', 'fund_public_participations')
    and column_name in (
      'supporter_name', 'supporter_email', 'comment', 'amount',
      'public_name', 'payment_status', 'fulfillment_status', 'record_status'
    );
  if visible_count <> 0 then
    raise exception 'public Fund projections contain owner-private support fields';
  end if;

  raise notice 'Fund F5-d support management and RLS verification passed; transaction will roll back';
end;
$$;

rollback;
