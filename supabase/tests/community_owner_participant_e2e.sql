-- Full Community-owned authenticated flow. Run after the platform creation
-- ledger, guarded Community create, and membership hardening migrations.
-- The verified-paid grant stands in for the common provider/Webhook output;
-- it is issued through the service-role-only authoritative RPC.
begin;

create function pg_temp.community_e2e_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community E2E assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_e2e_denied(statement text, expected_code text)
returns void language plpgsql as $$
declare actual_code text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
  end;
  if actual_code is distinct from expected_code then
    raise exception 'expected SQLSTATE %, got % for %', expected_code, actual_code, statement;
  end if;
end;
$$;

insert into auth.users (
  id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e9040000-0000-4000-8000-000000000001', 'community-e2e-owner@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('e9040000-0000-4000-8000-000000000002', 'community-e2e-member@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('e9040000-0000-4000-8000-000000000003', 'community-e2e-outsider@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (user_id, display_name, handle)
values
  ('e9040000-0000-4000-8000-000000000001', 'E2E owner', 'community_e2e_owner'),
  ('e9040000-0000-4000-8000-000000000002', 'E2E member', 'community_e2e_member'),
  ('e9040000-0000-4000-8000-000000000003', 'E2E outsider', 'community_e2e_outsider');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.platform_billing_creation_entitlement_grant(
  'e9040000-0000-4000-8000-000000000001',
  'community_platform',
  'starter',
  'verified_paid',
  'e9040000-0000-4000-8000-000000000101',
  statement_timestamp() - interval '1 minute',
  null,
  'e9040000-0000-4000-8000-000000000102'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9040000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9040000-0000-4000-8000-000000000001', true);
set local role authenticated;

select public.community_create_with_platform_entitlement(
  'E2E Community',
  'community-e2e-flow',
  'Community owner and participant E2E fixture',
  'E2E owner'
);

insert into public.community_rooms (
  id, community_id, title, description, kind, conversation_mode,
  access_type, sort_order, member_can_post, member_can_comment
) values
  (
    'e9040000-0000-4000-8000-000000000010',
    (select id from public.community_communities where slug = 'community-e2e-flow'),
    'Member threads', 'Participant posting fixture', 'normal', 'thread',
    'free', 40, true, true
  ),
  (
    'e9040000-0000-4000-8000-000000000011',
    (select id from public.community_communities where slug = 'community-e2e-flow'),
    'Member chat', 'Participant chat fixture', 'normal', 'chat',
    'free', 50, true, true
  );

select public.community_invite_by_mikke_id(
  (select id from public.community_communities where slug = 'community-e2e-flow'),
  'community_e2e_member',
  null,
  statement_timestamp() + interval '1 day'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9040000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9040000-0000-4000-8000-000000000002', true);
set local role authenticated;

select public.community_submit_join_application(
  (select id from public.community_communities where slug = 'community-e2e-flow'),
  'E2E member',
  'E2E Member Legal Name',
  '09000000000',
  'Community E2E participation',
  true, true, true
);

insert into public.community_posts (
  id, community_id, room_id, author_user_id, title, body, kind
) values (
  'e9040000-0000-4000-8000-000000000020',
  (select id from public.community_communities where slug = 'community-e2e-flow'),
  'e9040000-0000-4000-8000-000000000010',
  'e9040000-0000-4000-8000-000000000002',
  'Participant question',
  'Can the owner reply to this question?',
  'question'
);

insert into public.community_chat_messages (
  id, community_id, room_id, author_user_id, body
) values (
  'e9040000-0000-4000-8000-000000000030',
  (select id from public.community_communities where slug = 'community-e2e-flow'),
  'e9040000-0000-4000-8000-000000000011',
  'e9040000-0000-4000-8000-000000000002',
  'Participant chat message'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9040000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9040000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into public.community_comments (
  id, post_id, author_user_id, body
) values (
  'e9040000-0000-4000-8000-000000000021',
  'e9040000-0000-4000-8000-000000000020',
  'e9040000-0000-4000-8000-000000000001',
  'Owner reply to participant'
);

insert into public.community_chat_messages (
  id, community_id, room_id, author_user_id, reply_to_message_id, body
) values (
  'e9040000-0000-4000-8000-000000000031',
  (select id from public.community_communities where slug = 'community-e2e-flow'),
  'e9040000-0000-4000-8000-000000000011',
  'e9040000-0000-4000-8000-000000000001',
  'e9040000-0000-4000-8000-000000000030',
  'Owner chat reply'
);
reset role;

select pg_temp.community_e2e_assert(
  (select count(*) = 1 from public.community_communities where slug = 'community-e2e-flow'),
  'one Community created'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 2 from public.community_memberships
   where community_id = (select id from public.community_communities where slug = 'community-e2e-flow')
     and status = 'active'),
  'owner and participant are active'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 1 from public.community_posts where id = 'e9040000-0000-4000-8000-000000000020'),
  'participant post persisted'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 1 from public.community_comments where id = 'e9040000-0000-4000-8000-000000000021'),
  'owner reply persisted'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 2 from public.community_chat_messages
   where room_id = 'e9040000-0000-4000-8000-000000000011'),
  'participant and owner chat persisted'
);
select pg_temp.community_e2e_assert(
  (select status = 'consumed' and resource_id = (
      select id from public.community_communities where slug = 'community-e2e-flow'
    ) from platform_billing_private.creation_entitlements
    where actor_user_id = 'e9040000-0000-4000-8000-000000000001'
      and product_key = 'community_platform'),
  'creation entitlement consumed by created Community'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e9040000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9040000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.community_e2e_assert(
  (select count(*) = 0 from public.community_rooms
   where community_id = (select id from public.community_communities where slug = 'community-e2e-flow')),
  'outsider cannot read rooms'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 0 from public.community_posts where id = 'e9040000-0000-4000-8000-000000000020'),
  'outsider cannot read posts'
);
select pg_temp.community_e2e_assert(
  (select count(*) = 0 from public.community_chat_messages
   where room_id = 'e9040000-0000-4000-8000-000000000011'),
  'outsider cannot read chat'
);
select pg_temp.community_e2e_denied(
  $$insert into public.community_posts (
      community_id, room_id, author_user_id, title, body, kind
    ) values (
      (select id from public.community_communities where slug = 'community-e2e-flow'),
      'e9040000-0000-4000-8000-000000000010',
      'e9040000-0000-4000-8000-000000000003',
      'Outsider post', 'Must be denied', 'normal'
    )$$,
  '42501'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.community_e2e_assert(
  (select count(*) = 0 from public.community_rooms
   where id = 'e9040000-0000-4000-8000-000000000010'),
  'anonymous cannot read rooms'
);
select pg_temp.community_e2e_denied(
  $$insert into public.community_posts (
      community_id, room_id, author_user_id, title, body, kind
    ) values (
      'e9040000-0000-4000-8000-000000000099',
      'e9040000-0000-4000-8000-000000000010',
      'e9040000-0000-4000-8000-000000000003',
      'Anonymous post', 'Must be denied', 'normal'
    )$$,
  '42501'
);
reset role;

select 'community_owner_participant_e2e_test_ok';
rollback;
