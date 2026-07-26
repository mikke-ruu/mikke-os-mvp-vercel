-- Team Works R6 P1: multi-role RLS verification.
-- One actor holds BOTH worker and client_user roles on the same operations
-- project (two organization_member rows, same user_id). Confirms that
-- role-gated policies now check "do I hold role X" rather than "limit 1"
-- picking an arbitrary role, and that role-specific identity comparisons use
-- the matching role's member id, not a possibly-wrong one.
-- Uses two existing auth users and rolls all fixtures back.

begin;

do $$
declare
  owner_user_id uuid;
  actor_user_id uuid;
  v_org uuid := gen_random_uuid();
  v_owner_member uuid := gen_random_uuid();
  v_worker_member uuid := gen_random_uuid();
  v_client_member uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_participant uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  visible_count integer;
  found_id uuid;
begin
  select p.user_id into owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id into actor_user_id
  from public.profiles p
  where p.user_id <> owner_user_id
  order by p.created_at, p.id
  limit 1;
  if owner_user_id is null or actor_user_id is null then
    raise exception 'R6 multi-role test requires profiles for two auth users';
  end if;

  insert into public.team_works_organizations (id, owner_user_id, name)
  values (v_org, owner_user_id, 'R6 multi-role test org');
  insert into public.team_works_organization_members
    (id, organization_id, user_id, display_name, role, status)
  values
    (v_owner_member, v_org, owner_user_id, 'Owner', 'owner', 'active'),
    (v_worker_member, v_org, actor_user_id, 'Actor as worker', 'worker', 'active'),
    (v_client_member, v_org, actor_user_id, 'Actor as client', 'client_user', 'active');
  insert into public.team_works_projects (id, organization_id, title, status, style)
  values (v_project, v_org, 'R6 multi-role test project', 'active', 'operations');
  insert into public.team_works_project_members
    (project_id, organization_id, organization_member_id, project_role)
  values
    (v_project, v_org, v_owner_member, 'owner'),
    (v_project, v_org, v_worker_member, 'worker'),
    (v_project, v_org, v_client_member, 'client');

  -- Staff seeds a manual (worker-visible, client-hidden) and a session
  -- assigned to the actor's worker identity.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  insert into public.team_works_manuals (project_id, no, title) values (v_project, 1, 'R6 manual');
  insert into public.team_works_op_sessions (id, project_id, partner_member_id, session_date, start_time, duration_min)
  values (v_session, v_project, v_worker_member, current_date + 1, '10:00', 60);
  execute 'reset role';

  -- Actor (worker + client on the same project): client-only writes must
  -- succeed even though the same account also holds worker.
  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- The core fix, checked directly: each role-scoped lookup must resolve to
  -- THAT role's member id, never the account's other role.
  if private.team_works_project_member_id_for(v_project, 'worker') <> v_worker_member then
    raise exception 'project_member_id_for(worker) did not resolve to the worker row';
  end if;
  if private.team_works_project_member_id_for(v_project, 'client') <> v_client_member then
    raise exception 'project_member_id_for(client) did not resolve to the client row';
  end if;
  if not private.team_works_has_project_role(v_project, 'worker') then
    raise exception 'has_project_role(worker) false for a multi-role account';
  end if;
  if not private.team_works_has_project_role(v_project, 'client') then
    raise exception 'has_project_role(client) false for a multi-role account';
  end if;

  insert into public.team_works_participants (id, project_id, name)
  values (v_participant, v_project, 'R6 participant')
  returning id into found_id;
  if found_id is null then raise exception 'client-role insert on participants failed despite also holding worker'; end if;

  insert into public.team_works_session_roster (session_id, project_id, participant_id, order_index)
  values (v_session, v_project, v_participant, 1);
  select count(*) into visible_count from public.team_works_session_roster where session_id = v_session;
  if visible_count <> 1 then raise exception 'client-role insert on session_roster failed despite also holding worker'; end if;

  delete from public.team_works_session_roster where session_id = v_session and participant_id = v_participant;
  select count(*) into visible_count from public.team_works_session_roster where session_id = v_session;
  if visible_count <> 0 then raise exception 'client-role delete on session_roster failed despite also holding worker'; end if;

  -- Worker-only visibility (manuals) must still work for the same account.
  select count(*) into visible_count from public.team_works_manuals where project_id = v_project;
  if visible_count <> 1 then raise exception 'worker-role manual visibility failed for a multi-role account'; end if;

  -- Worker-scoped session visibility must resolve to the worker identity,
  -- not be blocked or confused by the account's other (client) role.
  select count(*) into visible_count
  from public.team_works_op_sessions
  where id = v_session;
  if visible_count <> 1 then raise exception 'worker-role session visibility failed for a multi-role account'; end if;

  -- Re-insert the roster row as the worker side (worker cannot insert here --
  -- only staff/client can per the roster policies) is intentionally not
  -- tested; workers read via team_works_ops_session_reports instead.
  execute 'reset role';

  raise notice 'Team Works R6 multi-role RLS verification passed; transaction will roll back';
end
$$;

rollback;
