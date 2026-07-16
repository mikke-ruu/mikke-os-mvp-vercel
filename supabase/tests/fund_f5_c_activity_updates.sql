-- Fund F5-c owner activity reports, public projection, and actor isolation.
-- All fixture data and profile changes roll back.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_owner_profile_id uuid;
  v_other_user_id uuid;
  v_project_id uuid;
  v_update_id uuid;
  v_second_update_id uuid;
  visible_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  project_source_id text;
  update_source_id text;
  project_payload jsonb;
  update_payload jsonb;
begin
  if has_table_privilege('anon', 'public.fund_updates', 'select') then
    raise exception 'anon can directly read owner-private Fund updates';
  end if;
  if not has_table_privilege('authenticated', 'public.fund_updates', 'select')
    or not has_table_privilege('authenticated', 'public.fund_updates', 'insert') then
    raise exception 'authenticated owner update privileges are missing';
  end if;
  if not has_table_privilege('anon', 'public.fund_public_updates', 'select')
    or not has_table_privilege('authenticated', 'public.fund_public_updates', 'select') then
    raise exception 'public update projection is not explicitly readable';
  end if;
  if has_table_privilege('anon', 'public.fund_public_updates', 'insert')
    or has_table_privilege('authenticated', 'public.fund_public_updates', 'update') then
    raise exception 'clients can directly write the public update projection';
  end if;

  select user_id, id into v_owner_user_id, v_owner_profile_id
  from public.profiles order by created_at limit 1;
  select user_id into v_other_user_id
  from public.profiles where user_id <> v_owner_user_id order by created_at limit 1;
  if v_owner_user_id is null or v_other_user_id is null then
    raise exception 'Fund F5-c test requires profiles for two different auth users';
  end if;

  update public.profiles
  set handle = 'fund_f5c_owner_' || suffix
  where id = v_owner_profile_id;

  project_source_id := 'fund-f5c-project-' || suffix;
  update_source_id := 'fund-f5c-update-' || suffix;
  project_payload := jsonb_build_object(
    'id', project_source_id,
    'slug', 'fund-f5c-' || suffix,
    'title', 'Fund F5-c project',
    'shortDescription', '',
    'description', 'Activity update fixture',
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
  update_payload := jsonb_build_object(
    'id', update_source_id,
    'title', 'Draft activity report',
    'body', 'Owner-private draft body',
    'imageUrl', 'https://example.com/fund-update.jpg',
    'visibility', 'draft'
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_project_id := public.save_fund_project_content(v_owner_profile_id, project_payload, '[]'::jsonb);
  v_update_id := public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);

  select count(*) into visible_count
  from public.fund_updates
  where id = v_update_id
    and source_local_id = update_source_id
    and visibility = 'draft'
    and published_at is null;
  if visible_count <> 1 then
    raise exception 'owner draft update was not saved with a private publication state';
  end if;
  select count(*) into visible_count
  from public.fund_public_updates where update_id = v_update_id;
  if visible_count <> 0 then
    raise exception 'draft activity report entered the public projection';
  end if;

  update_payload := jsonb_set(update_payload, '{title}', '"Published activity report"'::jsonb);
  update_payload := jsonb_set(update_payload, '{body}', '"Public activity body"'::jsonb);
  update_payload := jsonb_set(update_payload, '{visibility}', '"public"'::jsonb);
  v_second_update_id := public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
  if v_second_update_id <> v_update_id then
    raise exception 'same activity source ID created a duplicate database update';
  end if;
  select count(*) into visible_count
  from public.fund_public_updates
  where update_id = v_update_id
    and project_id = v_project_id
    and title = 'Published activity report'
    and body = 'Public activity body'
    and image_url = 'https://example.com/fund-update.jpg'
    and published_at is not null;
  if visible_count <> 1 then
    raise exception 'public activity report was not projected with safe fields';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.fund_updates where id = v_update_id;
  if visible_count <> 0 then
    raise exception 'another authenticated actor read the owner activity report';
  end if;
  begin
    perform public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
    raise exception 'another authenticated actor saved an activity report for the owner';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.fund_updates (
      project_id, source_local_id, title, body, image_url, visibility
    ) values (
      v_project_id, 'fund-f5c-other-' || suffix, 'Forbidden', 'Forbidden', '', 'draft'
    );
    raise exception 'another authenticated actor directly inserted into the owner project';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*) into visible_count
  from public.fund_public_updates
  where update_id = v_update_id and title = 'Published activity report';
  if visible_count <> 1 then
    raise exception 'anon could not read the published activity report';
  end if;
  begin
    perform public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
    raise exception 'anon executed the owner activity save RPC';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  update_payload := jsonb_set(update_payload, '{visibility}', '"draft"'::jsonb);
  perform public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
  select count(*) into visible_count
  from public.fund_updates where id = v_update_id and published_at is null;
  if visible_count <> 1 then
    raise exception 'returning an activity report to draft did not clear its publication time';
  end if;
  select count(*) into visible_count from public.fund_public_updates where update_id = v_update_id;
  if visible_count <> 0 then
    raise exception 'activity report remained public after returning to draft';
  end if;

  update_payload := jsonb_set(update_payload, '{visibility}', '"public"'::jsonb);
  perform public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
  project_payload := jsonb_set(project_payload, '{visibility}', '"private"'::jsonb);
  perform public.save_fund_project_content(v_owner_profile_id, project_payload, '[]'::jsonb);
  select count(*) into visible_count from public.fund_public_updates where update_id = v_update_id;
  if visible_count <> 0 then
    raise exception 'public activity report remained enumerable after its project became private';
  end if;

  project_payload := jsonb_set(project_payload, '{visibility}', '"public"'::jsonb);
  perform public.save_fund_project_content(v_owner_profile_id, project_payload, '[]'::jsonb);
  select count(*) into visible_count from public.fund_public_updates where update_id = v_update_id;
  if visible_count <> 1 then
    raise exception 'public activity report was not restored after its project became public again';
  end if;

  begin
    update_payload := jsonb_set(update_payload, '{imageUrl}', '"javascript:alert(1)"'::jsonb);
    perform public.save_fund_update(v_owner_profile_id, project_source_id, update_payload);
    raise exception 'invalid activity image URL was accepted';
  exception when check_violation then null;
  end;

  execute 'reset role';
  select count(*) into visible_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'fund_public_updates'
    and column_name in (
      'source_local_id', 'owner_profile_id', 'owner_user_id',
      'supporter_name', 'supporter_email', 'comment', 'amount'
    );
  if visible_count <> 0 then
    raise exception 'public activity projection contains owner-only or supporter fields';
  end if;

  raise notice 'Fund F5-c activity update and RLS verification passed; transaction will roll back';
end;
$$;

rollback;
