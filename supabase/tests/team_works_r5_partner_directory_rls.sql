-- Team Works R5 partner directory RLS verification.
-- Uses two existing auth users and rolls all fixtures back.

begin;

do $$
declare
  owner_user_id uuid;
  actor_user_id uuid;
  v_org uuid := gen_random_uuid();
  v_owner_member uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_partner uuid := gen_random_uuid();
  visible_count integer;
begin
  if has_table_privilege('anon', 'public.team_works_partners', 'select')
    or has_table_privilege('anon', 'public.team_works_project_partners', 'select')
    or has_table_privilege('authenticated', 'public.team_works_partners', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_project_partners', 'delete') then
    raise exception 'R5 partner directory grants are broader than intended';
  end if;

  select p.user_id into owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id into actor_user_id
  from public.profiles p
  where p.user_id <> owner_user_id
  order by p.created_at, p.id
  limit 1;
  if owner_user_id is null or actor_user_id is null then
    raise exception 'R5 partner directory test requires profiles for two auth users';
  end if;

  insert into public.team_works_organizations (id, owner_user_id, name)
  values (v_org, owner_user_id, 'R5 test org');
  insert into public.team_works_organization_members
    (id, organization_id, user_id, display_name, role, status)
  values
    (v_owner_member, v_org, owner_user_id, 'Owner', 'owner', 'active'),
    (v_actor_member, v_org, actor_user_id, 'Worker', 'worker', 'active');
  insert into public.team_works_projects (id, organization_id, title, status, style)
  values (v_project, v_org, 'R5 test project', 'active', 'operations');
  insert into public.team_works_project_members
    (project_id, organization_id, organization_member_id, project_role)
  values
    (v_project, v_org, v_owner_member, 'owner'),
    (v_project, v_org, v_actor_member, 'worker');

  -- Staff can create and assign a directory partner.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  insert into public.team_works_partners (id, organization_id, display_name, email)
  values (v_partner, v_org, 'Partner Directory Entry', 'r5-partner@example.com');
  insert into public.team_works_project_partners (project_id, organization_id, partner_id)
  values (v_project, v_org, v_partner);
  select count(*) into visible_count
  from public.team_works_project_partners
  where project_id = v_project;
  if visible_count <> 1 then raise exception 'staff cannot see project partner assignment'; end if;
  execute 'reset role';

  -- A worker project member cannot enumerate or mutate the staff partner directory.
  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_partners where organization_id = v_org;
  if visible_count <> 0 then raise exception 'worker can see organization partner directory'; end if;
  begin
    insert into public.team_works_partners (organization_id, display_name, email)
    values (v_org, 'Bad worker insert', 'bad-worker@example.com');
    raise exception 'worker inserted partner directory row';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.team_works_project_partners (project_id, organization_id, partner_id)
    values (v_project, v_org, v_partner);
    raise exception 'worker assigned partner to project';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- Anon cannot even query either table.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  begin
    perform 1 from public.team_works_partners limit 1;
    raise exception 'anon read partner directory';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.team_works_project_partners limit 1;
    raise exception 'anon read project partner assignments';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise notice 'Team Works R5 partner directory RLS verification passed; transaction will roll back';
end
$$;

rollback;
