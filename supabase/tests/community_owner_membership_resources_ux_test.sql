begin;

create function pg_temp.community_owner_ux_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community owner UX assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_owner_ux_denied(statement text, expected_state text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected_state;
end;
$$;

select pg_temp.community_owner_ux_assert(
  has_function_privilege('authenticated', 'public.community_record_manual_payment(uuid,uuid,uuid,text,text,text,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.community_record_manual_payment(uuid,uuid,uuid,text,text,text,uuid)', 'execute')
  and not has_function_privilege('public', 'public.community_record_manual_payment(uuid,uuid,uuid,text,text,text,uuid)', 'execute'),
  'manual payment RPC ACL is narrow'
);

select pg_temp.community_owner_ux_assert(
  (select public is false and file_size_limit = 52428800
     from storage.buckets where id = 'community-resources'),
  'resource bucket is private and limited to 50MB'
);

select pg_temp.community_owner_ux_assert(
  (select count(*) = 3 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('community_resource_objects_select', 'community_resource_objects_insert', 'community_resource_objects_delete')),
  'resource object policies exist'
);

insert into auth.users(id, email, is_anonymous) values
  ('de100000-0000-4000-8000-000000000001', 'owner-community-owner-ux@example.invalid', false),
  ('de100000-0000-4000-8000-000000000002', 'member-community-owner-ux@example.invalid', false),
  ('de100000-0000-4000-8000-000000000003', 'outsider-community-owner-ux@example.invalid', false),
  ('de100000-0000-4000-8000-000000000004', 'anonymous-community-owner-ux@example.invalid', true);

insert into public.profiles(user_id, handle, display_name) values
  ('de100000-0000-4000-8000-000000000001', 'owner-community-owner-ux', 'Owner UX'),
  ('de100000-0000-4000-8000-000000000002', 'member-community-owner-ux', 'Member UX'),
  ('de100000-0000-4000-8000-000000000003', 'outsider-community-owner-ux', 'Outsider UX'),
  ('de100000-0000-4000-8000-000000000004', 'anonymous-community-owner-ux', 'Anonymous UX');

insert into public.community_communities(id, slug, name, join_mode, owner_user_id)
values ('de110000-0000-4000-8000-000000000001', 'community-owner-ux', 'Community owner UX', 'open_free', 'de100000-0000-4000-8000-000000000001');

select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$insert into public.community_resources(
      id,community_id,title,kind,external_url,storage_path,file_name,mime_type,file_size_bytes
    ) values (
      'de160000-0000-4000-8000-000000000001','de110000-0000-4000-8000-000000000001',
      'missing size','video','','de110000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000001/de100000-0000-4000-8000-000000000001/file.mp4','file.mp4','video/mp4',null
    )$q$, '23514'), 'partial file metadata is rejected independently');

select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$insert into public.community_resources(
      id,community_id,title,kind,external_url,storage_path,file_name,mime_type,file_size_bytes
    ) values (
      'de160000-0000-4000-8000-000000000003','de110000-0000-4000-8000-000000000001',
      'wrong namespace','video','','de990000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000003/de100000-0000-4000-8000-000000000001/file.mp4','file.mp4','video/mp4',100
    )$q$, '23514'), 'cross-namespace metadata is rejected independently');

select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$insert into public.community_resources(
      id,community_id,title,kind,external_url,storage_path,file_name,mime_type,file_size_bytes
    ) values (
      'de160000-0000-4000-8000-000000000004','de110000-0000-4000-8000-000000000001',
      'extra segment','pdf','','de110000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000004/de100000-0000-4000-8000-000000000001/file.pdf//hidden','file.pdf','application/pdf',100
    )$q$, '23514'), 'resource path must contain exactly four non-empty segments');

insert into public.community_memberships(community_id, user_id, role, status) values
  ('de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000002', 'member', 'active');

insert into public.community_member_profiles(community_id, user_id, display_name)
values ('de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000002', 'Member UX');

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values (
  'de100000-0000-4000-8000-000000000001', 'community_platform', 'trial', 'verified_trial',
  'de120000-0000-4000-8000-000000000001', 'de130000-0000-4000-8000-000000000001', 'consumed',
  statement_timestamp() - interval '1 day', statement_timestamp() + interval '29 days',
  'de110000-0000-4000-8000-000000000001', statement_timestamp()
);

insert into public.community_entitlement_definitions(id, community_id, key, name)
values ('de140000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001', 'paid:manual', '手動確認会員');

insert into public.community_membership_plans(
  id, community_id, entitlement_key, name, description, amount_yen,
  billing_interval, payment_provider_label, external_payment_url, status, created_by_user_id
) values (
  'de150000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001',
  'paid:manual', '手動確認会員', '外部支払いの確認用', 10000,
  'month', '運営者指定', '', 'active', 'de100000-0000-4000-8000-000000000001'
);

insert into public.community_resources(
  id, community_id, title, kind, external_url, storage_path,
  file_name, mime_type, file_size_bytes, is_published, published_at
) values (
  'de160000-0000-4000-8000-000000000002', 'de110000-0000-4000-8000-000000000001',
  '会員PDF', 'pdf', '',
  'de110000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000002/de100000-0000-4000-8000-000000000001/file.pdf',
  'file.pdf', 'application/pdf', 100, true, statement_timestamp()
);
insert into storage.objects(id, bucket_id, name, owner, metadata) values (
  'de180000-0000-4000-8000-000000000001', 'community-resources',
  'de990000-0000-4000-8000-000000000001/de980000-0000-4000-8000-000000000001/de970000-0000-4000-8000-000000000001/orphan.pdf',
  'de970000-0000-4000-8000-000000000001', '{"size":100,"mimetype":"application/pdf"}'
);

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$select public.community_record_manual_payment('de110000-0000-4000-8000-000000000001','de150000-0000-4000-8000-000000000001','de100000-0000-4000-8000-000000000002','uword_points',null,null,'de170000-0000-4000-8000-000000000001')$q$,
  '42501'), 'anonymous actor is denied');
reset role;

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$select public.community_record_manual_payment('de110000-0000-4000-8000-000000000001','de150000-0000-4000-8000-000000000001','de100000-0000-4000-8000-000000000002','bank_transfer',null,null,'de170000-0000-4000-8000-000000000002')$q$,
  '42501'), 'non-staff actor is denied');
reset role;

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select public.community_record_manual_payment(
  'de110000-0000-4000-8000-000000000001',
  'de150000-0000-4000-8000-000000000001',
  'de100000-0000-4000-8000-000000000002',
  'uword_points',
  'UW-POINT-001',
  '運営者確認',
  'de170000-0000-4000-8000-000000000003'
);
select public.community_record_manual_payment(
  'de110000-0000-4000-8000-000000000001',
  'de150000-0000-4000-8000-000000000001',
  'de100000-0000-4000-8000-000000000002',
  'uword_points',
  'UW-POINT-001',
  '運営者確認',
  'de170000-0000-4000-8000-000000000003'
);
select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$select public.community_record_manual_payment(
    'de110000-0000-4000-8000-000000000001','de150000-0000-4000-8000-000000000001',
    'de100000-0000-4000-8000-000000000002','bank_transfer','DIFFERENT','運営者確認',
    'de170000-0000-4000-8000-000000000003')$q$, '22023'), 'idempotency payload drift is rejected');

insert into storage.objects(id, bucket_id, name, owner, metadata) values (
  'de180000-0000-4000-8000-000000000002', 'community-resources',
  'de110000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000002/de100000-0000-4000-8000-000000000001/file.pdf',
  'de100000-0000-4000-8000-000000000001', '{"size":100,"mimetype":"application/pdf"}'
);
select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$insert into storage.objects(id,bucket_id,name,owner,metadata) values(
    'de180000-0000-4000-8000-000000000003','community-resources',
    'de990000-0000-4000-8000-000000000001/de160000-0000-4000-8000-000000000002/de100000-0000-4000-8000-000000000001/wrong.pdf',
    'de100000-0000-4000-8000-000000000001','{"size":100,"mimetype":"application/pdf"}')$q$,
  '42501'), 'cross-community object insert is rejected');
select pg_temp.community_owner_ux_assert(
  (select count(*) = 1 from storage.objects where id = 'de180000-0000-4000-8000-000000000002')
  and (select count(*) = 0 from storage.objects where id = 'de180000-0000-4000-8000-000000000001'),
  'owner can read the matching object only'
);
delete from storage.objects where id = 'de180000-0000-4000-8000-000000000001';
reset role;

select pg_temp.community_owner_ux_assert(
  exists (select 1 from storage.objects where id = 'de180000-0000-4000-8000-000000000001'),
  'owner cannot delete an orphan or another-community object'
);

insert into public.academy_headquarters(id, owner_user_id, name, handle, plan, is_active)
values ('dea00000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'Owner UX Academy', 'owner-ux-academy', 'small', true);
insert into public.academy_headquarters_access_states(headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at)
values ('dea00000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'paid', 'active', statement_timestamp(), statement_timestamp());
insert into public.community_access_source_mappings(
  id, community_id, provider_type, provider_owner_key, source_product_key,
  entitlement_key, status, created_by_user_id
) values (
  'deb00000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001',
  'academy_subscription', 'dea00000-0000-4000-8000-000000000001', 'course:owner-ux',
  'paid:manual', 'active', 'de100000-0000-4000-8000-000000000001'
);
insert into public.community_academy_access_invitations(
  id, mapping_id, community_id, user_id, entitlement_key, source_reference,
  academy_role, status, starts_at, ends_at, expires_at, accepted_at
) values (
  'dec00000-0000-4000-8000-000000000001', 'deb00000-0000-4000-8000-000000000001',
  'de110000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000002',
  'paid:manual', 'owner-ux-academy-source', 'learner', 'accepted',
  statement_timestamp() - interval '1 hour', statement_timestamp() + interval '30 days',
  statement_timestamp() + interval '1 day', statement_timestamp()
);
insert into public.community_academy_entitlement_claims(
  id, invitation_id, mapping_id, community_id, user_id, entitlement_key,
  source_reference, academy_role, status, starts_at, ends_at
) values (
  'ded00000-0000-4000-8000-000000000001', 'dec00000-0000-4000-8000-000000000001',
  'deb00000-0000-4000-8000-000000000001', 'de110000-0000-4000-8000-000000000001',
  'de100000-0000-4000-8000-000000000002', 'paid:manual', 'owner-ux-academy-source',
  'learner', 'active', statement_timestamp() - interval '1 hour', statement_timestamp() + interval '30 days'
);

select set_config('request.jwt.claims', '{"sub":"de100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select pg_temp.community_owner_ux_assert(pg_temp.community_owner_ux_denied(
  $q$select public.community_record_manual_payment(
    'de110000-0000-4000-8000-000000000001','de150000-0000-4000-8000-000000000001',
    'de100000-0000-4000-8000-000000000002','bank_transfer','BANK-ACADEMY',null,
    'def00000-0000-4000-8000-000000000001')$q$, 'P0001'), 'active Academy access rejects duplicate manual payment');
reset role;
select pg_temp.community_owner_ux_assert(
  not exists (select 1 from public.community_payment_claims where manual_request_id = 'def00000-0000-4000-8000-000000000001'),
  'Academy duplicate rejection leaves no payment claim'
);

select pg_temp.community_owner_ux_assert(
  exists (
    select 1 from public.community_payment_claims claim
    where claim.community_id = 'de110000-0000-4000-8000-000000000001'
      and claim.user_id = 'de100000-0000-4000-8000-000000000002'
      and claim.payment_method = 'uword_points'
      and claim.external_reference = 'UW-POINT-001'
      and claim.status = 'approved'
      and claim.reviewed_by_user_id = 'de100000-0000-4000-8000-000000000001'
  ), 'manual payment audit row is recorded'
);

select pg_temp.community_owner_ux_assert(
  (select count(*) = 1 from public.community_payment_claims
   where manual_request_id = 'de170000-0000-4000-8000-000000000003'),
  'same request converges to one payment claim'
);

select pg_temp.community_owner_ux_assert(
  exists (
    select 1 from public.community_member_entitlements entitlement
    where entitlement.community_id = 'de110000-0000-4000-8000-000000000001'
      and entitlement.user_id = 'de100000-0000-4000-8000-000000000002'
      and entitlement.entitlement_key = 'paid:manual'
      and entitlement.source = 'external'
      and entitlement.status = 'active'
      and entitlement.source_reference like 'manual-payment-claim:%'
  ), 'manual payment grants only the selected external entitlement'
);

select pg_temp.community_owner_ux_assert(
  not exists (
    select 1 from public.community_member_entitlements entitlement
    where entitlement.community_id = 'de110000-0000-4000-8000-000000000001'
      and entitlement.user_id = 'de100000-0000-4000-8000-000000000002'
      and entitlement.source in ('manual', 'subscription', 'academy_subscription')
  ), 'other entitlement sources remain untouched'
);

select 'community_owner_membership_resources_ux_test_ok' as result;
rollback;
