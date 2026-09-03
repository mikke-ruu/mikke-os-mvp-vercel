begin;

do $$
declare
  v_names text[] := array[
    'community_invite_by_mikke_id',
    'community_leave',
    'community_submit_join_application',
    'community_review_join_application'
  ];
  v_name text;
  v_config text[];
begin
  foreach v_name in array v_names loop
    select procedure.proconfig
      into v_config
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_name;

    if v_config is distinct from array['search_path=""']::text[] then
      raise exception 'unsafe search_path for %: %', v_name, v_config;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.community_invite_by_mikke_id(uuid,text,text,timestamptz)',
    'execute'
  ) or has_function_privilege('anon', 'public.community_leave(uuid)', 'execute')
    or has_function_privilege(
      'anon',
      'public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.community_review_join_application(uuid,text,text)',
      'execute'
    ) then
    raise exception 'anon must not execute Community membership RPCs';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_invite_by_mikke_id(uuid,text,text,timestamptz)',
    'execute'
  ) or not has_function_privilege('authenticated', 'public.community_leave(uuid)', 'execute')
    or not has_function_privilege(
      'authenticated',
      'public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.community_review_join_application(uuid,text,text)',
      'execute'
    ) then
    raise exception 'authenticated must execute Community membership RPCs';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"c9020000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
set local role authenticated;

do $$
begin
  perform public.community_invite_by_mikke_id(
    'c9020000-0000-4000-8000-000000000010'::uuid,
    'anonymous-user',
    null,
    null
  );
  raise exception 'anonymous Auth invite unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_leave('c9020000-0000-4000-8000-000000000010'::uuid);
  raise exception 'anonymous Auth leave unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_submit_join_application(
    'c9020000-0000-4000-8000-000000000010'::uuid,
    'Anonymous',
    'Anonymous User',
    '09000000000',
    null,
    true,
    true,
    true
  );
  raise exception 'anonymous Auth application unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_review_join_application(
    'c9020000-0000-4000-8000-000000000020'::uuid,
    'approved',
    null
  );
  raise exception 'anonymous Auth review unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

reset role;

create function pg_temp.community_membership_assert(ok boolean, label text)
returns void
language plpgsql
as $$
begin
  if ok is distinct from true then
    raise exception 'Community membership assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_membership_denied(
  statement text,
  expected_code text,
  expected_message text
)
returns void
language plpgsql
as $$
declare
  actual_code text;
  actual_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics
      actual_code = returned_sqlstate,
      actual_message = message_text;
  end;

  if actual_code is distinct from expected_code
     or actual_message is distinct from expected_message then
    raise exception 'expected % / %, got % / %',
      expected_code, expected_message, actual_code, actual_message;
  end if;
end;
$$;

insert into auth.users (
  id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c9030000-0000-4000-8000-000000000001', 'community-owner@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c9030000-0000-4000-8000-000000000002', 'community-active@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c9030000-0000-4000-8000-000000000003', 'community-invitee@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c9030000-0000-4000-8000-000000000004', 'community-applicant@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (user_id, display_name, handle)
values
  ('c9030000-0000-4000-8000-000000000001', 'Community owner', 'community_owner_fixture'),
  ('c9030000-0000-4000-8000-000000000002', 'Active member', 'community_active_fixture'),
  ('c9030000-0000-4000-8000-000000000003', 'Invited member', 'community_invitee_fixture'),
  ('c9030000-0000-4000-8000-000000000004', 'Applicant', 'community_applicant_fixture');

insert into public.community_communities (
  id, slug, name, join_mode, status, owner_user_id
) values (
  'c9030000-0000-4000-8000-000000000010',
  'community-membership-rpc-fixture',
  'Community membership RPC fixture',
  'invite_only',
  'active',
  'c9030000-0000-4000-8000-000000000001'
);

insert into public.community_memberships (community_id, user_id, role, status)
values
  ('c9030000-0000-4000-8000-000000000010', 'c9030000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('c9030000-0000-4000-8000-000000000010', 'c9030000-0000-4000-8000-000000000002', 'member', 'active');

insert into public.community_entitlement_definitions (
  community_id, key, name, status
) values (
  'c9030000-0000-4000-8000-000000000010',
  'membership-fixture',
  'Membership fixture',
  'active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c9030000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'c9030000-0000-4000-8000-000000000001', true);
set local role authenticated;

select pg_temp.community_membership_denied(
  $$select public.community_invite_by_mikke_id(
    'c9030000-0000-4000-8000-000000000010',
    'community_invitee_fixture',
    'membership-fixture',
    now() - interval '1 second'
  )$$,
  '22023',
  'Invitation expiry must be in the future'
);

select pg_temp.community_membership_denied(
  $$select public.community_invite_by_mikke_id(
    'c9030000-0000-4000-8000-000000000010',
    'community_active_fixture',
    null,
    now() + interval '1 day'
  )$$,
  '23505',
  'This user is already an active member'
);

select public.community_invite_by_mikke_id(
  'c9030000-0000-4000-8000-000000000010',
  'community_invitee_fixture',
  'membership-fixture',
  now() + interval '1 day'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c9030000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'c9030000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.community_membership_denied(
  $$select public.community_submit_join_application(
    'c9030000-0000-4000-8000-000000000010',
    'Active member', 'Active member', '09000000000', null,
    true, true, true
  )$$,
  '23505',
  'This user is already an active member'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c9030000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'c9030000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.community_submit_join_application(
  'c9030000-0000-4000-8000-000000000010',
  'Invited member', 'Invited member', '09000000000', null,
  true, true, true
);
select pg_temp.community_membership_assert(
  exists (
    select 1 from public.community_memberships
    where community_id = 'c9030000-0000-4000-8000-000000000010'
      and user_id = 'c9030000-0000-4000-8000-000000000003'
      and status = 'active'
  ),
  'invited application activates membership'
);
select pg_temp.community_membership_assert(
  exists (
    select 1 from public.community_invitations
    where community_id = 'c9030000-0000-4000-8000-000000000010'
      and invited_user_id = 'c9030000-0000-4000-8000-000000000003'
      and status = 'accepted'
  ),
  'invitation becomes accepted'
);
select public.community_leave('c9030000-0000-4000-8000-000000000010');
select pg_temp.community_membership_assert(
  exists (
    select 1 from public.community_memberships
    where community_id = 'c9030000-0000-4000-8000-000000000010'
      and user_id = 'c9030000-0000-4000-8000-000000000003'
      and status = 'left'
  ),
  'leaving member is marked left'
);
select pg_temp.community_membership_assert(
  exists (
    select 1 from public.community_member_entitlements
    where community_id = 'c9030000-0000-4000-8000-000000000010'
      and user_id = 'c9030000-0000-4000-8000-000000000003'
      and source = 'external'
      and status = 'revoked'
  ),
  'leaving member entitlement is revoked'
);
reset role;

update public.community_communities
set join_mode = 'open_free'
where id = 'c9030000-0000-4000-8000-000000000010';

select set_config(
  'request.jwt.claims',
  '{"sub":"c9030000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'c9030000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.community_submit_join_application(
  'c9030000-0000-4000-8000-000000000010',
  'Applicant', 'Applicant', '09000000000', null,
  true, true, true
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c9030000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'c9030000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.community_membership_denied(
  $$select public.community_leave('c9030000-0000-4000-8000-000000000010')$$,
  '42501',
  'The owner must transfer ownership before leaving'
);
select public.community_review_join_application(
  (
    select id from public.community_join_applications
    where community_id = 'c9030000-0000-4000-8000-000000000010'
      and user_id = 'c9030000-0000-4000-8000-000000000004'
  ),
  'approved',
  'Fixture approval'
);
select pg_temp.community_membership_denied(
  format(
    'select public.community_review_join_application(%L::uuid,%L,%L)',
    (
      select id from public.community_join_applications
      where community_id = 'c9030000-0000-4000-8000-000000000010'
        and user_id = 'c9030000-0000-4000-8000-000000000004'
    ),
    'approved',
    'Second review'
  ),
  '55000',
  'Only pending applications can be reviewed'
);
reset role;

select pg_temp.community_membership_assert(
  (
    select count(*) = 6
    from public.community_consent_records
    where community_id = 'c9030000-0000-4000-8000-000000000010'
  ),
  'both applications retain three consent records'
);

select 'community_membership_rpc_security_test_ok';

rollback;
