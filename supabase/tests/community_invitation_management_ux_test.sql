begin;

create function pg_temp.community_invitation_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community invitation assertion failed: %', label;
  end if;
end;
$$;

select pg_temp.community_invitation_assert(
  has_function_privilege('authenticated', 'public.community_update_pending_invitation(uuid,text,timestamptz)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.community_revoke_pending_invitation(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.community_update_pending_invitation(uuid,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.community_revoke_pending_invitation(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.community_update_pending_invitation(uuid,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.community_revoke_pending_invitation(uuid)', 'EXECUTE'),
  'only authenticated receives execute privileges'
);

create function pg_temp.community_invitation_denied(statement text, expected_state text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected_state;
end;
$$;

insert into auth.users(id, email, is_anonymous) values
  ('de100000-0000-4000-8000-000000000001', 'invitation-owner@example.invalid', false),
  ('de100000-0000-4000-8000-000000000002', 'invitation-moderator@example.invalid', false),
  ('de100000-0000-4000-8000-000000000003', 'invitation-target@example.invalid', false),
  ('de100000-0000-4000-8000-000000000004', 'invitation-other-owner@example.invalid', false),
  ('de100000-0000-4000-8000-000000000005', 'invitation-other@example.invalid', false),
  ('de100000-0000-4000-8000-000000000006', 'invitation-anon@example.invalid', true),
  ('de100000-0000-4000-8000-000000000007', 'invitation-expired@example.invalid', false),
  ('de100000-0000-4000-8000-000000000008', 'invitation-accepted@example.invalid', false);

insert into public.profiles(user_id, handle, display_name) values
  ('de100000-0000-4000-8000-000000000001', 'invite-owner', 'Invite owner'),
  ('de100000-0000-4000-8000-000000000002', 'invite-moderator', 'Invite moderator'),
  ('de100000-0000-4000-8000-000000000003', 'invite-target', 'Invite target'),
  ('de100000-0000-4000-8000-000000000004', 'invite-other-owner', 'Other owner'),
  ('de100000-0000-4000-8000-000000000005', 'invite-other', 'Other user'),
  ('de100000-0000-4000-8000-000000000006', 'invite-anon', 'Anonymous user'),
  ('de100000-0000-4000-8000-000000000007', 'invite-expired', 'Expired target'),
  ('de100000-0000-4000-8000-000000000008', 'invite-accepted', 'Accepted target');

insert into public.community_communities(id, slug, name, join_mode, owner_user_id) values
  ('de110000-0000-4000-8000-000000000001', 'invitation-community', 'Invitation Community', 'invite_only', 'de100000-0000-4000-8000-000000000001'),
  ('de110000-0000-4000-8000-000000000002', 'other-invitation-community', 'Other Invitation Community', 'invite_only', 'de100000-0000-4000-8000-000000000004');

insert into public.community_memberships(community_id, user_id, role, status) values
  ('de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000002', 'moderator', 'active'),
  ('de110000-0000-4000-8000-000000000002', 'de100000-0000-4000-8000-000000000004', 'owner', 'active');

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values
  (
    'de100000-0000-4000-8000-000000000001', 'community_platform', 'trial', 'verified_trial',
    'de140000-0000-4000-8000-000000000001', 'de150000-0000-4000-8000-000000000001', 'consumed',
    statement_timestamp() - interval '1 day', statement_timestamp() + interval '29 days',
    'de110000-0000-4000-8000-000000000001', statement_timestamp()
  ),
  (
    'de100000-0000-4000-8000-000000000004', 'community_platform', 'trial', 'verified_trial',
    'de140000-0000-4000-8000-000000000002', 'de150000-0000-4000-8000-000000000002', 'consumed',
    statement_timestamp() - interval '1 day', statement_timestamp() + interval '29 days',
    'de110000-0000-4000-8000-000000000002', statement_timestamp()
  );

insert into public.community_entitlement_definitions(id, community_id, key, name, status) values
  ('de120000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001', 'invite:basic', 'Basic', 'active'),
  ('de120000-0000-4000-8000-000000000002', 'de110000-0000-4000-8000-000000000001', 'invite:premium', 'Premium', 'active'),
  ('de120000-0000-4000-8000-000000000003', 'de110000-0000-4000-8000-000000000002', 'other:premium', 'Other premium', 'active');

insert into public.community_invitations(
  community_id, invited_user_id, invited_by_user_id, invited_mikke_id,
  entitlement_key, status, expires_at
) values (
  'de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000003',
  'de100000-0000-4000-8000-000000000001', 'invite-target', 'invite:basic',
  'pending', statement_timestamp() + interval '7 days'
);

select pg_temp.community_invitation_assert(
  exists (
    select 1 from public.community_invitations
    where community_id = 'de110000-0000-4000-8000-000000000001'
      and invited_user_id = 'de100000-0000-4000-8000-000000000003'
      and status = 'pending'
      and entitlement_key = 'invite:basic'
  ),
  'pending mikke ID invitation fixture is available'
);

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000002', true);
set local role authenticated;
select public.community_update_pending_invitation(
  (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003'),
  'invite:premium', statement_timestamp() + interval '14 days'
);
reset role;

select pg_temp.community_invitation_assert(
  exists (
    select 1 from public.community_invitations
    where invited_user_id = 'de100000-0000-4000-8000-000000000003'
      and invited_mikke_id = 'invite-target'
      and invited_by_user_id = 'de100000-0000-4000-8000-000000000001'
      and entitlement_key = 'invite:premium'
      and status = 'pending'
      and expires_at > statement_timestamp()
  ),
  'moderator changes only the planned entitlement and expiry'
);

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.community_invitation_assert(
  (select count(*) = 1 from public.community_invitations where community_id = 'de110000-0000-4000-8000-000000000001'),
  'invitee can read the own invitation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.community_invitation_assert(
  (select count(*) = 0 from public.community_invitations where community_id = 'de110000-0000-4000-8000-000000000001'),
  'unrelated account cannot read another invitation'
);
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_update_pending_invitation(
      (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003'),
      'invite:basic', null
    )$q$,
    '42501'
  ),
  'unrelated account cannot update an invitation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000004', true);
set local role authenticated;
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_revoke_pending_invitation(
      (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003')
    )$q$,
    '42501'
  ),
  'staff from another Community cannot revoke the invitation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":true}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000006', true);
set local role authenticated;
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_update_pending_invitation(
      (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003'),
      'invite:basic', null
    )$q$,
    '42501'
  ),
  'anonymous Auth account cannot update an invitation'
);
reset role;

insert into public.community_invitations(
  id, community_id, invited_user_id, invited_by_user_id, invited_mikke_id,
  entitlement_key, status, expires_at, accepted_at
) values
  ('de130000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000007', 'de100000-0000-4000-8000-000000000001', 'invite-expired', 'invite:basic', 'pending', statement_timestamp() - interval '1 minute', null),
  ('de130000-0000-4000-8000-000000000002', 'de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000008', 'de100000-0000-4000-8000-000000000001', 'invite-accepted', 'invite:basic', 'accepted', null, statement_timestamp());

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
select set_config('request.jwt.claim.sub', 'de100000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_update_pending_invitation('de130000-0000-4000-8000-000000000001', 'invite:premium', null)$q$,
    '55000'
  ),
  'expired pending invitation cannot be updated'
);
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_revoke_pending_invitation('de130000-0000-4000-8000-000000000002')$q$,
    '55000'
  ),
  'accepted invitation cannot be revoked'
);
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$select public.community_update_pending_invitation(
      (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003'),
      'other:premium', null
    )$q$,
    '22023'
  ),
  'entitlement from another Community is rejected'
);
select pg_temp.community_invitation_assert(
  pg_temp.community_invitation_denied(
    $q$update public.community_invitations
      set invited_user_id = 'de100000-0000-4000-8000-000000000005'
      where invited_user_id = 'de100000-0000-4000-8000-000000000003'$q$,
    '42501'
  ),
  'authenticated clients cannot directly mutate invitation identity'
);
select public.community_revoke_pending_invitation(
  (select id from public.community_invitations where invited_user_id = 'de100000-0000-4000-8000-000000000003')
);
reset role;

select pg_temp.community_invitation_assert(
  exists (
    select 1 from public.community_invitations
    where invited_user_id = 'de100000-0000-4000-8000-000000000003'
      and invited_mikke_id = 'invite-target'
      and invited_by_user_id = 'de100000-0000-4000-8000-000000000001'
      and entitlement_key = 'invite:premium'
      and status = 'revoked'
      and accepted_at is null
  ),
  'revocation preserves invitation identity and planned entitlement history'
);

select 'community_invitation_management_ux_test_ok' as result;
rollback;
