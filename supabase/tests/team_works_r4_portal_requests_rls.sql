-- Team Works R4 narrow portal-write verification.
-- Uses two existing profiles and rolls all fixtures back.

begin;

do $$
declare
  owner_user_id uuid;
  actor_user_id uuid;
  v_org uuid := gen_random_uuid();
  v_owner_member uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_participant uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_roster uuid := gen_random_uuid();
  visible_count integer;
  affected_count integer;
begin
  if has_table_privilege('anon', 'public.team_works_ops_session_reports', 'select')
    or has_table_privilege('anon', 'public.team_works_client_requests', 'select')
    or has_table_privilege('authenticated', 'public.team_works_ops_session_reports', 'update')
    or has_table_privilege('authenticated', 'public.team_works_ops_session_reports', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_client_requests', 'delete') then
    raise exception 'R4 portal grants are broader than intended';
  end if;

  select p.user_id into owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id into actor_user_id
  from public.profiles p
  where p.user_id <> owner_user_id
  order by p.created_at, p.id
  limit 1;
  if owner_user_id is null or actor_user_id is null then
    raise exception 'R4 portal test requires profiles for two auth users';
  end if;

  insert into public.team_works_organizations (id, owner_user_id, name)
  values (v_org, owner_user_id, 'R4 test org');
  insert into public.team_works_organization_members
    (id, organization_id, user_id, display_name, role, status)
  values
    (v_owner_member, v_org, owner_user_id, 'Owner', 'owner', 'active'),
    (v_actor_member, v_org, actor_user_id, 'Partner', 'worker', 'active');
  insert into public.team_works_projects (id, organization_id, title, status, style)
  values (v_project, v_org, 'R4 test project', 'active', 'operations');
  insert into public.team_works_project_members
    (project_id, organization_id, organization_member_id, project_role)
  values
    (v_project, v_org, v_owner_member, 'owner'),
    (v_project, v_org, v_actor_member, 'worker');
  insert into public.team_works_participants (id, project_id, name)
  values (v_participant, v_project, 'Participant');
  insert into public.team_works_op_sessions
    (id, project_id, partner_member_id, session_date, start_time, duration_min)
  values (v_session, v_project, v_actor_member, '2026-08-03', '10:00', 60);
  insert into public.team_works_session_roster
    (id, session_id, project_id, participant_id, order_index)
  values (v_roster, v_session, v_project, v_participant, 1);

  -- Assigned partner can submit one immutable report.
  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  insert into public.team_works_ops_session_reports
    (project_id, session_id, submitted_by_member_id, attendance, progress, body)
  values (
    v_project,
    v_session,
    v_actor_member,
    jsonb_build_array(jsonb_build_object('rosterId', v_roster, 'participantId', v_participant, 'status', 'present')),
    jsonb_build_array(jsonb_build_object('participantId', v_participant, 'manualNo', 2)),
    'completed'
  );
  select count(*) into visible_count
  from public.team_works_ops_session_reports
  where project_id = v_project;
  if visible_count <> 1 then raise exception 'partner cannot see own report'; end if;
  update public.team_works_session_roster set attendance_status = 'present' where id = v_roster;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'partner directly updated canonical attendance'; end if;
  begin
    insert into public.team_works_client_requests
      (project_id, requested_by_member_id, request_type, requested_date)
    values (v_project, v_actor_member, 'closure', '2026-08-04');
    raise exception 'worker inserted client closure request';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- Flip the same actor to client and verify only the client request boundary.
  update public.team_works_organization_members set role = 'client_user' where id = v_actor_member;
  update public.team_works_project_members set project_role = 'client'
  where project_id = v_project and organization_member_id = v_actor_member;

  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  insert into public.team_works_client_requests
    (project_id, requested_by_member_id, request_type, requested_date, body)
  values (v_project, v_actor_member, 'closure', '2026-08-05', 'school closed');
  select count(*) into visible_count
  from public.team_works_client_requests
  where project_id = v_project;
  if visible_count <> 1 then raise exception 'client cannot see own request'; end if;
  begin
    insert into public.team_works_ops_session_reports
      (project_id, session_id, submitted_by_member_id)
    values (v_project, v_session, v_actor_member);
    raise exception 'client inserted partner report';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- Staff can see both records and review the client request.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_ops_session_reports where project_id = v_project;
  if visible_count <> 1 then raise exception 'staff cannot see partner report'; end if;
  update public.team_works_client_requests set status = 'accepted' where project_id = v_project;
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then raise exception 'staff cannot review client request'; end if;
  execute 'reset role';

  -- Anon cannot even query the new tables.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  begin
    perform 1 from public.team_works_ops_session_reports limit 1;
    raise exception 'anon read partner reports';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.team_works_client_requests limit 1;
    raise exception 'anon read client requests';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise notice 'Team Works R4 portal request RLS verification passed; transaction will roll back';
end
$$;

rollback;
