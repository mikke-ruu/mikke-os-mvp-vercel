create policy "community users can create their own community"
on public.community_communities for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and status = 'active'
  and join_mode in ('open_free', 'invite_only', 'paid')
);

drop policy if exists "community users can join open free community" on public.community_memberships;
create policy "community users can join or initialize owned community"
on public.community_memberships for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'active'
  and (
    (
      role = 'member'
      and exists (
        select 1
        from public.community_communities c
        where c.id = community_id
          and c.status = 'active'
          and c.join_mode = 'open_free'
      )
    )
    or (
      role = 'owner'
      and exists (
        select 1
        from public.community_communities c
        where c.id = community_id
          and c.owner_user_id = (select auth.uid())
      )
    )
  )
);

create or replace function public.community_create(
  p_name text,
  p_slug text,
  p_description text default null,
  p_display_name text default null
)
returns public.community_communities
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_community public.community_communities;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Community name must be at least 2 characters';
  end if;
  if lower(trim(p_slug)) !~ '^[a-z0-9][a-z0-9-]{2,59}$' then
    raise exception 'Slug must be 3-60 lowercase letters, numbers, or hyphens';
  end if;

  insert into public.community_communities (slug, name, description, join_mode, status, owner_user_id)
  values (lower(trim(p_slug)), trim(p_name), nullif(trim(p_description), ''), 'open_free', 'active', v_user_id)
  returning * into v_community;

  insert into public.community_memberships (community_id, user_id, role, status)
  values (v_community.id, v_user_id, 'owner', 'active');

  insert into public.community_member_profiles (community_id, user_id, display_name)
  values (v_community.id, v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Community owner'));

  insert into public.community_entitlement_definitions (community_id, key, name, description)
  values (v_community.id, 'paid:member', '有料メンバー', '有料・限定Roomを開放するための基本利用権限');

  insert into public.community_rooms (community_id, title, description, kind, access_type, sort_order, member_can_post, member_can_comment)
  values
    (v_community.id, 'お知らせ', '運営からのお知らせを掲載します。', 'announcement', 'free', 10, false, true),
    (v_community.id, 'フリートーク', '参加者同士で自由に交流できます。', 'normal', 'free', 20, true, true),
    (v_community.id, '質問・相談', '質問や相談を投稿できます。', 'question', 'free', 30, true, true);

  return v_community;
end;
$$;

revoke all on function public.community_create(text, text, text, text) from public;
grant execute on function public.community_create(text, text, text, text) to authenticated;
