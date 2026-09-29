-- Depends on 233000. Service adapter routing only; no enrollment or billing mutation.
create function public.academy2_first_publication_setup_scope(p_owner_user_id uuid,p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_enabled boolean;
begin
 if not exists(select 1 from public.academy_headquarters h join auth.users u on u.id=h.owner_user_id where h.id=p_headquarters_id and h.owner_user_id=p_owner_user_id and u.is_anonymous is false) then
  return null;
 end if;
 select t.runtime_enabled into v_enabled from academy2_access.tenants t where t.headquarters_id=p_headquarters_id;
 if coalesce(v_enabled,false) then
  perform academy2_access.first_setup_owner(p_headquarters_id,p_owner_user_id);
 end if;
 return jsonb_build_object('headquarters_id',p_headquarters_id,'owner_user_id',p_owner_user_id,'scheme',case when coalesce(v_enabled,false) then 'academy2' else 'legacy' end);
end $$;
revoke all on function public.academy2_first_publication_setup_scope(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_first_publication_setup_scope(uuid,uuid) to service_role;
notify pgrst,'reload schema';
