-- Team Works P8-a actor and financial-boundary verification.
-- Requires two existing profiles and rolls every fixture back.

begin;

do $$
declare
  owner_user_id uuid;
  actor_user_id uuid;
  v_organization_id uuid := gen_random_uuid();
  v_other_organization_id uuid := gen_random_uuid();
  v_owner_member_id uuid := gen_random_uuid();
  v_actor_member_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_task_id uuid := gen_random_uuid();
  visible_count integer;
  affected_count integer;
begin
  if has_table_privilege('anon', 'public.team_works_projects', 'select')
    or has_table_privilege('authenticated', 'public.team_works_projects', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_project_payouts', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_project_invoices', 'delete') then
    raise exception 'Team Works grants are broader than the P8-a boundary';
  end if;

  select p.user_id into owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id into actor_user_id from public.profiles p where p.user_id <> owner_user_id order by p.created_at, p.id limit 1;
  if owner_user_id is null or actor_user_id is null then
    raise exception 'Team Works P8-a test requires profiles for two auth users';
  end if;

  insert into public.team_works_organizations (id, owner_user_id, name)
  values (v_organization_id, owner_user_id, 'P8-a owner organization'),
         (v_other_organization_id, actor_user_id, 'P8-a other organization');
  insert into public.team_works_organization_members (id, organization_id, user_id, display_name, role, status)
  values (v_owner_member_id, v_organization_id, owner_user_id, 'Owner', 'owner', 'active'),
         (v_actor_member_id, v_organization_id, actor_user_id, 'Worker', 'worker', 'active');
  insert into public.team_works_projects (id, organization_id, title, status, client_visible, payouts_enabled, invoices_enabled)
  values (v_project_id, v_organization_id, 'P8-a project', 'active', true, true, true);
  insert into public.team_works_project_members (project_id, organization_id, organization_member_id, project_role)
  values (v_project_id, v_organization_id, v_owner_member_id, 'owner'),
         (v_project_id, v_organization_id, v_actor_member_id, 'worker');
  insert into public.team_works_project_tasks (id, project_id, assignee_member_id, title, status, client_visible)
  values (v_task_id, v_project_id, v_actor_member_id, 'P8-a task', 'in_progress', true);
  insert into public.team_works_project_resources (project_id, title, resource_type, audience, memo)
  values (v_project_id, 'Admin', 'note', 'admin', 'admin only'),
         (v_project_id, 'Members', 'note', 'members', 'worker visible'),
         (v_project_id, 'Client', 'note', 'client', 'client visible'),
         (v_project_id, 'All', 'note', 'all', 'both visible');
  insert into public.team_works_project_payouts (project_id, task_id, payee_member_id, amount)
  values (v_project_id, v_task_id, v_actor_member_id, 12000);

  perform set_config('request.jwt.claims', json_build_object('sub', owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_project_resources r where r.project_id = v_project_id;
  if visible_count <> 4 then raise exception 'owner resource visibility mismatch: %', visible_count; end if;
  begin
    insert into public.team_works_project_invoices (project_id, task_id, billed_member_id, amount)
    values (v_project_id, v_task_id, v_actor_member_id, 15000);
    raise exception 'worker project member accepted as invoice recipient';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_project_resources r where r.project_id = v_project_id;
  if visible_count <> 2 then raise exception 'worker resource visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_project_payouts p where p.project_id = v_project_id;
  if visible_count <> 1 then raise exception 'worker payout visibility mismatch: %', visible_count; end if;
  update public.team_works_project_payouts set amount = 1 where project_id = v_project_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'worker changed payout'; end if;

  execute 'reset role';
  update public.team_works_organization_members set role = 'client_user' where id = v_actor_member_id;
  update public.team_works_project_members set project_role = 'client' where project_id = v_project_id and organization_member_id = v_actor_member_id;
  update public.team_works_project_tasks set assignee_member_id = null where id = v_task_id;
  insert into public.team_works_project_invoices (project_id, task_id, billed_member_id, amount)
  values (v_project_id, v_task_id, v_actor_member_id, 15000);

  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_project_resources r where r.project_id = v_project_id;
  if visible_count <> 2 then raise exception 'client resource visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_project_invoices i where i.project_id = v_project_id;
  if visible_count <> 1 then raise exception 'client invoice visibility mismatch: %', visible_count; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  begin
    perform 1 from public.team_works_projects limit 1;
    raise exception 'anon read Team Works projects';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise notice 'Team Works P8-a RLS verification passed; transaction will roll back';
end
$$;

rollback;
