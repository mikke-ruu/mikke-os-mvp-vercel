create or replace function public.mikke_mark_marketnote_owned_from_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.mikke_app_entitlements (
    user_id,
    app_key,
    status,
    source,
    starts_at,
    ends_at,
    note,
    updated_at
  ) values (
    v_user_id,
    'marketnote',
    'active',
    'self_login',
    now(),
    null,
    'MarketNote login destination selected by the user',
    now()
  )
  on conflict (user_id, app_key) do update
  set status = 'active',
      source = 'self_login',
      starts_at = coalesce(public.mikke_app_entitlements.starts_at, excluded.starts_at),
      ends_at = null,
      note = excluded.note,
      updated_at = now();
end;
$$;

revoke all on function public.mikke_mark_marketnote_owned_from_login() from public;
revoke all on function public.mikke_mark_marketnote_owned_from_login() from anon;
grant execute on function public.mikke_mark_marketnote_owned_from_login() to authenticated;
