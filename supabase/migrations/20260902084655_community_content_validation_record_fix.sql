-- Preserve the existing Community safety trigger contract while avoiding
-- record-field resolution for tables that do not have a title column.
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
    select post.community_id
      into v_community_id
    from public.community_posts post
    where post.id = new.post_id;
    v_author_id := new.author_user_id;
    v_content := new.body;
  else
    v_community_id := new.community_id;
    v_author_id := new.author_user_id;
    v_content := concat_ws(' ', to_jsonb(new) ->> 'title', new.body);
  end if;

  if v_author_id is null or v_author_id <> (select auth.uid()) then
    return new;
  end if;

  select membership.*
    into v_membership
  from public.community_memberships membership
  where membership.community_id = v_community_id
    and membership.user_id = v_author_id
    and membership.status = 'active';

  if v_membership.role in ('owner', 'moderator') then
    return new;
  end if;

  if exists (
    select 1
    from public.community_blocked_words word
    where word.community_id = v_community_id
      and word.is_active
      and word.action = 'block'
      and position(lower(word.term) in lower(v_content)) > 0
  ) then
    raise exception 'This content contains a prohibited word';
  end if;

  select settings.*
    into v_settings
  from public.community_safety_settings settings
  where settings.community_id = v_community_id;

  if tg_op = 'INSERT'
     and v_settings.new_member_limit_enabled
     and v_membership.joined_at >= now() - make_interval(hours => v_settings.new_member_limit_hours) then
    select
      (
        select count(*)
        from public.community_posts post
        where post.community_id = v_community_id
          and post.author_user_id = v_author_id
          and post.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours)
      )
      + (
        select count(*)
        from public.community_comments comment
        join public.community_posts post on post.id = comment.post_id
        where post.community_id = v_community_id
          and comment.author_user_id = v_author_id
          and comment.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours)
      )
      + (
        select count(*)
        from public.community_chat_messages message
        where message.community_id = v_community_id
          and message.author_user_id = v_author_id
          and message.created_at >= now() - make_interval(hours => v_settings.new_member_limit_hours)
      )
      into v_action_count;

    if v_action_count >= v_settings.new_member_max_actions then
      raise exception 'New member posting limit reached';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function community_private.validate_community_content()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
