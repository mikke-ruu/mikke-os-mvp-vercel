-- Assign the existing verified Ayumi profile as the Media Free final decision operator.
-- Resolve the auth identity inside the database instead of hardcoding a generated UUID.

do $$
declare
  v_user_ids uuid[];
  v_user_id uuid;
begin
  select array_agg(p.user_id order by p.user_id)
    into v_user_ids
  from public.profiles p
  where p.handle='ayumi' and p.display_name='野田あゆみ';

  if coalesce(array_length(v_user_ids,1),0)<>1 then
    raise exception 'MEDIA_FINAL_DECIDER_PROFILE_NOT_UNIQUE';
  end if;

  v_user_id:=v_user_ids[1];

  if not exists(select 1 from auth.users u where u.id=v_user_id and not u.is_anonymous) then
    raise exception 'MEDIA_FINAL_DECIDER_HUMAN_AUTH_REQUIRED';
  end if;

  insert into private.media_ops_operators(user_id,operator_name,operator_role,is_active)
  values(v_user_id,'野田あゆみ','final_decider',true)
  on conflict(user_id) do update set
    operator_name=excluded.operator_name,
    operator_role='final_decider',
    is_active=true,
    updated_at=now();
end $$;
