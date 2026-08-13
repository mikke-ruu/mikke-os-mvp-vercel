-- 20260814093000_mikke_id_shared_validation.sql の共通関数を利用する。
-- Manager から、認証中の本人だけが canonical な mikke ID を変更する。
-- 書式と予約語の検査は共通関数へ集約し、重複は profiles_handle_unique を最終判定に使う。
create or replace function public.mikke_update_my_mikke_id(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile_id uuid;
  v_current text;
  v_next text;
  v_constraint_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.id, p.handle
  into v_profile_id, v_current
  from public.profiles p
  where p.user_id = v_user_id
  order by p.created_at asc
  limit 1
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found for authenticated user.' using errcode = 'P0002';
  end if;

  v_next := public.mikke_normalize_mikke_id(p_handle, v_current);

  if v_next = v_current then
    return v_current;
  end if;

  begin
    update public.profiles
    set handle = v_next,
        updated_at = now()
    where id = v_profile_id
      and user_id = v_user_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name in (
        'profiles_handle_unique',
        'profiles_user_handle_unique',
        'story_profiles_handle_lower_key'
      ) then
        raise exception 'このmikke IDは使用されています。別のIDを選んでください。'
          using errcode = '23505';
      end if;

      raise;
  end;

  return v_next;
end;
$$;

comment on function public.mikke_update_my_mikke_id(text) is
  '認証中の本人のmikke IDを変更する。書式・予約語検査はmikke_normalize_mikke_idへ委譲する。';

revoke all on function public.mikke_update_my_mikke_id(text) from public, anon;
grant execute on function public.mikke_update_my_mikke_id(text) to authenticated;

notify pgrst, 'reload schema';
