begin;

create function pg_temp.community_content_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community content assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_content_denied(
  statement text,
  expected_code text,
  expected_message text default null
)
returns void language plpgsql as $$
declare actual_code text; actual_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate, actual_message = message_text;
  end;
  if actual_code is distinct from expected_code
     or (expected_message is not null and actual_message is distinct from expected_message) then
    raise exception 'expected % / %, got % / %',
      expected_code, expected_message, actual_code, actual_message;
  end if;
end;
$$;

insert into auth.users (
  id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
) values
  ('e9050000-0000-4000-8000-000000000001', 'content-owner@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), false),
  ('e9050000-0000-4000-8000-000000000002', 'content-moderator@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), false),
  ('e9050000-0000-4000-8000-000000000003', 'content-member@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), false),
  ('e9050000-0000-4000-8000-000000000004', 'content-limited@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), false),
  ('e9050000-0000-4000-8000-000000000005', 'content-outsider@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), false),
  ('e9050000-0000-4000-8000-000000000006', 'content-anonymous@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), true);

insert into public.community_communities (
  id, slug, name, join_mode, status, owner_user_id
) values (
  'e9050000-0000-4000-8000-000000000010',
  'community-content-trigger-fixture',
  'Community content trigger fixture',
  'invite_only',
  'active',
  'e9050000-0000-4000-8000-000000000001'
);

insert into public.community_memberships (community_id, user_id, role, status, joined_at)
values
  ('e9050000-0000-4000-8000-000000000010', 'e9050000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('e9050000-0000-4000-8000-000000000010', 'e9050000-0000-4000-8000-000000000002', 'moderator', 'active', now()),
  ('e9050000-0000-4000-8000-000000000010', 'e9050000-0000-4000-8000-000000000003', 'member', 'active', now() - interval '2 days'),
  ('e9050000-0000-4000-8000-000000000010', 'e9050000-0000-4000-8000-000000000004', 'member', 'active', now());

insert into public.community_rooms (
  id, community_id, title, kind, conversation_mode, access_type,
  member_can_post, member_can_comment
) values
  ('e9050000-0000-4000-8000-000000000020', 'e9050000-0000-4000-8000-000000000010', 'Thread', 'normal', 'thread', 'free', true, true),
  ('e9050000-0000-4000-8000-000000000021', 'e9050000-0000-4000-8000-000000000010', 'Chat', 'normal', 'chat', 'free', true, true);

insert into public.community_blocked_words (
  community_id, term, action, is_active, created_by_user_id
) values (
  'e9050000-0000-4000-8000-000000000010',
  'blocked-fixture',
  'block',
  true,
  'e9050000-0000-4000-8000-000000000001'
);

update public.community_safety_settings
set new_member_limit_enabled = true,
    new_member_limit_hours = 24,
    new_member_max_actions = 1
where community_id = 'e9050000-0000-4000-8000-000000000010';

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000003', true);
set local role authenticated;

select pg_temp.community_content_denied(
  $$insert into public.community_posts (
      community_id, room_id, author_user_id, title, body, kind
    ) values (
      'e9050000-0000-4000-8000-000000000010',
      'e9050000-0000-4000-8000-000000000020',
      'e9050000-0000-4000-8000-000000000003',
      'blocked-fixture in title', 'safe body', 'normal'
    )$$,
  'P0001',
  'This content contains a prohibited word'
);

insert into public.community_posts (
  id, community_id, room_id, author_user_id, title, body, kind
) values (
  'e9050000-0000-4000-8000-000000000030',
  'e9050000-0000-4000-8000-000000000010',
  'e9050000-0000-4000-8000-000000000020',
  'e9050000-0000-4000-8000-000000000003',
  'Safe title', 'Safe post body', 'normal'
);

select pg_temp.community_content_denied(
  $$insert into public.community_comments (post_id, author_user_id, body)
    values (
      'e9050000-0000-4000-8000-000000000030',
      'e9050000-0000-4000-8000-000000000003',
      'blocked-fixture in comment'
    )$$,
  'P0001',
  'This content contains a prohibited word'
);

select pg_temp.community_content_denied(
  $$insert into public.community_chat_messages (
      community_id, room_id, author_user_id, body
    ) values (
      'e9050000-0000-4000-8000-000000000010',
      'e9050000-0000-4000-8000-000000000021',
      'e9050000-0000-4000-8000-000000000003',
      'blocked-fixture in chat'
    )$$,
  'P0001',
  'This content contains a prohibited word'
);

insert into public.community_comments (post_id, author_user_id, body)
values (
  'e9050000-0000-4000-8000-000000000030',
  'e9050000-0000-4000-8000-000000000003',
  'Safe comment body'
);
insert into public.community_chat_messages (
  community_id, room_id, author_user_id, body
) values (
  'e9050000-0000-4000-8000-000000000010',
  'e9050000-0000-4000-8000-000000000021',
  'e9050000-0000-4000-8000-000000000003',
  'Safe chat body'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000004', true);
set local role authenticated;
insert into public.community_posts (
  id, community_id, room_id, author_user_id, title, body, kind
) values (
  'e9050000-0000-4000-8000-000000000031',
  'e9050000-0000-4000-8000-000000000010',
  'e9050000-0000-4000-8000-000000000020',
  'e9050000-0000-4000-8000-000000000004',
  'Limited first action', 'Allowed once', 'normal'
);
select pg_temp.community_content_denied(
  $$insert into public.community_chat_messages (
      community_id, room_id, author_user_id, body
    ) values (
      'e9050000-0000-4000-8000-000000000010',
      'e9050000-0000-4000-8000-000000000021',
      'e9050000-0000-4000-8000-000000000004',
      'Second limited action'
    )$$,
  'P0001',
  'New member posting limit reached'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.community_posts (
  community_id, room_id, author_user_id, title, body, kind
) values (
  'e9050000-0000-4000-8000-000000000010',
  'e9050000-0000-4000-8000-000000000020',
  'e9050000-0000-4000-8000-000000000001',
  'Owner bypass', 'blocked-fixture owner content', 'normal'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.community_chat_messages (
  community_id, room_id, author_user_id, body
) values (
  'e9050000-0000-4000-8000-000000000010',
  'e9050000-0000-4000-8000-000000000021',
  'e9050000-0000-4000-8000-000000000002',
  'blocked-fixture moderator content'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.community_content_denied(
  $$insert into public.community_posts (
      community_id, room_id, author_user_id, title, body, kind
    ) values (
      'e9050000-0000-4000-8000-000000000010',
      'e9050000-0000-4000-8000-000000000020',
      'e9050000-0000-4000-8000-000000000005',
      'Outsider post', 'No membership', 'normal'
    )$$,
  '42501'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e9050000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":true}',
  true
);
select set_config('request.jwt.claim.sub', 'e9050000-0000-4000-8000-000000000006', true);
set local role authenticated;
select pg_temp.community_content_denied(
  $$insert into public.community_chat_messages (
      community_id, room_id, author_user_id, body
    ) values (
      'e9050000-0000-4000-8000-000000000010',
      'e9050000-0000-4000-8000-000000000021',
      'e9050000-0000-4000-8000-000000000006',
      'Anonymous chat'
    )$$,
  '42501'
);
reset role;

select pg_temp.community_content_assert(
  (select count(*) >= 3 from public.community_posts
   where community_id = 'e9050000-0000-4000-8000-000000000010'),
  'post title and body path succeeds'
);
select pg_temp.community_content_assert(
  (select count(*) = 1 from public.community_comments
   where post_id = 'e9050000-0000-4000-8000-000000000030'),
  'comment body path succeeds'
);
select pg_temp.community_content_assert(
  (select count(*) >= 2 from public.community_chat_messages
   where room_id = 'e9050000-0000-4000-8000-000000000021'),
  'chat body path succeeds'
);

select 'community_content_validation_record_fix_test_ok';
rollback;
