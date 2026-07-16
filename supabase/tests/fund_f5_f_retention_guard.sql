-- Fund F5-f retention and unlisted fail-closed verification.
-- It uses one existing Mikke profile and rolls all fixture data back.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_owner_profile_id uuid;
  v_project_id uuid;
  v_support_id uuid;
  v_update_id uuid;
  v_record_id uuid;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_project_source_id text;
  v_support_source_id text;
  v_project_payload jsonb;
  v_support_payload jsonb;
  v_count integer;
begin
  if has_table_privilege('authenticated', 'public.fund_projects', 'delete')
    or has_table_privilege('authenticated', 'public.fund_supports', 'delete')
    or has_table_privilege('authenticated', 'public.fund_updates', 'delete')
    or has_table_privilege('authenticated', 'public.fund_challenge_records', 'delete')
    or has_table_privilege('authenticated', 'public.fund_app_links', 'delete') then
    raise exception 'authenticated retained a protected Fund hard-delete privilege';
  end if;
  if not has_table_privilege('authenticated', 'public.fund_plans', 'delete') then
    raise exception 'fund plan replacement lost its required delete privilege';
  end if;
  if has_table_privilege('anon', 'public.fund_projects', 'delete')
    or has_table_privilege('anon', 'public.fund_supports', 'delete') then
    raise exception 'anon received a Fund hard-delete privilege';
  end if;

  select p.user_id, p.id into v_owner_user_id, v_owner_profile_id
  from public.profiles as p
  order by p.created_at, p.id
  limit 1;
  if v_owner_user_id is null then
    raise exception 'F5-f verification requires one existing profile';
  end if;

  update public.profiles
  set handle = 'fund_f5f_owner_' || v_suffix
  where id = v_owner_profile_id;

  v_project_source_id := 'fund-f5f-project-' || v_suffix;
  v_support_source_id := 'fund-f5f-support-' || v_suffix;
  v_project_payload := jsonb_build_object(
    'id', v_project_source_id,
    'slug', 'fund-f5f-' || v_suffix,
    'title', 'Fund F5-f retention fixture',
    'shortDescription', 'Retention verification',
    'description', 'Retention verification',
    'projectType', 'activity',
    'campaignType', 'support',
    'stage', 'campaign',
    'status', 'open',
    'visibility', 'public',
    'coverImageUrl', '',
    'goalType', 'supporters',
    'goalValue', 1,
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
  v_support_payload := jsonb_build_object(
    'id', v_support_source_id,
    'planId', '',
    'supporterName', 'Retention Supporter',
    'supporterEmail', 'retention@example.invalid',
    'publicName', '',
    'isAnonymous', true,
    'supportType', 'support',
    'amount', null,
    'quantity', 1,
    'paymentStatus', 'pending',
    'fulfillmentStatus', 'waiting',
    'recordStatus', 'valid',
    'comment', 'Private retention fixture',
    'source', 'F5-f test',
    'supportedAt', '2026-07-16'
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_project_id := public.save_fund_project_content(v_owner_profile_id, v_project_payload, '[]'::jsonb);
  v_support_id := public.save_fund_support(v_owner_profile_id, v_project_source_id, v_support_payload);
  v_update_id := public.save_fund_update(
    v_owner_profile_id,
    v_project_source_id,
    jsonb_build_object(
      'id', 'fund-f5f-update-' || v_suffix,
      'title', 'Retention update',
      'body', 'Retained as draft instead of deleted',
      'imageUrl', '',
      'visibility', 'draft'
    )
  );
  v_record_id := public.save_fund_completion(
    v_owner_profile_id,
    v_project_source_id,
    jsonb_build_object(
      'id', 'fund-f5f-record-' || v_suffix,
      'title', 'Retention completion',
      'summary', 'Retained as private instead of deleted',
      'outcome', '',
      'imageUrl', '',
      'visibility', 'private',
      'storyEnabled', false,
      'completedAt', '2026-07-16'
    ),
    array['team_works']
  );

  begin
    delete from public.fund_supports where id = v_support_id;
    raise exception 'owner hard-deleted a support';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.fund_updates where id = v_update_id;
    raise exception 'owner hard-deleted an update';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.fund_challenge_records where id = v_record_id;
    raise exception 'owner hard-deleted a completion record';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.fund_app_links where project_id = v_project_id;
    raise exception 'owner hard-deleted an app handoff';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.fund_projects where id = v_project_id;
    raise exception 'owner hard-deleted a project';
  exception when insufficient_privilege then null;
  end;

  v_support_payload := jsonb_set(v_support_payload, '{recordStatus}', '"invalid"'::jsonb);
  perform public.save_fund_support(v_owner_profile_id, v_project_source_id, v_support_payload);
  v_project_payload := jsonb_set(v_project_payload, '{status}', '"archived"'::jsonb);
  v_project_payload := jsonb_set(v_project_payload, '{visibility}', '"private"'::jsonb);
  perform public.save_fund_project_content(v_owner_profile_id, v_project_payload, '[]'::jsonb);

  execute 'reset role';
  select count(*) into v_count
  from public.fund_projects as fp
  where fp.id = v_project_id and fp.status = 'archived' and fp.visibility = 'private';
  if v_count <> 1 then raise exception 'archive state did not preserve the project'; end if;
  select count(*) into v_count
  from public.fund_supports as fs
  where fs.id = v_support_id and fs.record_status = 'invalid';
  if v_count <> 1 then raise exception 'invalid state did not preserve the support'; end if;
  select count(*) into v_count from public.fund_updates as fu where fu.id = v_update_id;
  if v_count <> 1 then raise exception 'draft update was not retained'; end if;
  select count(*) into v_count from public.fund_challenge_records as fcr where fcr.id = v_record_id;
  if v_count <> 1 then raise exception 'private completion was not retained'; end if;
  select count(*) into v_count from public.fund_app_links as fal where fal.project_id = v_project_id;
  if v_count <> 1 then raise exception 'app handoff was not retained'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  v_project_payload := jsonb_set(v_project_payload, '{status}', '"open"'::jsonb);
  v_project_payload := jsonb_set(v_project_payload, '{visibility}', '"unlisted"'::jsonb);
  perform public.save_fund_project_content(v_owner_profile_id, v_project_payload, '[]'::jsonb);
  execute 'reset role';

  select count(*) into v_count
  from public.fund_public_projects as fpp
  where fpp.project_id = v_project_id;
  if v_count <> 0 then raise exception 'unlisted project entered the public projection'; end if;
end
$$;

rollback;
