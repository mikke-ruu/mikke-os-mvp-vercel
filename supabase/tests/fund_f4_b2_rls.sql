-- Fund F4-b2 production-safe claim, consent, and RLS verification.
-- It uses two existing Mikke profiles and rolls all fixture data back.

begin;

do $$
declare
  owner_a_user_id uuid;
  owner_a_profile_id uuid;
  supporter_b_user_id uuid;
  supporter_b_profile_id uuid;
  project_id uuid;
  support_id uuid;
  v_participation_id uuid;
  active_claim_id uuid;
  v_invite_token text;
  revoked_token text;
  expired_token text;
  visible_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  if has_table_privilege('authenticated', 'public.fund_support_claims', 'insert')
    or has_table_privilege('authenticated', 'public.fund_support_claims', 'update')
    or has_table_privilege('authenticated', 'public.fund_participations', 'insert')
    or has_table_privilege('authenticated', 'public.fund_participations', 'update')
    or has_table_privilege('authenticated', 'public.fund_public_participations', 'insert')
    or has_table_privilege('authenticated', 'public.fund_public_participations', 'update')
    or has_table_privilege('authenticated', 'public.fund_public_participations', 'delete') then
    raise exception 'authenticated has direct F4-b2 write privileges';
  end if;

  select user_id, id into owner_a_user_id, owner_a_profile_id
  from public.profiles order by created_at limit 1;
  select user_id, id into supporter_b_user_id, supporter_b_profile_id
  from public.profiles where user_id <> owner_a_user_id order by created_at limit 1;
  if owner_a_user_id is null or supporter_b_user_id is null then
    raise exception 'Fund F4-b2 RLS test requires profiles for two different auth users';
  end if;

  update public.profiles
  set handle = 'rls_owner_' || suffix
  where id = owner_a_profile_id;

  insert into public.fund_projects (owner_user_id, owner_profile_id, source_local_id, slug, title)
  values (owner_a_user_id, owner_a_profile_id, 'rls-b2-' || suffix, 'rls-b2-' || suffix, 'F4-b2 verification')
  returning id into project_id;
  insert into public.fund_supports (project_id, source_local_id, supporter_name, supporter_email, amount)
  values (project_id, 'rls-b2-support-' || suffix, 'private supporter', 'private@example.invalid', 1000)
  returning id into support_id;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select claim_id, invite_token into active_claim_id, v_invite_token
  from public.create_fund_support_claim(support_id, now() + interval '1 day');
  if active_claim_id is null or v_invite_token is null then
    raise exception 'owner could not create a claim';
  end if;
  select count(*) into visible_count from public.fund_support_claims where id = active_claim_id;
  if visible_count <> 1 then
    raise exception 'owner could not read own claim';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', supporter_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', supporter_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.fund_supports where id = support_id;
  if visible_count <> 0 then
    raise exception 'supporter could read owner-private support';
  end if;

  v_participation_id := public.accept_fund_support_claim(v_invite_token);
  if v_participation_id is null then
    raise exception 'supporter could not accept claim';
  end if;
  select count(*) into visible_count from public.fund_participations where id = v_participation_id;
  if visible_count <> 1 then
    raise exception 'supporter could not read own participation';
  end if;
  select count(*) into visible_count
  from public.activity_logs
  where user_id = supporter_b_user_id
    and profile_id = supporter_b_profile_id
    and activity_type = 'fund_participation_recorded'
    and source_service = 'fund'
    and source_record_id = v_participation_id::text
    and visibility = 'private'
    and display_on_story = false
    and counts_toward_summary = false
    and has_financial_value = false
    and amount is null;
  if visible_count <> 1 then
    raise exception 'claim acceptance did not create one private non-financial Activity Log';
  end if;

  begin
    update public.fund_participations set owner_consent_status = 'revoked' where id = v_participation_id;
    raise exception 'supporter directly updated a participation';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.update_fund_participation_consent(v_participation_id, 'revoked');
    raise exception 'supporter changed owner consent through RPC';
  exception when insufficient_privilege then null;
  end;

  perform public.update_fund_participation_consent(
    v_participation_id,
    null,
    'granted',
    'Supporter B',
    'public_name'
  );

  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id;
  if visible_count <> 0 then
    raise exception 'private Fund project propagated to the public projection';
  end if;

  begin
    perform public.accept_fund_support_claim(v_invite_token);
    raise exception 'a redeemed claim token was reused';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  update public.fund_projects set visibility = 'public' where id = project_id;
  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id
    and project_title = 'F4-b2 verification'
    and supporter_profile_id = supporter_b_profile_id
    and display_name = 'Supporter B'
    and is_anonymous = false
    and public_fund_path = '/fund/rls_owner_' || suffix || '/rls-b2-' || suffix;
  if visible_count <> 1 then
    raise exception 'public projection was not created with the Story-safe fields';
  end if;

  update public.profiles
  set handle = 'rls_owner_changed_' || suffix
  where id = owner_a_profile_id;
  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id
    and public_fund_path = '/fund/rls_owner_changed_' || suffix || '/rls-b2-' || suffix;
  if visible_count <> 1 then
    raise exception 'owner handle change did not resync the public Fund path';
  end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 1 then
    raise exception 'anon could not read the public-safe projection';
  end if;
  select count(*) into visible_count
  from public.activity_logs
  where source_service = 'fund'
    and source_record_id = v_participation_id::text;
  if visible_count <> 0 then
    raise exception 'anon could read the private Fund participation Activity Log';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.update_fund_participation_consent(v_participation_id, 'revoked');
  execute 'reset role';
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 0 then
    raise exception 'revoked consent did not remove the public projection';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.update_fund_participation_consent(v_participation_id, 'granted');
  execute 'reset role';
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 1 then
    raise exception 'owner could not regrant public projection consent';
  end if;

  update public.fund_projects set visibility = 'unlisted' where id = project_id;
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 0 then
    raise exception 'unlisted Fund project propagated to the public projection';
  end if;
  update public.fund_projects set visibility = 'public' where id = project_id;

  perform set_config('request.jwt.claims', json_build_object('sub', supporter_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', supporter_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.update_fund_participation_consent(v_participation_id, null, 'revoked', null, null);
  execute 'reset role';
  select count(*) into visible_count from public.fund_public_participations where participation_id = v_participation_id;
  if visible_count <> 0 then
    raise exception 'supporter revoke did not remove the public projection';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', supporter_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', supporter_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.update_fund_participation_consent(v_participation_id, null, 'granted', 'Hidden Supporter', 'anonymous');
  execute 'reset role';
  select count(*) into visible_count
  from public.fund_public_participations
  where participation_id = v_participation_id
    and project_title = 'F4-b2 verification'
    and supporter_profile_id is null
    and display_name = '匿名の応援者'
    and is_anonymous = true;
  if visible_count <> 1 then
    raise exception 'anonymous projection exposed identity or omitted the public Fund row';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select invite_token into revoked_token
  from public.create_fund_support_claim(support_id, now() + interval '1 day');
  perform public.revoke_fund_support_claim((select id from public.fund_support_claims where token_hash = encode(digest(revoked_token, 'sha256'), 'hex')));
  select invite_token into expired_token
  from public.create_fund_support_claim(support_id, now() + interval '1 day');
  execute 'reset role';
  update public.fund_support_claims
  set created_at = now() - interval '2 days',
      expires_at = now() - interval '1 day'
  where token_hash = encode(digest(expired_token, 'sha256'), 'hex');

  perform set_config('request.jwt.claims', json_build_object('sub', supporter_b_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', supporter_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.accept_fund_support_claim(revoked_token);
    raise exception 'a revoked claim token was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_fund_support_claim(expired_token);
    raise exception 'an expired claim token was accepted';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  raise notice 'Fund F4-b2 RLS verification passed; transaction will roll back';
end;
$$;

rollback;
