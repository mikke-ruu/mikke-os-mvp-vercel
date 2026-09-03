begin;

create function pg_temp.community_capacity_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community capacity assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_capacity_denied(statement text, expected_state text, expected_message text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected_state and sqlerrm = expected_message;
end;
$$;

select pg_temp.community_capacity_assert(
  not has_function_privilege('public', 'community_private.community_assert_new_membership_capacity(uuid,uuid,timestamptz)', 'execute')
  and not has_function_privilege('anon', 'community_private.community_assert_new_membership_capacity(uuid,uuid,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'community_private.community_assert_new_membership_capacity(uuid,uuid,timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'community_private.community_assert_new_membership_capacity(uuid,uuid,timestamptz)', 'execute'),
  'capacity guard is internal only'
);
select pg_temp.community_capacity_assert(
  not has_function_privilege('public', 'community_private.community_require_capacity_checked_activation()', 'execute')
  and not has_function_privilege('anon', 'community_private.community_require_capacity_checked_activation()', 'execute')
  and not has_function_privilege('authenticated', 'community_private.community_require_capacity_checked_activation()', 'execute')
  and not has_function_privilege('service_role', 'community_private.community_require_capacity_checked_activation()', 'execute'),
  'direct activation guard is internal only'
);

insert into auth.users(id, email, is_anonymous) values
  ('ca060000-0000-4000-8000-000000000001', 'owner@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000002', 'staff@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000003', 'submit@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000004', 'review@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000005', 'academy@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000006', 'payment@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000007', 'member7@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000008', 'member8@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000009', 'member9@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000010', 'member10@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000011', 'member11@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000012', 'member12@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000013', 'positive@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000014', 'owner2@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000015', 'member15@example.invalid', false),
  ('ca060000-0000-4000-8000-000000000016', 'member16@example.invalid', false);

insert into public.profiles(user_id, handle, display_name) values
  ('ca060000-0000-4000-8000-000000000001', 'capacity-owner', 'Capacity owner'),
  ('ca060000-0000-4000-8000-000000000002', 'capacity-staff', 'Capacity staff'),
  ('ca060000-0000-4000-8000-000000000003', 'capacity-submit', 'Capacity submit'),
  ('ca060000-0000-4000-8000-000000000004', 'capacity-review', 'Capacity review'),
  ('ca060000-0000-4000-8000-000000000005', 'capacity-academy', 'Capacity academy'),
  ('ca060000-0000-4000-8000-000000000006', 'capacity-payment', 'Capacity payment'),
  ('ca060000-0000-4000-8000-000000000013', 'capacity-positive', 'Capacity positive'),
  ('ca060000-0000-4000-8000-000000000014', 'capacity-owner2', 'Capacity owner 2');

insert into public.community_communities(id, slug, name, join_mode, owner_user_id) values
  ('cb060000-0000-4000-8000-000000000001', 'capacity-full', 'Capacity full', 'open_free', 'ca060000-0000-4000-8000-000000000001'),
  ('cb060000-0000-4000-8000-000000000002', 'capacity-open', 'Capacity open', 'open_free', 'ca060000-0000-4000-8000-000000000014');

update public.community_safety_settings
set approval_mode = 'auto'
where community_id in (
  'cb060000-0000-4000-8000-000000000001',
  'cb060000-0000-4000-8000-000000000002'
);

insert into public.community_memberships(community_id, user_id, role, status) values
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000002', 'moderator', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000007', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000008', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000009', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000010', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000011', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000012', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000015', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000016', 'member', 'active'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000004', 'member', 'left'),
  ('cb060000-0000-4000-8000-000000000001', 'ca060000-0000-4000-8000-000000000006', 'member', 'left'),
  ('cb060000-0000-4000-8000-000000000002', 'ca060000-0000-4000-8000-000000000014', 'owner', 'active');

-- Owner + staff + eight dedicated members = the trial cap of ten. Join,
-- Academy and payment candidates are deliberately not part of that count.

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values
  ('ca060000-0000-4000-8000-000000000001','community_platform','trial','verified_trial',
   'cc060000-0000-4000-8000-000000000001','cd060000-0000-4000-8000-000000000001','consumed',
   statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days','cb060000-0000-4000-8000-000000000001',statement_timestamp()),
  ('ca060000-0000-4000-8000-000000000014','community_platform','trial','verified_trial',
   'cc060000-0000-4000-8000-000000000002','cd060000-0000-4000-8000-000000000002','consumed',
   statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days','cb060000-0000-4000-8000-000000000002',statement_timestamp());

insert into public.community_join_applications(
  id,community_id,user_id,display_name,legal_name,email,phone,status
) values (
  'ce060000-0000-4000-8000-000000000001','cb060000-0000-4000-8000-000000000001',
  'ca060000-0000-4000-8000-000000000004','Review','Review','review@example.invalid','09000000000','pending'
);

insert into public.community_entitlement_definitions(id,community_id,key,name) values
  ('cf060000-0000-4000-8000-000000000001','cb060000-0000-4000-8000-000000000001','academy:test','Academy test'),
  ('cf060000-0000-4000-8000-000000000002','cb060000-0000-4000-8000-000000000001','paid:test','Paid test');
insert into public.community_access_source_mappings(
  id,community_id,provider_type,provider_owner_key,source_product_key,entitlement_key,status,created_by_user_id
) values (
  'd0060000-0000-4000-8000-000000000001','cb060000-0000-4000-8000-000000000001','academy_subscription',
  'hq-capacity','academy-capacity','academy:test','active','ca060000-0000-4000-8000-000000000001'
);
insert into public.community_academy_access_invitations(
  id,mapping_id,community_id,user_id,entitlement_key,source_reference,academy_role,status,starts_at,ends_at,expires_at
) values (
  'd1060000-0000-4000-8000-000000000001','d0060000-0000-4000-8000-000000000001',
  'cb060000-0000-4000-8000-000000000001','ca060000-0000-4000-8000-000000000005','academy:test',
  'academy-capacity-source','learner','pending',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days',statement_timestamp()+interval '1 day'
);
insert into public.community_membership_plans(
  id,community_id,entitlement_key,name,amount_yen,billing_interval,payment_provider_label,external_payment_url,status,created_by_user_id
) values (
  'd2060000-0000-4000-8000-000000000001','cb060000-0000-4000-8000-000000000001','paid:test',
  'Paid test',1000,'month','Fixture','https://example.invalid/pay','active','ca060000-0000-4000-8000-000000000001'
);
insert into public.community_payment_claims(id,community_id,plan_id,user_id,payer_name,status) values (
  'd3060000-0000-4000-8000-000000000001','cb060000-0000-4000-8000-000000000001',
  'd2060000-0000-4000-8000-000000000001','ca060000-0000-4000-8000-000000000006','Payment','pending'
);

-- The pre-existing membership UPDATE policy must not be an activation bypass.
select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$update public.community_memberships set status='active'
      where community_id='cb060000-0000-4000-8000-000000000001'
        and user_id='ca060000-0000-4000-8000-000000000004'$q$,
  '42501','COMMUNITY_MEMBERSHIP_ACTIVATION_REQUIRES_GUARDED_FLOW'), 'direct membership activation is rejected');
reset role;

select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$select public.community_submit_join_application('cb060000-0000-4000-8000-000000000001','Submit','Submit','09000000000','',true,true,true)$q$,
  '54000','COMMUNITY_MEMBER_CAPACITY_REACHED'), 'auto/invite activation stops at capacity');

reset role;
select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$select public.community_review_join_application('ce060000-0000-4000-8000-000000000001','approved',null)$q$,
  '54000','COMMUNITY_MEMBER_CAPACITY_REACHED'), 'staff approval stops at capacity');

reset role;
select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$select public.community_accept_academy_access_invitation('d1060000-0000-4000-8000-000000000001','Academy','Academy','09000000000','',true,true,true)$q$,
  '54000','COMMUNITY_MEMBER_CAPACITY_REACHED'), 'Academy invitation stops at capacity');

reset role;
select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$select public.community_review_payment_claim('d3060000-0000-4000-8000-000000000001',true,null)$q$,
  '54000','COMMUNITY_MEMBER_CAPACITY_REACHED'), 'payment claim reactivation stops at capacity');

reset role;
select pg_temp.community_capacity_assert(
  (select count(*)=10 from public.community_memberships where community_id='cb060000-0000-4000-8000-000000000001' and status='active'),
  'failed attempts do not exceed capacity'
);
select pg_temp.community_capacity_assert(
  (select status='pending' from public.community_join_applications where id='ce060000-0000-4000-8000-000000000001')
  and (select status='pending' from public.community_academy_access_invitations where id='d1060000-0000-4000-8000-000000000001')
  and (select status='pending' from public.community_payment_claims where id='d3060000-0000-4000-8000-000000000001')
  and not exists (
    select 1 from public.community_memberships
    where community_id='cb060000-0000-4000-8000-000000000001'
      and user_id in ('ca060000-0000-4000-8000-000000000003','ca060000-0000-4000-8000-000000000005')
  )
  and (select status='left' from public.community_memberships where community_id='cb060000-0000-4000-8000-000000000001' and user_id='ca060000-0000-4000-8000-000000000004')
  and (select status='left' from public.community_memberships where community_id='cb060000-0000-4000-8000-000000000001' and user_id='ca060000-0000-4000-8000-000000000006')
  and not exists (
    select 1 from public.community_member_entitlements
    where community_id='cb060000-0000-4000-8000-000000000001'
      and user_id in ('ca060000-0000-4000-8000-000000000003','ca060000-0000-4000-8000-000000000004','ca060000-0000-4000-8000-000000000005','ca060000-0000-4000-8000-000000000006')
  )
  and not exists (
    select 1 from public.community_academy_entitlement_claims
    where invitation_id='d1060000-0000-4000-8000-000000000001'
  ),
  'capacity rejection leaves applications and claims unchanged'
);

select pg_temp.community_capacity_assert(pg_temp.community_capacity_denied(
  $q$select community_private.community_assert_new_membership_capacity(
      'cb060000-0000-4000-8000-000000000002','ca060000-0000-4000-8000-000000000013',statement_timestamp()+interval '31 days'
    )$q$,
  '55000','COMMUNITY_MEMBER_CAPACITY_UNAVAILABLE'), 'expired or unknown capacity fails closed for new activation');

-- Existing active access remains untouched even after the trial has expired.
select community_private.community_assert_new_membership_capacity(
  'cb060000-0000-4000-8000-000000000001','ca060000-0000-4000-8000-000000000001',statement_timestamp()+interval '31 days'
);

-- A below-cap auto approval still runs the retained canonical implementation.
select set_config('request.jwt.claims','{"sub":"ca060000-0000-4000-8000-000000000013","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select public.community_submit_join_application(
  'cb060000-0000-4000-8000-000000000002','Positive','Positive','09000000000','',true,true,true
);
reset role;
select pg_temp.community_capacity_assert(
  exists(select 1 from public.community_memberships where community_id='cb060000-0000-4000-8000-000000000002' and user_id='ca060000-0000-4000-8000-000000000013' and status='active'),
  'below-cap activation succeeds'
);

select 'community_membership_capacity_enforcement_test_ok' as result;
rollback;
