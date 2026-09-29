-- Limited, opt-in-only legacy fence. Existing tenants have identical behavior.
-- This is NOT a blanket authorization rollout: publication/billing worker paths
-- still require separate review. No tenant is enabled or assigned by migration.

create function academy2_access.legacy_allowed(p_hq uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from academy2_access.tenants t where t.headquarters_id=p_hq and t.runtime_enabled)
$$;
revoke all on function academy2_access.legacy_allowed(uuid) from public,anon,authenticated,service_role;
grant usage on schema academy2_access to anon;
grant execute on function academy2_access.legacy_allowed(uuid) to anon,authenticated;

-- Copy exact current bodies first. Keep original OIDs by CREATE OR REPLACE below:
-- renaming the original alone would leave existing policy dependencies unfenced.
do $$
declare item record; definition text;
begin
 for item in select * from (values
  ('private.academy_headquarters_role(uuid,uuid)','private.academy_headquarters_role','legacy_headquarters_role','uuid,uuid'),
  ('public.academy_owns_hq(uuid)','public.academy_owns_hq','legacy_owns_hq','uuid'),
  ('public.academy_export_my_headquarters(uuid)','public.academy_export_my_headquarters','legacy_export_headquarters','uuid')
 ) as f(signature,source_name,backup_name,args) loop
  if to_regprocedure('academy2_access.'||item.backup_name||'('||item.args||')') is not null then
   raise exception 'academy2_legacy_backup_already_exists';
  end if;
  select pg_get_functiondef(item.signature::regprocedure) into definition;
  if position('CREATE OR REPLACE FUNCTION '||item.source_name||'(' in definition)=0 then
   raise exception 'academy2_legacy_signature_mismatch';
  end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION '||item.source_name||'(','CREATE FUNCTION academy2_access.'||item.backup_name||'(');
  execute 'revoke all on function academy2_access.'||item.backup_name||'('||item.args||') from public,anon,authenticated,service_role';
 end loop;
end $$;

create or replace function private.academy_headquarters_role(p_headquarters_id uuid,p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when academy2_access.legacy_allowed(p_headquarters_id)
 then academy2_access.legacy_headquarters_role(p_headquarters_id,p_user_id) else null end
$$;

create or replace function public.academy_owns_hq(p_hq_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case when academy2_access.legacy_allowed(p_hq_id)
 then academy2_access.legacy_owns_hq(p_hq_id) else false end
$$;

create or replace function public.academy_export_my_headquarters(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not academy2_access.legacy_allowed(p_headquarters_id) then
  raise exception 'academy2_legacy_export_disabled' using errcode='42501';
 end if;
 return academy2_access.legacy_export_headquarters(p_headquarters_id);
end $$;

-- These three existing tables have direct owner / instructor / self / public OR
-- branches. Restrictive guards close those branches without changing any old
-- permissive policy. V2 allowlisted SECURITY DEFINER RPCs remain available.
create policy academy2_hq_legacy_fence on public.academy_headquarters
as restrictive for all to anon,authenticated
using(academy2_access.legacy_allowed(id)) with check(academy2_access.legacy_allowed(id));
create policy academy2_application_legacy_fence on public.academy_applications
as restrictive for all to anon,authenticated
using(academy2_access.legacy_allowed(headquarters_id)) with check(academy2_access.legacy_allowed(headquarters_id));
create policy academy2_instructor_legacy_fence on public.academy_instructors
as restrictive for all to anon,authenticated
using(academy2_access.legacy_allowed(headquarters_id)) with check(academy2_access.legacy_allowed(headquarters_id));

comment on function academy2_access.legacy_allowed(uuid) is 'Limited legacy fence only; false for explicitly enabled v2 tenants. Other billing/publication/security-definer paths still require review.';
