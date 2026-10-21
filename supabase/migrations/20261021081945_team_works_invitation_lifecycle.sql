-- Operations HQ already manages directory/project invitations at organization scope.
-- Keep settings/offers at the same scope, without changing delivery project access.
create policy team_works_operations_settings_staff
on public.team_works_project_partner_settings for all to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id
  and p.style = 'operations' and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id
  and p.style = 'operations' and private.team_works_is_org_staff(p.organization_id)));

create policy team_works_operations_offers_staff
on public.team_works_project_partner_offers for all to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id
  and p.style = 'operations' and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id
  and p.style = 'operations' and private.team_works_is_org_staff(p.organization_id)));

-- Transactional cancellation: invalidate both the link and pending directory assignment.
-- RLS still applies. No participant, account, or historical project-member row is deleted.
create function public.team_works_cancel_project_invitation(
  target_project_id uuid, target_email text, target_role text
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
  v_member uuid;
  v_email text := lower(trim(target_email));
begin
  select organization_id into v_org from public.team_works_projects
  where id = target_project_id and style = 'operations';
  if auth.uid() is null or v_org is null or not private.team_works_is_org_staff(v_org)
    or target_role is null or target_role not in ('worker', 'client_user') then
    raise exception 'invitation cancellation is not allowed' using errcode = '42501';
  end if;
  -- Lock directory assignments before changing the invitation, as activation does.
  if target_role = 'worker' then
    perform 1 from public.team_works_project_partners pp
      join public.team_works_partners d on d.id = pp.partner_id
      where pp.project_id = target_project_id and lower(d.email) = v_email for update of pp;
    select member_id into v_member from public.team_works_find_active_member(v_org, 'worker', v_email) limit 1;
    if exists (select 1 from public.team_works_project_partner_offers
      where project_id = target_project_id and organization_member_id = v_member and status = 'accepted') then
      raise exception '参加済みです。一覧を更新して「プロジェクトから外す」を使ってください。';
    end if;
    update public.team_works_project_partners pp set status = 'archived', updated_at = now()
      from public.team_works_partners d
      where pp.partner_id = d.id and pp.project_id = target_project_id
        and lower(d.email) = v_email and pp.status = 'invited';
    update public.team_works_project_partner_offers set status = 'removed', updated_at = now()
      where project_id = target_project_id and organization_member_id = v_member and status = 'pending';
  else
    perform 1 from public.team_works_project_clients pc
      join public.team_works_clients d on d.id = pc.client_id
      where pc.project_id = target_project_id and lower(d.email) = v_email for update of pc;
    if exists (select 1 from public.team_works_project_clients pc join public.team_works_clients d on d.id = pc.client_id
      where pc.project_id = target_project_id and lower(d.email) = v_email and pc.status = 'active') then
      raise exception '参加済みです。一覧を更新してください。';
    end if;
    update public.team_works_project_clients pc set status = 'archived', updated_at = now()
      from public.team_works_clients d
      where pc.client_id = d.id and pc.project_id = target_project_id
        and lower(d.email) = v_email and pc.status = 'invited';
  end if;
  update public.team_works_member_invites set status = 'revoked', updated_at = now()
    where project_id = target_project_id and organization_id = v_org
      and lower(email) = v_email and role = target_role and status in ('pending', 'expired');
end;
$$;
revoke all on function public.team_works_cancel_project_invitation(uuid,text,text) from public, anon;
grant execute on function public.team_works_cancel_project_invitation(uuid,text,text) to authenticated;

-- Extend the existing self-activation path. Match only the authenticated user's
-- verified Auth email to an active directory entry and an explicit invited link.
-- This is not callable as an arbitrary-user provisioning endpoint.
create or replace function public.team_works_activate_portal_membership()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  uemail text;
  suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  assignment record;
  v_member uuid;
begin
  if uid is null then return; end if;
  select lower(email) into uemail from auth.users where id = uid and email_confirmed_at is not null;
  if uemail is null then return; end if;
  insert into public.team_works_organization_members
    (organization_id,user_id,source_local_id,display_name,role,status)
  select d.organization_id,uid,'directory:worker:'||uid::text||':'||suffix,d.display_name,'worker','active'
    from public.team_works_partners d where d.status='active' and lower(d.email)=uemail
      and not exists (select 1 from public.team_works_organization_members m
        where m.organization_id=d.organization_id and m.user_id=uid and m.role='worker' and m.status<>'archived')
    on conflict do nothing;
  insert into public.team_works_organization_members
    (organization_id,user_id,source_local_id,display_name,role,status)
  select d.organization_id,uid,'directory:client:'||uid::text||':'||suffix,d.display_name,'client_user','active'
    from public.team_works_clients d where d.status='active' and lower(d.email)=uemail
      and not exists (select 1 from public.team_works_organization_members m
        where m.organization_id=d.organization_id and m.user_id=uid and m.role='client_user' and m.status<>'archived')
    on conflict do nothing;

  for assignment in
    select pp.project_id,pp.organization_id from public.team_works_project_partners pp
    join public.team_works_partners d on d.id=pp.partner_id and d.organization_id=pp.organization_id
    join public.team_works_projects p on p.id=pp.project_id and p.organization_id=pp.organization_id
    where pp.status='invited' and d.status='active' and lower(d.email)=uemail
      and p.style='operations' and p.status='active'
    order by pp.project_id for update of pp
  loop
    select id into v_member from public.team_works_organization_members
      where organization_id=assignment.organization_id and user_id=uid and role='worker' and status='active';
    if v_member is null then continue; end if;
    insert into public.team_works_project_members(project_id,organization_id,organization_member_id,project_role)
      values(assignment.project_id,assignment.organization_id,v_member,'worker') on conflict do nothing;
    insert into public.team_works_project_partner_settings(project_id,organization_member_id,status)
      values(assignment.project_id,v_member,'active') on conflict do nothing;
    -- Never overwrite accepted, declined, or removed offers on a page reload.
    insert into public.team_works_project_partner_offers(project_id,organization_member_id,status)
      values(assignment.project_id,v_member,'pending') on conflict do nothing;
    update public.team_works_member_invites set status='revoked',updated_at=now()
      where project_id=assignment.project_id and organization_id=assignment.organization_id
        and role='worker' and lower(email)=uemail and status='pending';
  end loop;
end;
$$;
revoke all on function public.team_works_activate_portal_membership() from public, anon;
grant execute on function public.team_works_activate_portal_membership() to authenticated;
notify pgrst, 'reload schema';

-- Serialize client approval against cancellation on the directory assignment row.
create or replace function public.team_works_approve_client_project(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  uemail text;
  v_org uuid;
  v_client uuid;
  v_member uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select lower(email) into uemail from auth.users where id = uid;

  select pc.organization_id, pc.client_id
    into v_org, v_client
  from public.team_works_project_clients pc
  join public.team_works_clients c on c.id = pc.client_id
  where pc.project_id = target_project_id
    and pc.status = 'invited'
    and c.status = 'active'
    and lower(c.email) = uemail
  limit 1 for update of pc;

  if v_org is null then
    raise exception 'no pending invitation for this project';
  end if;

  select id into v_member
  from public.team_works_organization_members
  where organization_id = v_org
    and user_id = uid
    and role = 'client_user'
    and status <> 'archived'
  limit 1;

  if v_member is null then
    raise exception 'client membership is not activated';
  end if;

  insert into public.team_works_project_members
    (project_id, organization_id, organization_member_id, project_role)
  values (target_project_id, v_org, v_member, 'client')
  on conflict (project_id, organization_member_id) do update set project_role = 'client';

  update public.team_works_project_clients
  set status = 'active', updated_at = now()
  where project_id = target_project_id and client_id = v_client;
end;
$$;


