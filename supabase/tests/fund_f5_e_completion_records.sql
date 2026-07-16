-- Fund F5-e production-safe completion, public projection, Activity Log, and RLS verification.
-- It uses two existing Mikke profiles and rolls all fixture data back.

begin;

do $$
declare
  owner_a_user_id uuid;
  owner_a_profile_id uuid;
  actor_b_user_id uuid;
  actor_b_profile_id uuid;
  v_project_id uuid;
  v_record_id uuid;
  v_repeated_record_id uuid;
  v_activity_id uuid;
  v_repeated_activity_id uuid;
  visible_count integer;
  affected_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_source_project_id text;
  v_source_record_id text;
begin
  if has_table_privilege('anon', 'public.fund_challenge_records', 'select')
    or has_table_privilege('anon', 'public.fund_app_links', 'select')
    or has_function_privilege('anon', 'public.save_fund_completion(uuid,text,jsonb,text[])', 'execute') then
    raise exception 'anon received private F5-e privileges';
  end if;
  if not has_table_privilege('anon', 'public.fund_public_challenge_records', 'select')
    or not has_table_privilege('authenticated', 'public.fund_challenge_records', 'select')
    or not has_table_privilege('authenticated', 'public.fund_app_links', 'select')
    or not has_function_privilege('authenticated', 'public.save_fund_completion(uuid,text,jsonb,text[])', 'execute') then
    raise exception 'expected F5-e grants are missing';
  end if;

  select user_id, id into owner_a_user_id, owner_a_profile_id
  from public.profiles order by created_at, id limit 1;
  select user_id, id into actor_b_user_id, actor_b_profile_id
  from public.profiles where user_id <> owner_a_user_id order by created_at, id limit 1;
  if owner_a_user_id is null or actor_b_user_id is null then
    raise exception 'F5-e verification requires two existing profiles';
  end if;

  v_source_project_id := 'f5e-project-' || suffix;
  v_source_record_id := 'f5e-record-' || suffix;

  update public.profiles set handle = 'f5e_owner_' || suffix where id = owner_a_profile_id;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_project_id := public.save_fund_project_content(
    owner_a_profile_id,
    jsonb_build_object(
      'id', v_source_project_id,
      'slug', 'f5e-' || suffix,
      'title', 'F5-e completion verification',
      'shortDescription', 'Public completion verification',
      'description', 'Completion description',
      'projectType', 'activity',
      'campaignType', 'support',
      'stage', 'campaign',
      'status', 'open',
      'visibility', 'public',
      'coverImageUrl', '',
      'goalType', 'supporters',
      'goalValue', 1,
      'displayAmount', false,
      'startAt', '2026-07-01',
      'endAt', '2026-07-31',
      'externalPaymentUrl', '',
      'externalApplicationUrl', '',
      'whyNow', '',
      'audience', '',
      'useOfSupport', '',
      'schedule', '',
      'riskNotes', '',
      'cancellationPolicy', '',
      'contactNote', ''
    ),
    '[]'::jsonb
  );

  v_record_id := public.save_fund_completion(
    owner_a_profile_id,
    v_source_project_id,
    jsonb_build_object(
      'id', v_source_record_id,
      'title', 'F5-e challenge completed',
      'summary', 'A public-safe completion summary',
      'outcome', 'A next step was found',
      'imageUrl', 'https://example.com/f5e.png',
      'visibility', 'public',
      'storyEnabled', true,
      'completedAt', '2026-07-16'
    ),
    array['order', 'team_works']
  );

  select count(*) into visible_count
  from public.fund_projects as fp
  where fp.id = v_project_id and fp.stage = 'realization' and fp.status = 'completed'
    and completed_at::date = date '2026-07-16';
  if visible_count <> 1 then raise exception 'completion did not complete the project atomically'; end if;

  select count(*) into visible_count
  from public.fund_challenge_records as fcr
  where fcr.id = v_record_id and fcr.project_id = v_project_id
    and fcr.source_local_id = v_source_record_id
    and fcr.title = 'F5-e challenge completed'
    and fcr.visibility = 'public' and fcr.story_enabled = true
    and fcr.completed_at = date '2026-07-16';
  if visible_count <> 1 then raise exception 'owner completion record was not saved'; end if;

  select count(*) into visible_count
  from public.fund_app_links as fal
  where fal.project_id = v_project_id and fal.link_status = 'ready'
    and fal.target_service in ('order', 'team_works');
  if visible_count <> 2 then raise exception 'app handoff candidates were not saved'; end if;

  select count(*) into visible_count
  from public.fund_public_challenge_records as fpcr
  where fpcr.challenge_record_id = v_record_id
    and fpcr.project_id = v_project_id
    and fpcr.profile_slug = 'f5e_owner_' || suffix
    and fpcr.project_slug = 'f5e-' || suffix
    and fpcr.public_fund_path = '/fund/f5e_owner_' || suffix || '/f5e-' || suffix
    and fpcr.title = 'F5-e challenge completed'
    and fpcr.summary = 'A public-safe completion summary'
    and fpcr.story_enabled = true;
  if visible_count <> 1 then raise exception 'public-safe completion projection was not created'; end if;

  select al.id into v_activity_id
  from public.activity_logs as al
  where al.user_id = owner_a_user_id and al.profile_id = owner_a_profile_id
    and al.activity_type = 'fund_project_completed'
    and al.source_service = 'fund'
    and al.source_record_id = 'completion:' || v_source_project_id
    and al.visibility = 'private' and al.display_on_story = false
    and al.display_as_achievement = true and al.counts_toward_summary = true
    and al.has_financial_value = false and al.amount is null
    and al.transaction_type = 'none' and al.payment_status = 'not_required';
  if v_activity_id is null then raise exception 'private completion Activity Log was not created'; end if;

  v_repeated_record_id := public.save_fund_completion(
    owner_a_profile_id,
    v_source_project_id,
    jsonb_build_object(
      'id', 'must-not-replace-source-' || suffix,
      'title', 'F5-e challenge updated',
      'summary', 'Updated completion summary',
      'outcome', '',
      'imageUrl', '',
      'visibility', 'public',
      'storyEnabled', true,
      'completedAt', '2026-07-15'
    ),
    array['academy']
  );
  if v_repeated_record_id <> v_record_id then raise exception 'repeat save changed the completion database id'; end if;
  select al.id into v_repeated_activity_id from public.activity_logs as al
  where al.profile_id = owner_a_profile_id and al.source_service = 'fund'
    and al.source_record_id = 'completion:' || v_source_project_id;
  if v_repeated_activity_id <> v_activity_id then raise exception 'repeat save duplicated the completion Activity Log'; end if;
  select count(*) into visible_count from public.fund_challenge_records as fcr
  where fcr.id = v_record_id and fcr.source_local_id = v_source_record_id and fcr.title = 'F5-e challenge updated';
  if visible_count <> 1 then raise exception 'stable completion source id was not preserved'; end if;
  select count(*) into visible_count from public.fund_app_links as fal
  where fal.project_id = v_project_id and fal.target_service = 'academy' and fal.link_status = 'ready';
  if visible_count <> 1 then raise exception 'new app candidate was not marked ready'; end if;
  select count(*) into visible_count from public.fund_app_links as fal
  where fal.project_id = v_project_id and fal.target_service in ('order', 'team_works') and fal.link_status = 'cancelled';
  if visible_count <> 2 then raise exception 'removed app candidates were not cancelled'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', actor_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.fund_challenge_records as fcr where fcr.id = v_record_id;
  if visible_count <> 0 then raise exception 'other actor read owner-private completion'; end if;
  select count(*) into visible_count from public.fund_app_links as fal where fal.project_id = v_project_id;
  if visible_count <> 0 then raise exception 'other actor read owner-private app candidates'; end if;
  update public.fund_challenge_records as fcr set title = 'forbidden' where fcr.id = v_record_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'other actor updated owner-private completion'; end if;
  begin
    perform public.save_fund_completion(
      owner_a_profile_id, v_source_project_id,
      jsonb_build_object('id', 'forbidden', 'title', 'forbidden', 'summary', 'forbidden', 'completedAt', '2026-07-16'),
      array[]::text[]
    );
    raise exception 'other actor saved owner completion';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  perform public.save_fund_completion(
    owner_a_profile_id, v_source_project_id,
    jsonb_build_object(
      'id', v_source_record_id, 'title', 'Private completion',
      'summary', 'Owner only', 'outcome', '', 'imageUrl', '',
      'visibility', 'private', 'storyEnabled', true, 'completedAt', '2026-07-15'
    ), array[]::text[]
  );
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr where fpcr.challenge_record_id = v_record_id;
  if visible_count <> 0 then raise exception 'private completion propagated publicly'; end if;

  perform public.save_fund_completion(
    owner_a_profile_id, v_source_project_id,
    jsonb_build_object(
      'id', v_source_record_id, 'title', 'Public without Story',
      'summary', 'Public Fund only', 'outcome', '', 'imageUrl', '',
      'visibility', 'public', 'storyEnabled', false, 'completedAt', '2026-07-15'
    ), array[]::text[]
  );
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr
  where fpcr.challenge_record_id = v_record_id and fpcr.story_enabled = false;
  if visible_count <> 1 then raise exception 'public Fund completion without Story was not projected'; end if;
  select count(*) into visible_count from public.activity_logs as al
  where al.id = v_activity_id and al.visibility = 'private' and al.display_on_story = false
    and al.display_as_achievement = false and al.counts_toward_summary = false;
  if visible_count <> 1 then raise exception 'private Activity Log did not follow Story opt-out'; end if;

  perform public.save_fund_completion(
    owner_a_profile_id, v_source_project_id,
    jsonb_build_object(
      'id', v_source_record_id, 'title', 'Public with Story',
      'summary', 'Public Story entry', 'outcome', '', 'imageUrl', '',
      'visibility', 'public', 'storyEnabled', true, 'completedAt', '2026-07-15'
    ), array[]::text[]
  );
  update public.fund_projects as fp set visibility = 'private' where fp.id = v_project_id;
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr where fpcr.challenge_record_id = v_record_id;
  if visible_count <> 0 then raise exception 'private parent left a public completion projection'; end if;
  select count(*) into visible_count from public.activity_logs as al
  where al.id = v_activity_id and al.visibility = 'private' and al.display_on_story = false
    and al.display_as_achievement = false and al.counts_toward_summary = false;
  if visible_count <> 1 then raise exception 'completion Activity Log did not follow private parent'; end if;

  update public.fund_projects as fp set visibility = 'public' where fp.id = v_project_id;
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr
  where fpcr.challenge_record_id = v_record_id and fpcr.story_enabled = true;
  if visible_count <> 1 then raise exception 'public parent did not restore completion projection'; end if;

  execute 'reset role';
  update public.profiles set handle = 'f5e_owner_changed_' || suffix where id = owner_a_profile_id;
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr
  where fpcr.challenge_record_id = v_record_id
    and fpcr.public_fund_path = '/fund/f5e_owner_changed_' || suffix || '/f5e-' || suffix;
  if visible_count <> 1 then raise exception 'owner handle change did not resync completion path'; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  select count(*) into visible_count from public.fund_public_challenge_records as fpcr where fpcr.challenge_record_id = v_record_id;
  if visible_count <> 1 then raise exception 'anon could not read public-safe completion'; end if;
  begin
    select count(*) into visible_count from public.fund_challenge_records as fcr where fcr.id = v_record_id;
    if visible_count <> 0 then raise exception 'anon read owner-private completion'; end if;
  exception when insufficient_privilege then null;
  end;
  select count(*) into visible_count from public.activity_logs as al
  where al.source_service = 'fund' and al.source_record_id = 'completion:' || v_source_project_id;
  if visible_count <> 0 then raise exception 'anon read private completion Activity Log'; end if;
  begin
    perform public.save_fund_completion(
      owner_a_profile_id, v_source_project_id,
      jsonb_build_object('id', 'anon', 'title', 'anon', 'summary', 'anon', 'completedAt', '2026-07-16'),
      array[]::text[]
    );
    raise exception 'anon saved a completion';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  select count(*) into visible_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'fund_public_challenge_records'
    and column_name in ('source_local_id', 'owner_user_id', 'owner_profile_id', 'target_service', 'link_status');
  if visible_count <> 0 then raise exception 'private completion fields leaked into public projection'; end if;
end
$$;

rollback;
