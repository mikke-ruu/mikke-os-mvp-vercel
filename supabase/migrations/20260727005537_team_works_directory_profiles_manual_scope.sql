-- Team Works: directory self-profiles, organization contact details, and
-- project/manual sharing metadata.

alter table public.team_works_partners
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists skills text,
  add column if not exists bio text;

alter table public.team_works_clients
  add column if not exists contact_name text,
  add column if not exists department text,
  add column if not exists phone text,
  add column if not exists address text;

alter table public.team_works_organizations
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text;

alter table public.team_works_manuals
  add column if not exists sharing_scope text not null default 'project'
  constraint team_works_manuals_sharing_scope_check
  check (sharing_scope in ('project', 'organization'));

create or replace function public.team_works_get_my_partner_profile()
returns table (
  id uuid,
  organization_id uuid,
  display_name text,
  email text,
  phone text,
  address text,
  skills text,
  bio text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    p.id,
    p.organization_id,
    p.display_name,
    p.email,
    p.phone,
    p.address,
    p.skills,
    p.bio
  from auth.users u
  join public.team_works_organization_members m
    on m.user_id = u.id
   and m.role = 'worker'
   and m.status = 'active'
  join public.team_works_partners p
    on p.organization_id = m.organization_id
   and lower(p.email) = lower(coalesce(u.email, ''))
   and p.status <> 'archived'
  where u.id = auth.uid()
  order by p.updated_at desc
  limit 1
$$;

create or replace function public.team_works_update_my_partner_profile(
  p_display_name text,
  p_phone text,
  p_address text,
  p_skills text,
  p_bio text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_partner public.team_works_partners%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required';
  end if;

  update public.team_works_partners p
  set display_name = trim(p_display_name),
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), ''),
      skills = nullif(trim(p_skills), ''),
      bio = nullif(trim(p_bio), ''),
      updated_at = now()
  from auth.users u, public.team_works_organization_members m
  where u.id = auth.uid()
    and m.user_id = u.id
    and m.organization_id = p.organization_id
    and m.role = 'worker'
    and m.status = 'active'
    and lower(p.email) = lower(coalesce(u.email, ''))
    and p.status <> 'archived'
  returning p.* into updated_partner;

  if updated_partner.id is null then
    raise exception 'Partner profile not found';
  end if;

  update public.team_works_organization_members
  set display_name = updated_partner.display_name,
      updated_at = now()
  where user_id = auth.uid()
    and organization_id = updated_partner.organization_id
    and role = 'worker'
    and status = 'active';
  return true;
end
$$;

create or replace function public.team_works_get_my_client_profile()
returns table (
  id uuid,
  organization_id uuid,
  company_name text,
  contact_name text,
  department text,
  email text,
  phone text,
  address text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    c.id,
    c.organization_id,
    c.display_name as company_name,
    c.contact_name,
    c.department,
    c.email,
    c.phone,
    c.address
  from auth.users u
  join public.team_works_organization_members m
    on m.user_id = u.id
   and m.role = 'client_user'
   and m.status = 'active'
  join public.team_works_clients c
    on c.organization_id = m.organization_id
   and lower(c.email) = lower(coalesce(u.email, ''))
   and c.status <> 'archived'
  where u.id = auth.uid()
  order by c.updated_at desc
  limit 1
$$;

create or replace function public.team_works_update_my_client_profile(
  p_company_name text,
  p_contact_name text,
  p_department text,
  p_phone text,
  p_address text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_client public.team_works_clients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_company_name), '') is null then
    raise exception 'Company name is required';
  end if;

  update public.team_works_clients c
  set display_name = trim(p_company_name),
      contact_name = nullif(trim(p_contact_name), ''),
      department = nullif(trim(p_department), ''),
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), ''),
      updated_at = now()
  from auth.users u, public.team_works_organization_members m
  where u.id = auth.uid()
    and m.user_id = u.id
    and m.organization_id = c.organization_id
    and m.role = 'client_user'
    and m.status = 'active'
    and lower(c.email) = lower(coalesce(u.email, ''))
    and c.status <> 'archived'
  returning c.* into updated_client;

  if updated_client.id is null then
    raise exception 'Client profile not found';
  end if;

  update public.team_works_organization_members
  set display_name = coalesce(nullif(updated_client.contact_name, ''), updated_client.display_name),
      updated_at = now()
  where user_id = auth.uid()
    and organization_id = updated_client.organization_id
    and role = 'client_user'
    and status = 'active';
  return true;
end
$$;

revoke all on function public.team_works_get_my_partner_profile() from public, anon;
revoke all on function public.team_works_update_my_partner_profile(text,text,text,text,text) from public, anon;
revoke all on function public.team_works_get_my_client_profile() from public, anon;
revoke all on function public.team_works_update_my_client_profile(text,text,text,text,text) from public, anon;

grant execute on function public.team_works_get_my_partner_profile() to authenticated, service_role;
grant execute on function public.team_works_update_my_partner_profile(text,text,text,text,text) to authenticated, service_role;
grant execute on function public.team_works_get_my_client_profile() to authenticated, service_role;
grant execute on function public.team_works_update_my_client_profile(text,text,text,text,text) to authenticated, service_role;

comment on column public.team_works_manuals.sharing_scope is
  'project: only this project; organization: reusable master shared across the organization.';
