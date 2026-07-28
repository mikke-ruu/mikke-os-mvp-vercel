-- Repair only invitation states that contradict an already-active membership.
-- Legitimate pending invitations remain untouched.

update public.team_works_member_invites i
set status = 'revoked',
    updated_at = now()
where i.status = 'pending'
  and exists (
    select 1
    from public.team_works_organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = i.organization_id
      and m.role = i.role
      and m.status = 'active'
      and lower(u.email) = lower(i.email)
      and (
        i.project_id is null
        or exists (
          select 1
          from public.team_works_project_members pm
          where pm.project_id = i.project_id
            and pm.organization_member_id = m.id
            and pm.project_role = case i.role
              when 'worker' then 'worker'
              when 'client_user' then 'client'
              else i.role
            end
        )
      )
  );

update public.team_works_project_partner_offers o
set status = 'removed',
    updated_at = now()
where o.status = 'pending'
  and exists (
    select 1
    from public.team_works_organization_members m
    where m.id = o.organization_member_id
      and m.status = 'archived'
  );

update public.team_works_project_partners pp
set status = 'active',
    updated_at = now()
where pp.status <> 'active'
  and exists (
    select 1
    from public.team_works_partners p
    join public.team_works_organization_members m
      on m.organization_id = p.organization_id
     and m.role = 'worker'
     and m.status = 'active'
    join auth.users u
      on u.id = m.user_id
     and lower(u.email) = lower(p.email)
    join public.team_works_project_partner_offers o
      on o.project_id = pp.project_id
     and o.organization_member_id = m.id
     and o.status = 'accepted'
    where p.id = pp.partner_id
  );

update public.team_works_project_clients pc
set status = 'active',
    updated_at = now()
where pc.status = 'invited'
  and exists (
    select 1
    from public.team_works_clients c
    join public.team_works_organization_members m
      on m.organization_id = c.organization_id
     and m.role = 'client_user'
     and m.status = 'active'
    join auth.users u
      on u.id = m.user_id
     and lower(u.email) = lower(c.email)
    join public.team_works_project_members pm
      on pm.project_id = pc.project_id
     and pm.organization_member_id = m.id
     and pm.project_role = 'client'
    where c.id = pc.client_id
  );
