begin;

create function pg_temp.retention_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'retention assertion failed: %', label; end if;
end;
$$;

create function pg_temp.retention_denied(statement text, expected_state text, expected_message text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected_state and sqlerrm = expected_message;
end;
$$;

create function pg_temp.retention_quote(actor uuid, resource uuid)
returns jsonb language sql as $$
select jsonb_build_object(
  'quoteId', 'community-retention', 'revision', 1, 'purchaseIntent', 'explicit_paid_start',
  'scope', jsonb_build_object('ownerUserId', actor::text, 'productKey', 'community_platform',
    'resourceId', resource::text, 'planKey', 'starter',
    'requestId', 'be070000-0000-4000-8000-000000000001'),
  'currency', 'JPY', 'taxIncluded', true,
  'dueNow', jsonb_build_object('totalYen', 2980, 'dueOn', to_char(clock_timestamp() at time zone 'Asia/Tokyo', 'YYYY-MM-DD')),
  'nextPayment', jsonb_build_object('totalYen', 2980, 'dueOn', to_char((clock_timestamp() at time zone 'Asia/Tokyo') + interval '1 month', 'YYYY-MM-DD')),
  'merchant', jsonb_build_object('merchantId', 'fixture', 'legalName', 'Fixture', 'address', 'Fixture', 'contactUrl', 'https://example.invalid/contact'),
  'policies', jsonb_build_object('approved', true, 'approvalId', 'fixture-approval', 'revision', 1)
    || (select jsonb_object_agg(key, jsonb_build_object('version', 'fixture-v1', 'url', 'https://example.invalid/policy'))
        from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure']) key),
  'issuedAt', to_char((clock_timestamp() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expiresAt', to_char((clock_timestamp() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
$$;

select pg_temp.retention_assert(
  not has_function_privilege('anon', 'platform_billing_private.resource_access_window(text,uuid,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'platform_billing_private.resource_access_window(text,uuid,timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'platform_billing_private.resource_access_window(text,uuid,timestamptz)', 'execute'),
  'common access helper is internal only'
);
select pg_temp.retention_assert(
  has_function_privilege('authenticated', 'public.community_export_owner_archive(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.community_export_owner_archive(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.community_apply_platform_retention_anonymization(uuid,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.community_apply_platform_retention_anonymization(uuid,timestamptz)', 'execute'),
  'owner export and worker ACL are narrow'
);

insert into auth.users(id, email, is_anonymous) values
  ('ae070000-0000-4000-8000-000000000001', 'retention-owner@example.invalid', false),
  ('ae070000-0000-4000-8000-000000000002', 'retention-member@example.invalid', false),
  ('ae070000-0000-4000-8000-000000000003', 'retention-academy@example.invalid', false),
  ('ae070000-0000-4000-8000-000000000004', 'retention-anon@example.invalid', true),
  ('ae070000-0000-4000-8000-000000000005', 'retention-trial-active@example.invalid', false),
  ('ae070000-0000-4000-8000-000000000006', 'retention-trial-ended@example.invalid', false),
  ('ae070000-0000-4000-8000-000000000007', 'retention-trial-retained@example.invalid', false);
insert into public.profiles(user_id, handle, display_name) values
  ('ae070000-0000-4000-8000-000000000001', 'retention-owner', 'Retention owner'),
  ('ae070000-0000-4000-8000-000000000002', 'retention-member', 'Retention member'),
  ('ae070000-0000-4000-8000-000000000003', 'retention-academy', 'Retention Academy'),
  ('ae070000-0000-4000-8000-000000000005', 'retention-trial-active', 'Trial active owner'),
  ('ae070000-0000-4000-8000-000000000006', 'retention-trial-ended', 'Trial ended owner'),
  ('ae070000-0000-4000-8000-000000000007', 'retention-trial-retained', 'Trial retained owner');

select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select public.platform_billing_quote_save(
  'ae070000-0000-4000-8000-000000000001',
  pg_temp.retention_quote('ae070000-0000-4000-8000-000000000001', 'ce070000-0000-4000-8000-000000000001')
);
select set_config('test.retention_attempt', public.platform_billing_attempt_reserve(
  'ae070000-0000-4000-8000-000000000001', 'community-retention',
  '{"quoteId":"community-retention","revision":1,"termsVersion":"fixture-v1","accepted":true}'
)::text, true);
select public.platform_billing_attempt_mark_ready(
  'ae070000-0000-4000-8000-000000000001',
  (current_setting('test.retention_attempt')::jsonb->>'attempt_id')::uuid,
  'cs_test_CommunityRetention', repeat('7', 64)
);
select public.platform_billing_verified_subscription_activate(
  (current_setting('test.retention_attempt')::jsonb->>'attempt_id')::uuid,
  'evt_CommunityRetention', repeat('8', 64), 'cs_test_CommunityRetention',
  'cus_CommunityRetention', 'sub_CommunityRetention', 2980, 'jpy', statement_timestamp()
);
reset role;

insert into public.community_communities(
  id, slug, name, description, join_mode, status, owner_user_id, logo_url, banner_url
) values
  (
    'ce070000-0000-4000-8000-000000000001', 'retention-community', 'Retention Community',
    'operator metadata', 'invite_only', 'active', 'ae070000-0000-4000-8000-000000000001',
    'https://example.invalid/logo.png', 'https://example.invalid/banner.png'
  ),
  (
    'ce070000-0000-4000-8000-000000000101', 'retention-trial-active', 'Active trial Community',
    null, 'invite_only', 'active', 'ae070000-0000-4000-8000-000000000005', null, null
  ),
  (
    'ce070000-0000-4000-8000-000000000201', 'retention-trial-ended', 'Ended trial Community',
    null, 'invite_only', 'active', 'ae070000-0000-4000-8000-000000000006', null, null
  ),
  (
    'ce070000-0000-4000-8000-000000000301', 'retention-trial-retained', 'Retained trial Community',
    null, 'invite_only', 'active', 'ae070000-0000-4000-8000-000000000007', null, null
  );
insert into public.community_memberships(id, community_id, user_id, role, status, access_scope) values
  ('ce070000-0000-4000-8000-000000000011', 'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000001', 'owner', 'active', 'community'),
  ('ce070000-0000-4000-8000-000000000012', 'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000002', 'member', 'active', 'community'),
  ('ce070000-0000-4000-8000-000000000013', 'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000003', 'member', 'active', 'linked_rooms'),
  ('ce070000-0000-4000-8000-000000000111', 'ce070000-0000-4000-8000-000000000101', 'ae070000-0000-4000-8000-000000000005', 'owner', 'active', 'community'),
  ('ce070000-0000-4000-8000-000000000211', 'ce070000-0000-4000-8000-000000000201', 'ae070000-0000-4000-8000-000000000006', 'owner', 'active', 'community'),
  ('ce070000-0000-4000-8000-000000000311', 'ce070000-0000-4000-8000-000000000301', 'ae070000-0000-4000-8000-000000000007', 'owner', 'active', 'community');
insert into public.community_member_profiles(community_id, user_id, display_name) values
  ('ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000001', 'Owner'),
  ('ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000002', 'Member'),
  ('ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000003', 'Academy member');
insert into public.community_operator_profiles(
  community_id, business_name, representative_name, postal_address, contact_email,
  contact_phone, website_url, commercial_disclosure_url, privacy_policy_url, terms_url, status
) values (
  'ce070000-0000-4000-8000-000000000001', 'Fixture Business', 'Fixture Owner',
  'Fixture address', 'owner@example.invalid', '000-0000-0000', 'https://example.invalid',
  'https://example.invalid/commercial', 'https://example.invalid/privacy',
  'https://example.invalid/terms', 'verified'
);

insert into public.community_entitlement_definitions(community_id, key, name, status) values
  ('ce070000-0000-4000-8000-000000000001', 'manual-access', 'Manual access', 'active'),
  ('ce070000-0000-4000-8000-000000000001', 'academy-access', 'Academy access', 'active');
insert into public.community_member_entitlements(
  community_id, user_id, entitlement_key, source, source_reference, status, starts_at
) values (
  'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000002',
  'manual-access', 'manual', 'fixture-manual', 'active', statement_timestamp()
);

insert into public.academy_headquarters(id, owner_user_id, name, handle, plan, is_active) values (
  'de070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000001',
  'Retention Academy HQ', 'retention-academy-hq', 'small', true
);
insert into public.academy_headquarters_access_states(
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'de070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000001',
  'paid', 'active', statement_timestamp(), statement_timestamp()
);
insert into public.community_access_source_mappings(
  id, community_id, provider_type, provider_owner_key, source_product_key,
  entitlement_key, status, created_by_user_id
) values (
  'ce070000-0000-4000-8000-000000000021', 'ce070000-0000-4000-8000-000000000001',
  'academy_subscription', 'de070000-0000-4000-8000-000000000001', 'course:retention',
  'academy-access', 'active', 'ae070000-0000-4000-8000-000000000001'
);
insert into public.community_academy_access_invitations(
  id, mapping_id, community_id, user_id, entitlement_key, source_reference,
  academy_role, status, starts_at, accepted_at
) values (
  'ce070000-0000-4000-8000-000000000022', 'ce070000-0000-4000-8000-000000000021',
  'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000003',
  'academy-access', 'fixture-academy', 'learner', 'accepted', statement_timestamp(), statement_timestamp()
);
insert into public.community_academy_entitlement_claims(
  id, invitation_id, mapping_id, community_id, user_id, entitlement_key,
  source_reference, academy_role, status, starts_at
) values (
  'ce070000-0000-4000-8000-000000000023', 'ce070000-0000-4000-8000-000000000022',
  'ce070000-0000-4000-8000-000000000021', 'ce070000-0000-4000-8000-000000000001',
  'ae070000-0000-4000-8000-000000000003', 'academy-access', 'fixture-academy',
  'learner', 'active', statement_timestamp()
);

insert into platform_billing_private.creation_entitlements(
  id, actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values
  (
    'be070000-0000-4000-8000-000000000101', 'ae070000-0000-4000-8000-000000000005',
    'community_platform', 'trial', 'verified_trial', 'be070000-0000-4000-8000-000000000111',
    'be070000-0000-4000-8000-000000000121', 'consumed',
    statement_timestamp() - interval '1 second', statement_timestamp() + interval '29 days 23 hours 59 minutes 59 seconds',
    'ce070000-0000-4000-8000-000000000101', statement_timestamp() - interval '1 second'
  ),
  (
    'be070000-0000-4000-8000-000000000201', 'ae070000-0000-4000-8000-000000000006',
    'community_platform', 'trial', 'verified_trial', 'be070000-0000-4000-8000-000000000211',
    'be070000-0000-4000-8000-000000000221', 'consumed',
    statement_timestamp() - interval '30 days 1 second', statement_timestamp() - interval '1 second',
    'ce070000-0000-4000-8000-000000000201', statement_timestamp() - interval '30 days 1 second'
  ),
  (
    'be070000-0000-4000-8000-000000000301', 'ae070000-0000-4000-8000-000000000007',
    'community_platform', 'trial', 'verified_trial', 'be070000-0000-4000-8000-000000000311',
    'be070000-0000-4000-8000-000000000321', 'consumed',
    statement_timestamp() - interval '120 days 1 second', statement_timestamp() - interval '90 days 1 second',
    'ce070000-0000-4000-8000-000000000301', statement_timestamp() - interval '120 days 1 second'
  );

select pg_temp.retention_assert(
  (select status='trialing' and write_allowed and owner_read_until is null and anonymize_after is null
   from community_private.community_platform_access_window(
     'ce070000-0000-4000-8000-000000000101', statement_timestamp()
   )),
  'active verified trial projects trialing write access'
);

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000005',true);
set local role authenticated;
insert into public.community_rooms(id, community_id, title, kind, access_type)
values (
  'ce070000-0000-4000-8000-000000000131', 'ce070000-0000-4000-8000-000000000101',
  'Trial owner active room', 'normal', 'free'
);
select pg_temp.retention_assert(
  exists(select 1 from public.community_rooms where id='ce070000-0000-4000-8000-000000000131'),
  'active trial owner can write'
);
reset role;

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000006',true);
set local role authenticated;
select pg_temp.retention_assert(
  community_private.community_current_actor_owner_read_allowed('ce070000-0000-4000-8000-000000000201')
  and public.community_export_owner_archive('ce070000-0000-4000-8000-000000000201')#>>'{community,slug}'='retention-trial-ended',
  'expired trial owner can read and export during 90 days'
);
select pg_temp.retention_assert(pg_temp.retention_denied(
  $q$insert into public.community_rooms(community_id,title,kind,access_type) values ('ce070000-0000-4000-8000-000000000201','Blocked ended trial room','normal','free')$q$,
  '42501', 'new row violates row-level security policy for table "community_rooms"'
) or pg_temp.retention_denied(
  $q$insert into public.community_rooms(community_id,title,kind,access_type) values ('ce070000-0000-4000-8000-000000000201','Blocked ended trial room','normal','free')$q$,
  '55000', 'COMMUNITY_PLATFORM_OWNER_READ_ONLY'
), 'expired trial owner cannot write');
reset role;

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000007","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000007',true);
set local role authenticated;
select pg_temp.retention_assert(
  not community_private.community_current_actor_owner_read_allowed('ce070000-0000-4000-8000-000000000301')
  and pg_temp.retention_denied(
    $q$select public.community_export_owner_archive('ce070000-0000-4000-8000-000000000301')$q$,
    '42501', 'COMMUNITY_OWNER_EXPORT_NOT_AVAILABLE'
  ),
  'trial owner cannot read or export after 90 days'
);
reset role;

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.community_rooms(id, community_id, title, kind, access_type, conversation_mode) values
  ('ce070000-0000-4000-8000-000000000031', 'ce070000-0000-4000-8000-000000000001', 'Active thread room', 'normal', 'free', 'thread'),
  ('ce070000-0000-4000-8000-000000000032', 'ce070000-0000-4000-8000-000000000001', 'Active chat room', 'normal', 'free', 'chat');
insert into public.community_events(id, community_id, title, starts_at)
values (
  'ce070000-0000-4000-8000-000000000033', 'ce070000-0000-4000-8000-000000000001',
  'Participant attendance fixture', statement_timestamp() + interval '1 day'
);
reset role;
select pg_temp.retention_assert(
  (select count(*)=2 from public.community_rooms where id in (
    'ce070000-0000-4000-8000-000000000031',
    'ce070000-0000-4000-8000-000000000032'
  ))
  and exists(select 1 from public.community_events where id='ce070000-0000-4000-8000-000000000033'),
  'active owner can write'
);

select set_config('test.retention_period_start', (select current_period_start::text from platform_billing_private.subscriptions where provider_subscription_id='sub_CommunityRetention'), true);
select set_config('test.retention_period_end', (select current_period_end::text from platform_billing_private.subscriptions where provider_subscription_id='sub_CommunityRetention'), true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select public.platform_billing_subscription_event_apply(
  'sub_CommunityRetention', 'evt_CommunityRetentionFailed', repeat('9', 64),
  'invoice_failed', 'past_due', current_setting('test.retention_period_start')::timestamptz,
  current_setting('test.retention_period_end')::timestamptz, null, statement_timestamp() + interval '1 second'
);
reset role;

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.retention_assert(
  community_private.community_current_actor_owner_read_allowed('ce070000-0000-4000-8000-000000000001'),
  'past due owner is read only'
);
select pg_temp.retention_assert(pg_temp.retention_denied(
  $q$insert into public.community_rooms(community_id,title,kind,access_type) values ('ce070000-0000-4000-8000-000000000001','Blocked owner room','normal','free')$q$,
  '42501', 'new row violates row-level security policy for table "community_rooms"'
) or pg_temp.retention_denied(
  $q$insert into public.community_rooms(community_id,title,kind,access_type) values ('ce070000-0000-4000-8000-000000000001','Blocked owner room','normal','free')$q$,
  '55000', 'COMMUNITY_PLATFORM_OWNER_READ_ONLY'
), 'past due owner is read only');
reset role;

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into public.community_posts(id, community_id, room_id, author_user_id, title, body)
values (
  'ce070000-0000-4000-8000-000000000041', 'ce070000-0000-4000-8000-000000000001',
  'ce070000-0000-4000-8000-000000000031', 'ae070000-0000-4000-8000-000000000002',
  'Participant post', 'Participant record remains writable'
);
insert into public.community_comments(id, post_id, author_user_id, body)
values (
  'ce070000-0000-4000-8000-000000000042', 'ce070000-0000-4000-8000-000000000041',
  'ae070000-0000-4000-8000-000000000002', 'Participant comment remains writable'
);
insert into public.community_chat_messages(id, community_id, room_id, author_user_id, body)
values (
  'ce070000-0000-4000-8000-000000000043', 'ce070000-0000-4000-8000-000000000001',
  'ce070000-0000-4000-8000-000000000032', 'ae070000-0000-4000-8000-000000000002',
  'Participant chat remains writable'
);
insert into public.community_post_reactions(id, community_id, room_id, post_id, user_id, emoji)
values (
  'ce070000-0000-4000-8000-000000000044', 'ce070000-0000-4000-8000-000000000001',
  'ce070000-0000-4000-8000-000000000031', 'ce070000-0000-4000-8000-000000000041',
  'ae070000-0000-4000-8000-000000000002', '👍'
);
insert into public.community_event_attendees(id, event_id, user_id, status)
values (
  'ce070000-0000-4000-8000-000000000045', 'ce070000-0000-4000-8000-000000000033',
  'ae070000-0000-4000-8000-000000000002', 'going'
);
select pg_temp.retention_assert(community_private.is_active_member('ce070000-0000-4000-8000-000000000001'), 'ordinary participant remains active');
select pg_temp.retention_assert(
  exists(select 1 from public.community_comments where id='ce070000-0000-4000-8000-000000000042')
  and exists(select 1 from public.community_chat_messages where id='ce070000-0000-4000-8000-000000000043')
  and exists(select 1 from public.community_post_reactions where id='ce070000-0000-4000-8000-000000000044')
  and exists(select 1 from public.community_event_attendees where id='ce070000-0000-4000-8000-000000000045'),
  'participant comment chat reaction and attendance remain writable'
);
reset role;

select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select public.platform_billing_subscription_event_apply(
  'sub_CommunityRetention', 'evt_CommunityRetentionEnded', repeat('a', 64),
  'subscription_state', 'ended', current_setting('test.retention_period_start')::timestamptz,
  current_setting('test.retention_period_end')::timestamptz, false, statement_timestamp() + interval '2 seconds'
);
reset role;

select set_config(
  'test.retention_owner_read_until',
  (select owner_read_until::text
   from community_private.community_platform_access_window(
     'ce070000-0000-4000-8000-000000000001', statement_timestamp()
   )),
  true
);
select set_config(
  'test.retention_anonymize_after',
  (select anonymize_after::text
   from community_private.community_platform_access_window(
     'ce070000-0000-4000-8000-000000000001', statement_timestamp()
   )),
  true
);

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.retention_assert(
  community_private.community_current_actor_owner_read_allowed('ce070000-0000-4000-8000-000000000001')
  and public.community_export_owner_archive('ce070000-0000-4000-8000-000000000001')#>>'{community,slug}'='retention-community',
  'ended owner can read and export during 90 days'
);
reset role;

select pg_temp.retention_assert(
  not community_private.community_owner_read_allowed(
    'ce070000-0000-4000-8000-000000000001', 'ae070000-0000-4000-8000-000000000001',
    current_setting('test.retention_owner_read_until')::timestamptz + interval '1 second'
  ),
  'ended owner cannot read or export after 90 days'
);

select set_config('request.jwt.claims','{"sub":"ae070000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}',true);
select set_config('request.jwt.claim.sub','ae070000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.retention_assert(pg_temp.retention_denied(
  $q$select public.community_export_owner_archive('ce070000-0000-4000-8000-000000000001')$q$,
  '42501', 'Authenticated non-anonymous user required'
), 'anonymous export is rejected');
reset role;

select pg_temp.retention_assert(
  (select count(*)=1 from public.community_member_entitlements where source='manual' and status='active'),
  'manual entitlement remains unchanged'
);
select pg_temp.retention_assert(
  (select count(*)=1 from public.community_academy_entitlement_claims where source_reference='fixture-academy' and status='active'),
  'Academy claim remains unchanged'
);

select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select pg_temp.retention_assert(pg_temp.retention_denied(
  format(
    $q$select public.community_apply_platform_retention_anonymization('ce070000-0000-4000-8000-000000000001',%L::timestamptz)$q$,
    current_setting('test.retention_anonymize_after')::timestamptz - interval '1 second'
  ), '55000', 'COMMUNITY_RETENTION_NOT_DUE'
), 'anonymization before deadline is rejected');

select pg_temp.retention_assert(
  public.community_apply_platform_retention_anonymization(
    'ce070000-0000-4000-8000-000000000001',
    current_setting('test.retention_anonymize_after')::timestamptz + interval '1 second'
  ),
  'worker changes allowlisted operator fields only'
);
select pg_temp.retention_assert(
  (select name='終了したCommunity' and description is null and logo_url is null and banner_url is null
   from public.community_communities where id='ce070000-0000-4000-8000-000000000001')
  and (select business_name='' and representative_name='' and contact_email='' and contact_phone is null
       from public.community_operator_profiles where community_id='ce070000-0000-4000-8000-000000000001')
  and (select count(*)=1 from public.community_posts where id='ce070000-0000-4000-8000-000000000041')
  and (select count(*)=3 from public.community_member_profiles where community_id='ce070000-0000-4000-8000-000000000001'),
  'worker changes allowlisted operator fields only'
);
select pg_temp.retention_assert(
  not public.community_apply_platform_retention_anonymization(
    'ce070000-0000-4000-8000-000000000001',
    current_setting('test.retention_anonymize_after')::timestamptz + interval '2 seconds'
  ),
  'worker is idempotent'
);
reset role;

select pg_temp.retention_assert(
  (select count(*)=15 from community_private.platform_retention_anonymization_allowlist)
  and not exists (
    select 1 from community_private.platform_retention_anonymization_allowlist
    where target_table in ('community_member_profiles','community_posts','community_comments','community_chat_messages','community_consent_records','community_member_entitlements','community_academy_entitlement_claims')
  ),
  'worker changes allowlisted operator fields only'
);

select 'community_platform_retention_controls_test_ok' as result;
rollback;
