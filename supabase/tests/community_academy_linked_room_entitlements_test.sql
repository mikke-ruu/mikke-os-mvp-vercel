-- Academy-to-Community linked-Room contract test. All fixtures roll back.
-- Run after the Academy seven-day trial foundation so Academy mappings are
-- backed by a concrete paid headquarters access state.

begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_linked_user uuid := gen_random_uuid();
  v_existing_member uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_suspended_user uuid := gen_random_uuid();
  v_future_user uuid := gen_random_uuid();
  v_community uuid := gen_random_uuid();
  v_headquarters uuid := gen_random_uuid();
  v_mapping uuid := gen_random_uuid();
  v_replacement_mapping uuid;
  v_free_room uuid := gen_random_uuid();
  v_academy_room uuid := gen_random_uuid();
  v_event uuid := gen_random_uuid();
  v_resource uuid := gen_random_uuid();
  v_invitation_one uuid;
  v_invitation_two uuid;
  v_existing_invitation uuid;
  v_archived_invitation uuid;
  v_expired_invitation uuid;
  v_suspended_invitation uuid;
  v_future_invitation uuid;
  v_plan_same uuid := gen_random_uuid();
  v_plan_other uuid := gen_random_uuid();
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_count integer;
begin
  if has_table_privilege('anon', 'public.community_academy_entitlement_claims', 'select')
    or has_table_privilege('authenticated', 'public.community_academy_entitlement_claims', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'public.community_academy_access_invitations', 'select,insert,update,delete') then
    raise exception 'Academy claim ledger has unsafe client grants';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.community_sync_academy_entitlement(uuid,uuid,text,text,timestamptz,timestamptz)',
    'execute'
  ) then
    raise exception 'Authenticated users can execute the service-only Academy sync';
  end if;
  if has_table_privilege('authenticated', 'public.community_payment_claims', 'insert') then
    raise exception 'Payment claims still allow direct insert';
  end if;

  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner, 'academy-community-owner-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_linked_user, 'academy-community-linked-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_existing_member, 'academy-community-existing-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_other_user, 'academy-community-other-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_suspended_user, 'academy-community-suspended-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_future_user, 'academy-community-future-' || v_suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.community_communities (id, slug, name, join_mode, status, owner_user_id)
  values (v_community, 'academy-community-' || v_suffix, 'Academy Community test', 'invite_only', 'active', v_owner);

  insert into public.academy_headquarters (
    id, owner_user_id, name, handle, plan, is_active
  ) values (
    v_headquarters, v_owner, 'Academy Community test headquarters',
    'academy-community-' || v_suffix, 'small', true
  );

  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
  ) values (
    v_headquarters, v_owner, 'paid', 'active', now(), now()
  );

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_owner, 'role', 'authenticated', 'is_anonymous', true
  )::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.academy_list_my_community_link_options(v_headquarters);
    raise exception 'Anonymous Auth user listed Academy Community links';
  exception when others then
    if sqlerrm <> 'Anonymous Auth users cannot manage Academy Community links' then raise; end if;
  end;
  begin
    perform public.academy_upsert_community_room_link(
      v_headquarters, v_community, 'course:test', 'academy-room', 'draft'
    );
    raise exception 'Anonymous Auth user changed an Academy Community link';
  exception when others then
    if sqlerrm <> 'Anonymous Auth users cannot manage Academy Community links' then raise; end if;
  end;
  execute 'reset role';

  insert into public.community_safety_settings (community_id)
  values (v_community)
  on conflict (community_id) do nothing;

  insert into public.community_memberships (community_id, user_id, role, status, access_scope)
  values
    (v_community, v_owner, 'owner', 'active', 'community'),
    (v_community, v_existing_member, 'member', 'active', 'community'),
    (v_community, v_suspended_user, 'member', 'suspended', 'community');

  insert into public.community_member_profiles (community_id, user_id, display_name)
  values
    (v_community, v_owner, 'Owner'),
    (v_community, v_existing_member, 'Existing member');

  insert into public.community_entitlement_definitions (community_id, key, name, status)
  values
    (v_community, 'academy-room', 'Academy Room', 'active'),
    (v_community, 'community-paid', 'Community paid Room', 'active');

  insert into public.community_access_source_mappings (
    id, community_id, provider_type, provider_owner_key, source_product_key,
    entitlement_key, status, created_by_user_id
  ) values (
    v_mapping, v_community, 'academy_subscription', v_headquarters::text,
    'course:test', 'academy-room', 'active', v_owner
  );

  insert into public.community_rooms (id, community_id, title, access_type)
  values
    (v_free_room, v_community, 'Free Room', 'free'),
    (v_academy_room, v_community, 'Academy linked Room', 'entitlement');
  insert into public.community_room_entitlement_rules (community_id, room_id, entitlement_key)
  values (v_community, v_academy_room, 'academy-room');

  insert into public.community_events (id, community_id, title, starts_at, status)
  values (v_event, v_community, 'Community-wide event', now() + interval '1 day', 'open');
  insert into public.community_resources (id, community_id, title, kind, external_url, is_published)
  values (v_resource, v_community, 'Community-wide resource', 'web', 'https://example.invalid/resource', true);

  insert into public.community_membership_plans (
    id, community_id, entitlement_key, name, amount_yen, billing_interval,
    payment_provider_label, external_payment_url, status, created_by_user_id
  ) values
    (v_plan_same, v_community, 'academy-room', 'Equivalent paid plan', 1000, 'month', 'external', 'https://example.invalid/same', 'active', v_owner),
    (v_plan_other, v_community, 'community-paid', 'Other paid plan', 2000, 'month', 'external', 'https://example.invalid/other', 'active', v_owner);

  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_invitation_one := public.community_create_academy_access_invitation(
    v_mapping, v_linked_user, 'academy-enrollment:1', 'learner', now() - interval '1 hour', null, now() + interval '7 days'
  );
  v_invitation_two := public.community_create_academy_access_invitation(
    v_mapping, v_linked_user, 'academy-enrollment:2', 'instructor', now() - interval '1 hour', null, now() + interval '7 days'
  );
  v_existing_invitation := public.community_create_academy_access_invitation(
    v_mapping, v_existing_member, 'academy-existing:1', 'learner', now() - interval '1 hour', null, now() + interval '7 days'
  );
  v_archived_invitation := public.community_create_academy_access_invitation(
    v_mapping, v_other_user, 'academy-archived:1', 'learner', now() - interval '1 hour', null, now() + interval '7 days'
  );
  v_expired_invitation := public.community_create_academy_access_invitation(
    v_mapping, v_other_user, 'academy-expired:1', 'learner', now() - interval '2 days', now() - interval '1 day', now() + interval '7 days'
  );
  v_suspended_invitation := public.community_create_academy_access_invitation(
    v_mapping, v_suspended_user, 'academy-suspended:1', 'learner', now() - interval '1 hour', null, now() + interval '7 days'
  );
  v_future_invitation := public.community_create_academy_access_invitation(
    v_mapping, v_future_user, 'academy-future:1', 'learner', now() + interval '1 day', now() + interval '2 days', now() + interval '7 days'
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_linked_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_linked_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  begin
    perform public.community_accept_academy_access_invitation(
      v_invitation_one, 'Linked learner', 'Linked learner', '09000000000', '',
      true, false, true
    );
    raise exception 'Academy invitation accepted without all three Community consents';
  exception when others then
    if sqlerrm = 'Academy invitation accepted without all three Community consents' then raise; end if;
  end;

  perform public.community_accept_academy_access_invitation(
    v_invitation_one, 'Linked learner', 'Linked learner', '09000000000', '',
    true, true, true
  );
  perform public.community_accept_academy_access_invitation(
    v_invitation_two, 'Linked learner', 'Linked learner', '09000000000', '',
    true, true, true
  );

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_future_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_future_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.community_accept_academy_access_invitation(
    v_future_invitation, 'Future learner', 'Future learner', '09000000004', '',
    true, true, true
  );

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_linked_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_linked_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  if community_private.can_access_room(v_free_room) then
    raise exception 'linked_rooms member can access a normal free Room';
  end if;
  if not community_private.can_access_room(v_academy_room) then
    raise exception 'linked_rooms member cannot access the mapped Academy Room';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.role', 'service_role', true);
  begin
    update public.community_access_source_mappings
    set entitlement_key = 'community-paid'
    where id = v_mapping;
    raise exception 'Active Academy mapping was retargeted while a claim was active';
  exception when others then
    if sqlerrm = 'Active Academy mapping was retargeted while a claim was active' then raise; end if;
  end;
  begin
    update public.community_access_source_mappings
    set status = 'archived'
    where id = v_mapping;
    raise exception 'Academy mapping was archived while a claim was active';
  exception when others then
    if sqlerrm = 'Academy mapping was archived while a claim was active' then raise; end if;
  end;
  begin
    update public.community_academy_entitlement_claims
    set source_reference = 'tampered-source'
    where mapping_id = v_mapping and user_id = v_linked_user;
    raise exception 'Academy immutable claim identity was changed';
  exception when others then
    if sqlerrm = 'Academy immutable claim identity was changed' then raise; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.academy_upsert_community_room_link(
      v_headquarters, v_community, 'course:test', 'community-paid', 'active'
    );
    raise exception 'Academy Room scope changed before active claims were revoked';
  exception when others then
    if sqlerrm = 'Academy Room scope changed before active claims were revoked' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_linked_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_linked_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  if exists (select 1 from public.community_events where id = v_event) then
    raise exception 'linked_rooms member can read a Community-wide event';
  end if;
  if exists (select 1 from public.community_resources where id = v_resource) then
    raise exception 'linked_rooms member can read a Community-wide resource';
  end if;
  begin
    insert into public.community_event_attendees (event_id, user_id, status)
    values (v_event, v_linked_user, 'going');
    raise exception 'linked_rooms member can register for a Community-wide event';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.community_create_payment_claim(
      v_community, v_plan_same, 'Linked learner', null, null
    );
    raise exception 'Equivalent paid Community claim was accepted during active Academy benefit';
  exception when others then
    if sqlerrm = 'Equivalent paid Community claim was accepted during active Academy benefit' then raise; end if;
  end;

  perform public.community_create_payment_claim(
    v_community, v_plan_other, 'Linked learner', null, null
  );

  begin
    update public.community_academy_entitlement_claims
    set status = 'revoked'
    where user_id = v_linked_user;
    raise exception 'Authenticated participant directly updated Academy claim ledger';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.community_academy_access_invitations where user_id = v_linked_user;
    raise exception 'Authenticated invitee directly read Academy invitation internals';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';

  -- A pending Community payment must be resolved explicitly before Academy
  -- acceptance; neither path silently cancels, refunds or duplicates it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_existing_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_existing_member::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.community_create_payment_claim(
    v_community, v_plan_same, 'Existing member', null, 'pending before Academy'
  );
  begin
    perform public.community_accept_academy_access_invitation(
      v_existing_invitation, 'Existing member', 'Existing member', '09000000001', '',
      true, true, true
    );
    raise exception 'Academy invitation accepted while equivalent payment claim was pending';
  exception when others then
    if sqlerrm = 'Academy invitation accepted while equivalent payment claim was pending' then raise; end if;
  end;
  update public.community_payment_claims
  set status = 'cancelled'
  where community_id = v_community and user_id = v_existing_member and plan_id = v_plan_same and status = 'pending';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_suspended_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_suspended_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.community_accept_academy_access_invitation(
      v_suspended_invitation, 'Suspended member', 'Suspended member', '09000000002', '',
      true, true, true
    );
    raise exception 'Academy invitation reactivated a suspended Community member';
  exception when others then
    if sqlerrm = 'Academy invitation reactivated a suspended Community member' then raise; end if;
  end;
  execute 'reset role';
  if not exists (
    select 1 from public.community_memberships
    where community_id = v_community and user_id = v_suspended_user and status = 'suspended'
  ) then
    raise exception 'Suspended Community membership was changed';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.community_sync_academy_entitlement(
    v_mapping, v_linked_user, 'academy-enrollment:1', 'revoked', now() - interval '1 hour', null
  );
  if not exists (
    select 1 from public.community_academy_entitlement_claims
    where mapping_id = v_mapping and user_id = v_linked_user
      and source_reference = 'academy-enrollment:2' and status = 'active'
  ) then
    raise exception 'Revoking one Academy source revoked another source';
  end if;
  if not exists (
    select 1 from public.community_memberships
    where community_id = v_community and user_id = v_linked_user
      and status = 'active' and access_scope = 'linked_rooms'
  ) then
    raise exception 'Linked membership ended while another Academy source remained active';
  end if;

  perform public.community_sync_academy_entitlement(
    v_mapping, v_linked_user, 'academy-enrollment:2', 'revoked', now() - interval '1 hour', null
  );
  if not exists (
    select 1 from public.community_memberships
    where community_id = v_community and user_id = v_linked_user
      and status = 'left' and access_scope = 'linked_rooms'
  ) then
    raise exception 'Academy-only membership did not end after the final Academy source was revoked';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_existing_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_existing_member::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  perform public.community_accept_academy_access_invitation(
    v_existing_invitation, 'Existing member', 'Existing member', '09000000001', '',
    true, true, true
  );
  if not community_private.can_access_room(v_free_room) then
    raise exception 'Existing normal Community member lost normal Community scope';
  end if;
  execute 'reset role';

  -- Even if a pending claim is introduced by a trusted integration during a
  -- race, staff approval is guarded at the database boundary.
  insert into public.community_payment_claims (
    community_id, plan_id, user_id, payer_name, note, status
  ) values (
    v_community, v_plan_same, v_existing_member, 'Existing member', 'race fixture', 'pending'
  );
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.community_review_payment_claim(
      (select id from public.community_payment_claims
       where community_id = v_community and user_id = v_existing_member
         and plan_id = v_plan_same and status = 'pending'),
      true,
      'must fail'
    );
    raise exception 'Staff approved an equivalent payment claim during active Academy access';
  exception when others then
    if sqlerrm = 'Staff approved an equivalent payment claim during active Academy access' then raise; end if;
  end;
  execute 'reset role';

  insert into public.community_member_entitlements (
    community_id, user_id, entitlement_key, source, source_reference, status
  ) values (
    v_community, v_existing_member, 'academy-room', 'subscription', 'existing-paid-contract', 'active'
  );

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.community_sync_academy_entitlement(
    v_mapping, v_existing_member, 'academy-existing:1', 'revoked', now() - interval '1 hour', null
  );
  if not exists (
    select 1 from public.community_memberships
    where community_id = v_community and user_id = v_existing_member
      and status = 'active' and access_scope = 'community'
  ) then
    raise exception 'Academy revocation changed the existing normal Community membership';
  end if;
  if not exists (
    select 1 from public.community_member_entitlements
    where community_id = v_community and user_id = v_existing_member
      and entitlement_key = 'academy-room'
      and source = 'subscription' and source_reference = 'existing-paid-contract' and status = 'active'
  ) then
    raise exception 'Academy revocation changed the existing paid Community entitlement';
  end if;

  select count(*) into v_count
  from public.community_consent_records consent
  join public.community_join_applications application on application.id = consent.application_id
  where application.community_id = v_community
    and application.user_id = v_linked_user
    and consent.document_type in ('terms', 'rules', 'privacy');
  if v_count <> 3 then
    raise exception 'Versioned Community consent record is incomplete';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform 1 from public.community_academy_entitlement_claims where community_id = v_community;
    raise exception 'Another user can read Academy entitlement claims';
  exception when insufficient_privilege then null;
  end;
  if public.community_get_my_academy_access_invitation(v_expired_invitation) is not null then
    raise exception 'Expired Academy access invitation was returned as joinable';
  end if;
  begin
    perform public.community_accept_academy_access_invitation(
      v_expired_invitation, 'Other user', 'Other user', '09000000003', '',
      true, true, true
    );
    raise exception 'Expired Academy access invitation was accepted';
  exception when others then
    if sqlerrm = 'Expired Academy access invitation was accepted' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_other_user, 'role', 'authenticated', 'is_anonymous', true
  )::text, true);
  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  if public.community_get_my_academy_access_invitation(v_archived_invitation) is not null then
    raise exception 'Anonymous Auth user can read Academy invitation';
  end if;
  begin
    perform public.community_accept_academy_access_invitation(
      v_archived_invitation, 'Anonymous', 'Anonymous', '09000000003', '',
      true, true, true
    );
    raise exception 'Anonymous Auth user accepted Academy invitation';
  exception when others then
    if sqlerrm = 'Anonymous Auth user accepted Academy invitation' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.academy_upsert_community_room_link(
      v_headquarters, v_community, 'course:test', 'community-paid', 'active'
    );
    raise exception 'Academy Room scope changed while a future accepted claim remained active';
  exception when others then
    if sqlerrm = 'Academy Room scope changed while a future accepted claim remained active' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.community_sync_academy_entitlement(
    v_mapping, v_future_user, 'academy-future:1', 'revoked', now() + interval '1 day', now() + interval '2 days'
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  v_replacement_mapping := public.academy_upsert_community_room_link(
    v_headquarters, v_community, 'course:test', 'community-paid', 'active'
  );
  execute 'reset role';

  if v_replacement_mapping = v_mapping then
    raise exception 'Academy mapping scope change overwrote immutable mapping history';
  end if;
  if not exists (
    select 1 from public.community_access_source_mappings
    where id = v_mapping and status = 'archived' and entitlement_key = 'academy-room'
  ) then
    raise exception 'Old Academy mapping was not archived during scope change';
  end if;
  if not exists (
    select 1 from public.community_access_source_mappings
    where id = v_replacement_mapping and status = 'active' and entitlement_key = 'community-paid'
  ) then
    raise exception 'Replacement Academy mapping was not created for the new scope';
  end if;
  select count(*) into v_count
  from public.community_access_source_mappings
  where community_id = v_community
    and provider_type = 'academy_subscription'
    and provider_owner_key = v_headquarters::text
    and source_product_key = 'course:test'
    and status <> 'archived';
  if v_count <> 1 then
    raise exception 'Academy source has more than one current mapping version';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    perform public.community_accept_academy_access_invitation(
      v_archived_invitation, 'Other user', 'Other user', '09000000003', '',
      true, true, true
    );
    raise exception 'Archived Academy mapping still accepted a pending invitation';
  exception when others then
    if sqlerrm = 'Archived Academy mapping still accepted a pending invitation' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.role', 'service_role', true);
  begin
    perform public.community_sync_academy_entitlement(
      v_mapping, v_existing_member, 'academy-existing:1', 'active', now() - interval '1 hour', null
    );
    raise exception 'Archived Academy mapping reactivated a revoked claim';
  exception when others then
    if sqlerrm = 'Archived Academy mapping reactivated a revoked claim' then raise; end if;
  end;
end;
$$;

rollback;
