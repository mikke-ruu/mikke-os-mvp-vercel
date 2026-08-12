-- Community safety foundation: applications, versioned consent, rules,
-- blocked words, reports, inquiries, and optional new-member rate limits.

create table public.community_safety_settings (
  community_id uuid primary key references public.community_communities(id) on delete cascade,
  approval_mode text not null default 'manual' check (approval_mode in ('auto', 'manual')),
  require_legal_name boolean not null default true,
  require_phone boolean not null default true,
  require_join_reason boolean not null default false,
  terms_version integer not null default 1 check (terms_version > 0),
  terms_text text not null default '参加者同士を尊重し、誹謗中傷、迷惑行為、無断転載、個人情報の公開を行わないでください。運営者はルール違反に対して投稿の非表示、利用停止、退会等の対応を行うことがあります。',
  rules_version integer not null default 1 check (rules_version > 0),
  rules_text text not null default '相手を尊重して交流してください。個人情報、差別的表現、嫌がらせ、宣伝やスパム、権利を侵害する内容は禁止します。',
  privacy_version integer not null default 1 check (privacy_version > 0),
  privacy_text text not null default '入力された氏名、メールアドレス、電話番号は、参加確認、本人確認、重要な連絡、トラブル対応のために利用し、Communityの一般参加者には公開しません。',
  new_member_limit_enabled boolean not null default false,
  new_member_limit_hours integer not null default 24 check (new_member_limit_hours between 1 and 168),
  new_member_max_actions integer not null default 5 check (new_member_max_actions between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_join_applications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  legal_name text,
  email text not null,
  phone text,
  join_reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table public.community_consent_records (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  application_id uuid not null references public.community_join_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'rules', 'privacy')),
  document_version integer not null check (document_version > 0),
  accepted_at timestamptz not null default now(),
  unique (application_id, document_type, document_version)
);

create table public.community_blocked_words (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  term text not null check (char_length(trim(term)) between 1 and 100),
  action text not null default 'block' check (action in ('warn', 'block')),
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (community_id, term)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'chat', 'profile', 'member', 'other')),
  target_id uuid,
  reason text not null check (reason in ('harassment', 'personal_information', 'spam', 'impersonation', 'inappropriate', 'rights', 'danger', 'rule_violation', 'other')),
  details text,
  content_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  handled_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.community_inquiries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('usage', 'account', 'event', 'privacy', 'billing', 'other')),
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'answered', 'closed')),
  handled_by_user_id uuid references auth.users(id) on delete set null,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index community_join_applications_community_status_idx on public.community_join_applications (community_id, status, submitted_at);
create index community_join_applications_user_idx on public.community_join_applications (user_id, submitted_at desc);
create index community_consent_records_user_community_idx on public.community_consent_records (user_id, community_id, accepted_at desc);
create index community_blocked_words_community_active_idx on public.community_blocked_words (community_id, is_active);
create index community_reports_community_status_idx on public.community_reports (community_id, status, created_at desc);
create index community_reports_reporter_idx on public.community_reports (reporter_user_id, created_at desc);
create index community_inquiries_community_status_idx on public.community_inquiries (community_id, status, created_at desc);
create index community_inquiries_user_idx on public.community_inquiries (user_id, created_at desc);
create index community_moderation_actions_community_created_idx on public.community_moderation_actions (community_id, created_at desc);

create trigger community_safety_settings_touch_updated_at before update on public.community_safety_settings for each row execute function public.community_touch_updated_at();
create trigger community_join_applications_touch_updated_at before update on public.community_join_applications for each row execute function public.community_touch_updated_at();
create trigger community_reports_touch_updated_at before update on public.community_reports for each row execute function public.community_touch_updated_at();
create trigger community_inquiries_touch_updated_at before update on public.community_inquiries for each row execute function public.community_touch_updated_at();

alter table public.community_safety_settings enable row level security;
alter table public.community_join_applications enable row level security;
alter table public.community_consent_records enable row level security;
alter table public.community_blocked_words enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_inquiries enable row level security;
alter table public.community_moderation_actions enable row level security;

revoke all on public.community_safety_settings, public.community_join_applications, public.community_consent_records, public.community_blocked_words, public.community_reports, public.community_inquiries, public.community_moderation_actions from anon, authenticated;
grant select, insert, update on public.community_safety_settings to authenticated;
grant select on public.community_join_applications, public.community_consent_records to authenticated;
grant select, insert, update, delete on public.community_blocked_words to authenticated;
grant select, insert, update on public.community_reports, public.community_inquiries to authenticated;
grant select, insert on public.community_moderation_actions to authenticated;

create policy "community members can read safety settings"
on public.community_safety_settings for select to authenticated
using (
  community_private.is_staff(community_id)
  or exists (
    select 1 from public.community_communities c
    where c.id = community_safety_settings.community_id and c.status = 'active'
  )
);
create policy "community staff can insert safety settings"
on public.community_safety_settings for insert to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update safety settings"
on public.community_safety_settings for update to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community applicants and staff can read applications"
on public.community_join_applications for select to authenticated
using (user_id = (select auth.uid()) or community_private.is_staff(community_id));

create policy "community applicants and staff can read consent records"
on public.community_consent_records for select to authenticated
using (user_id = (select auth.uid()) or community_private.is_staff(community_id));

create policy "community active members can read blocked word rules"
on public.community_blocked_words for select to authenticated
using (
  community_private.is_staff(community_id)
  or exists (
    select 1 from public.community_memberships m
    where m.community_id = community_blocked_words.community_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  )
);
create policy "community staff can insert blocked words"
on public.community_blocked_words for insert to authenticated
with check (community_private.is_staff(community_id) and created_by_user_id = (select auth.uid()));
create policy "community staff can update blocked words"
on public.community_blocked_words for update to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete blocked words"
on public.community_blocked_words for delete to authenticated
using (community_private.is_staff(community_id));

create policy "community reporters and staff can read reports"
on public.community_reports for select to authenticated
using (reporter_user_id = (select auth.uid()) or community_private.is_staff(community_id));
create policy "community active members can create reports"
on public.community_reports for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_memberships m
    where m.community_id = community_reports.community_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  )
);
create policy "community staff can update reports"
on public.community_reports for update to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community authors and staff can read inquiries"
on public.community_inquiries for select to authenticated
using (user_id = (select auth.uid()) or community_private.is_staff(community_id));
create policy "community active members can create inquiries"
on public.community_inquiries for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_memberships m
    where m.community_id = community_inquiries.community_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  )
);
create policy "community staff can update inquiries"
on public.community_inquiries for update to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community staff can read moderation actions"
on public.community_moderation_actions for select to authenticated
using (community_private.is_staff(community_id));
create policy "community staff can create moderation actions"
on public.community_moderation_actions for insert to authenticated
with check (community_private.is_staff(community_id) and actor_user_id = (select auth.uid()));

-- Existing communities become application-based. Owners can switch to auto approval.
insert into public.community_safety_settings (community_id)
select id from public.community_communities
on conflict (community_id) do nothing;

create or replace function community_private.initialize_community_safety()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.community_safety_settings (community_id) values (new.id)
  on conflict (community_id) do nothing;
  return new;
end;
$$;
drop trigger if exists community_initialize_safety on public.community_communities;
create trigger community_initialize_safety after insert on public.community_communities
for each row execute function community_private.initialize_community_safety();
revoke all on function community_private.initialize_community_safety() from public, anon, authenticated;

create or replace function public.community_submit_join_application(
  p_community_id uuid,
  p_display_name text,
  p_legal_name text,
  p_phone text,
  p_join_reason text,
  p_accept_terms boolean,
  p_accept_rules boolean,
  p_accept_privacy boolean
)
returns public.community_join_applications
language plpgsql
security definer
set search_path = pg_catalog, public, community_private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_settings public.community_safety_settings;
  v_application public.community_join_applications;
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  select email into v_email from auth.users where id = v_user_id;
  select s.* into v_settings
  from public.community_safety_settings s
  join public.community_communities c on c.id = s.community_id
  where s.community_id = p_community_id and c.status = 'active' and c.join_mode = 'open_free';
  if v_settings.community_id is null then raise exception 'This Community is not accepting applications'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) < 1 then raise exception 'Display name is required'; end if;
  if v_settings.require_legal_name and char_length(trim(coalesce(p_legal_name, ''))) < 1 then raise exception 'Legal name is required'; end if;
  if v_settings.require_phone and char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 then raise exception 'A valid phone number is required'; end if;
  if v_settings.require_join_reason and char_length(trim(coalesce(p_join_reason, ''))) < 1 then raise exception 'Join reason is required'; end if;
  if not (p_accept_terms and p_accept_rules and p_accept_privacy) then raise exception 'All required documents must be accepted'; end if;
  v_status := case when v_settings.approval_mode = 'auto' then 'approved' else 'pending' end;

  insert into public.community_join_applications (
    community_id, user_id, display_name, legal_name, email, phone, join_reason,
    status, reviewed_by_user_id, review_note, submitted_at, reviewed_at
  ) values (
    p_community_id, v_user_id, trim(p_display_name), nullif(trim(p_legal_name), ''), v_email,
    nullif(trim(p_phone), ''), nullif(trim(p_join_reason), ''), v_status,
    case when v_status = 'approved' then v_user_id else null end,
    case when v_status = 'approved' then 'Auto approved' else null end,
    now(), case when v_status = 'approved' then now() else null end
  )
  on conflict (community_id, user_id) do update set
    display_name = excluded.display_name, legal_name = excluded.legal_name,
    email = excluded.email, phone = excluded.phone, join_reason = excluded.join_reason,
    status = excluded.status, reviewed_by_user_id = excluded.reviewed_by_user_id,
    review_note = excluded.review_note, submitted_at = now(), reviewed_at = excluded.reviewed_at
  returning * into v_application;

  insert into public.community_consent_records (community_id, application_id, user_id, document_type, document_version)
  values
    (p_community_id, v_application.id, v_user_id, 'terms', v_settings.terms_version),
    (p_community_id, v_application.id, v_user_id, 'rules', v_settings.rules_version),
    (p_community_id, v_application.id, v_user_id, 'privacy', v_settings.privacy_version)
  on conflict do nothing;

  if v_status = 'approved' then
    insert into public.community_memberships (community_id, user_id, role, status)
    values (p_community_id, v_user_id, 'member', 'active')
    on conflict (community_id, user_id) do update set status = 'active';
    insert into public.community_member_profiles (community_id, user_id, display_name)
    values (p_community_id, v_user_id, trim(p_display_name))
    on conflict (community_id, user_id) do update set display_name = excluded.display_name;
  end if;
  return v_application;
end;
$$;

create or replace function public.community_review_join_application(
  p_application_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.community_join_applications
language plpgsql
security definer
set search_path = pg_catalog, public, community_private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.community_join_applications;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  select * into v_application from public.community_join_applications where id = p_application_id for update;
  if v_application.id is null or not community_private.is_staff(v_application.community_id) then raise exception 'Staff permission is required'; end if;
  update public.community_join_applications set
    status = p_decision, reviewed_by_user_id = v_user_id,
    review_note = nullif(trim(p_review_note), ''), reviewed_at = now()
  where id = p_application_id returning * into v_application;
  if p_decision = 'approved' then
    insert into public.community_memberships (community_id, user_id, role, status)
    values (v_application.community_id, v_application.user_id, 'member', 'active')
    on conflict (community_id, user_id) do update set status = 'active';
    insert into public.community_member_profiles (community_id, user_id, display_name)
    values (v_application.community_id, v_application.user_id, v_application.display_name)
    on conflict (community_id, user_id) do update set display_name = excluded.display_name;
  end if;
  insert into public.community_moderation_actions (community_id, actor_user_id, action_type, target_type, target_id, reason)
  values (v_application.community_id, v_user_id, 'join_application_' || p_decision, 'join_application', v_application.id, p_review_note);
  return v_application;
end;
$$;

revoke all on function public.community_submit_join_application(uuid, text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.community_submit_join_application(uuid, text, text, text, text, boolean, boolean, boolean) to authenticated;
revoke all on function public.community_review_join_application(uuid, text, text) from public, anon;
grant execute on function public.community_review_join_application(uuid, text, text) to authenticated;

create or replace function community_private.validate_community_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, community_private
as $$
declare
  v_community_id uuid;
  v_author_id uuid;
  v_content text;
  v_membership public.community_memberships;
  v_settings public.community_safety_settings;
  v_action_count integer;
begin
  if tg_table_name = 'community_comments' then
    select p.community_id into v_community_id from public.community_posts p where p.id = new.post_id;
    v_author_id := new.author_user_id; v_content := new.body;
  else
    v_community_id := new.community_id; v_author_id := new.author_user_id;
    v_content := concat_ws(' ', case when tg_table_name = 'community_posts' then new.title else null end, new.body);
  end if;
  if v_author_id is null or v_author_id <> (select auth.uid()) then return new; end if;
  select * into v_membership from public.community_memberships m
  where m.community_id = v_community_id and m.user_id = v_author_id and m.status = 'active';
  if v_membership.role in ('owner', 'moderator') then return new; end if;
  if exists (
    select 1 from public.community_blocked_words w
    where w.community_id = v_community_id and w.is_active and w.action = 'block'
      and position(lower(w.term) in lower(v_content)) > 0
  ) then raise exception 'This content contains a prohibited word'; end if;
  select * into v_settings from public.community_safety_settings where community_id = v_community_id;
  if tg_op = 'INSERT' and v_settings.new_member_limit_enabled
     and v_membership.joined_at >= now() - make_interval(hours => v_settings.new_member_limit_hours) then
    select
      (select count(*) from public.community_posts p where p.community_id = v_community_id and p.author_user_id = v_author_id and p.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours))
      + (select count(*) from public.community_comments c join public.community_posts p on p.id = c.post_id where p.community_id = v_community_id and c.author_user_id = v_author_id and c.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours))
      + (select count(*) from public.community_chat_messages m where m.community_id = v_community_id and m.author_user_id = v_author_id and m.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours))
    into v_action_count;
    if v_action_count >= v_settings.new_member_max_actions then raise exception 'New member posting limit reached'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_validate_safety on public.community_posts;
create trigger community_posts_validate_safety before insert or update of title, body on public.community_posts for each row execute function community_private.validate_community_content();
drop trigger if exists community_comments_validate_safety on public.community_comments;
create trigger community_comments_validate_safety before insert or update of body on public.community_comments for each row execute function community_private.validate_community_content();
drop trigger if exists community_chat_messages_validate_safety on public.community_chat_messages;
create trigger community_chat_messages_validate_safety before insert or update of body on public.community_chat_messages for each row execute function community_private.validate_community_content();

revoke all on function community_private.validate_community_content() from public, anon, authenticated;
