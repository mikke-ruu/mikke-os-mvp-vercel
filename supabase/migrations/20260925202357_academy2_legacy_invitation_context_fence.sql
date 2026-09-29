-- Close legacy invitation materialization and legacy role discovery for opt-in HQs.
-- Disabled tenants retain exact original bodies; original RPC OIDs are preserved.
do $$ declare item record; definition text; begin
 for item in select * from(values
 ('public.academy_respond_headquarters_invitation(uuid,text)','public.academy_respond_headquarters_invitation','legacy_respond_hq_invitation','uuid,text'),
 ('public.academy_list_my_contexts()','public.academy_list_my_contexts','legacy_list_my_contexts','')
 ) f(signature,source_name,backup_name,args) loop
  if to_regprocedure('academy2_access.'||item.backup_name||'('||item.args||')') is not null then raise exception 'academy2_legacy_backup_already_exists';end if;
  select pg_get_functiondef(item.signature::regprocedure) into definition;
  if position('CREATE OR REPLACE FUNCTION '||item.source_name||'(' in definition)=0 then raise exception 'academy2_legacy_signature_mismatch';end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION '||item.source_name||'(','CREATE FUNCTION academy2_access.'||item.backup_name||'(');
  execute 'revoke all on function academy2_access.'||item.backup_name||'('||item.args||') from public,anon,authenticated,service_role';
 end loop;
end $$;

create or replace function public.academy_respond_headquarters_invitation(p_invitation_id uuid,p_response text)
returns public.academy_headquarters_invitations language plpgsql security definer set search_path='' as $$
declare hq uuid;
begin
 select headquarters_id into hq from public.academy_headquarters_invitations where id=p_invitation_id;
 if hq is not null then
  -- Serialize activation against the response. This never activates a tenant.
  perform 1 from academy2_access.tenants where headquarters_id=hq for share;
  if not academy2_access.legacy_allowed(hq) then raise exception 'academy2_legacy_invitation_disabled' using errcode='42501';end if;
 end if;
 return academy2_access.legacy_respond_hq_invitation(p_invitation_id,p_response);
end $$;

create or replace function public.academy_list_my_contexts()
returns table(academy_id uuid,academy_name text,academy_handle text,roles text[],portals text[],capabilities text[])
language sql stable security definer set search_path='' as $$
 select c.* from academy2_access.legacy_list_my_contexts() c where academy2_access.legacy_allowed(c.academy_id)
$$;

create function academy2_access.my_headquarters()
returns table(id uuid,name text,handle text,role text)
language sql stable security definer set search_path='' as $$
 select h.id,h.name,h.handle,m.role
 from academy2_access.memberships m
 join academy2_access.tenants t on t.headquarters_id=m.headquarters_id and t.runtime_enabled
 join public.academy_headquarters h on h.id=t.headquarters_id
 where auth.uid() is not null and m.user_id=auth.uid() and m.active
 order by h.created_at,h.id
$$;
create function public.academy2_my_headquarters()
returns table(id uuid,name text,handle text,role text)
language sql stable security invoker set search_path='' as $$select * from academy2_access.my_headquarters()$$;
revoke all on function academy2_access.my_headquarters(),public.academy2_my_headquarters() from public,anon,authenticated,service_role;
grant execute on function academy2_access.my_headquarters(),public.academy2_my_headquarters() to authenticated;
revoke all on function public.academy_respond_headquarters_invitation(uuid,text),public.academy_list_my_contexts() from public,anon;
grant execute on function public.academy_respond_headquarters_invitation(uuid,text),public.academy_list_my_contexts() to authenticated;
