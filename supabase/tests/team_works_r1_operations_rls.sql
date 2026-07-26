-- Team Works R1 operations-style actor verification: owner / manager / partner(worker) / client / anon.
-- Requires two existing profiles and rolls every fixture back.
-- Key invariant under test: a partner sees ONLY participants/sessions/roster rows tied to
-- sessions where they are partner_member_id (not the whole project roster), while a client
-- sees the whole project roster/schedule but NOT the internal manuals.

begin;

do $$
declare
  owner_user_id uuid;
  actor_user_id uuid;
  v_organization_id uuid := gen_random_uuid();
  v_owner_member_id uuid := gen_random_uuid();
  v_actor_member_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_participant_assigned_id uuid := gen_random_uuid();
  v_participant_other_id uuid := gen_random_uuid();
  v_manual_id uuid := gen_random_uuid();
  v_rule_id uuid := gen_random_uuid();
  v_session_assigned_id uuid := gen_random_uuid();
  v_session_other_id uuid := gen_random_uuid();
  v_roster_assigned_id uuid := gen_random_uuid();
  v_roster_other_id uuid := gen_random_uuid();
  v_org_holiday_id uuid := gen_random_uuid();
  v_project_holiday_id uuid := gen_random_uuid();
  visible_count integer;
  affected_count integer;
begin
  if has_table_privilege('anon', 'public.team_works_participants', 'select')
    or has_table_privilege('authenticated', 'public.team_works_participants', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_manuals', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_op_sessions', 'delete') then
    raise exception 'Team Works R1 grants are broader than the R1 boundary';
  end if;

  select p.user_id into owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id into actor_user_id from public.profiles p where p.user_id <> owner_user_id order by p.created_at, p.id limit 1;
  if owner_user_id is null or actor_user_id is null then
    raise exception 'Team Works R1 test requires profiles for two auth users';
  end if;

  insert into public.team_works_organizations (id, owner_user_id, name)
  values (v_organization_id, owner_user_id, 'R1 organization');
  insert into public.team_works_organization_members (id, organization_id, user_id, display_name, role, status)
  values (v_owner_member_id, v_organization_id, owner_user_id, 'Owner', 'owner', 'active'),
         (v_actor_member_id, v_organization_id, actor_user_id, 'Actor', 'manager', 'active');
  insert into public.team_works_projects (id, organization_id, title, status, style)
  values (v_project_id, v_organization_id, 'R1 operations project', 'active', 'operations');
  insert into public.team_works_project_members (project_id, organization_id, organization_member_id, project_role)
  values (v_project_id, v_organization_id, v_owner_member_id, 'owner'),
         (v_project_id, v_organization_id, v_actor_member_id, 'manager');

  insert into public.team_works_groups (id, project_id, name)
  values (v_group_id, v_project_id, 'Group A');
  insert into public.team_works_participants (id, project_id, group_id, name, level, cautions)
  values (v_participant_assigned_id, v_project_id, v_group_id, 'Assigned Participant', 'N4', 'none'),
         (v_participant_other_id, v_project_id, v_group_id, 'Other Participant', 'N3', 'none');
  insert into public.team_works_manuals (id, project_id, no, title)
  values (v_manual_id, v_project_id, 1, 'Manual 1');
  insert into public.team_works_schedule_rules (id, project_id, partner_member_id, weekday, start_time, duration_min)
  values (v_rule_id, v_project_id, v_actor_member_id, 1, '10:00', 60);
  insert into public.team_works_op_sessions (id, project_id, generated_from_rule_id, partner_member_id, session_date, start_time, duration_min)
  values (v_session_assigned_id, v_project_id, v_rule_id, v_actor_member_id, '2026-08-03', '10:00', 60),
         (v_session_other_id, v_project_id, null, v_owner_member_id, '2026-08-04', '10:00', 60);
  insert into public.team_works_session_roster (id, session_id, project_id, participant_id, order_index)
  values (v_roster_assigned_id, v_session_assigned_id, v_project_id, v_participant_assigned_id, 1),
         (v_roster_other_id, v_session_other_id, v_project_id, v_participant_other_id, 1);
  insert into public.team_works_holidays (id, organization_id, project_id, holiday_date, memo)
  values (v_org_holiday_id, v_organization_id, null, '2026-08-10', 'org-wide holiday'),
         (v_project_holiday_id, v_organization_id, v_project_id, '2026-08-11', 'project holiday');

  -- OWNER: full visibility + can write.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_participants where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'owner participant visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_manuals where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'owner manual visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_op_sessions where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'owner session visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_session_roster where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'owner roster visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_holidays where organization_id = v_organization_id;
  if visible_count <> 2 then raise exception 'owner holiday visibility mismatch: %', visible_count; end if;
  update public.team_works_participants set memo = 'staff note' where id = v_participant_assigned_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then raise exception 'owner could not update participant'; end if;
  execute 'reset role';

  -- MANAGER (non-owner-column member with role=manager): staff-equivalent full visibility.
  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_participants where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'manager participant visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_op_sessions where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'manager session visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_manuals where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'manager manual visibility mismatch: %', visible_count; end if;
  execute 'reset role';

  -- Flip the actor to worker (partner) for the partner-scoped phase.
  update public.team_works_organization_members set role = 'worker' where id = v_actor_member_id;
  update public.team_works_project_members set project_role = 'worker'
  where project_id = v_project_id and organization_member_id = v_actor_member_id;

  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_participants where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'worker participant visibility mismatch (must be assigned-only): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_participants where id = v_participant_assigned_id;
  if visible_count <> 1 then raise exception 'worker cannot see own assigned participant'; end if;
  select count(*) into visible_count from public.team_works_participants where id = v_participant_other_id;
  if visible_count <> 0 then raise exception 'worker saw participant outside their assigned sessions'; end if;
  select count(*) into visible_count from public.team_works_op_sessions where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'worker session visibility mismatch (must be own only): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_session_roster where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'worker roster visibility mismatch (must be own session only): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_manuals where project_id = v_project_id;
  if visible_count <> 1 then raise exception 'worker manual visibility mismatch (worker should see manuals): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_holidays where organization_id = v_organization_id;
  if visible_count <> 2 then raise exception 'worker holiday visibility mismatch: %', visible_count; end if;
  update public.team_works_participants set memo = 'worker edit attempt' where id = v_participant_assigned_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'worker updated participant'; end if;
  update public.team_works_session_roster set attendance_status = 'present' where id = v_roster_assigned_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'worker updated roster attendance directly'; end if;
  execute 'reset role';

  -- Flip the actor to client (school) for the client-scoped phase.
  update public.team_works_organization_members set role = 'client_user' where id = v_actor_member_id;
  update public.team_works_project_members set project_role = 'client'
  where project_id = v_project_id and organization_member_id = v_actor_member_id;

  perform set_config('request.jwt.claims', json_build_object('sub', actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into visible_count from public.team_works_participants where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'client participant visibility mismatch (must be whole roster): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_op_sessions where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'client session visibility mismatch (must be whole schedule): %', visible_count; end if;
  select count(*) into visible_count from public.team_works_session_roster where project_id = v_project_id;
  if visible_count <> 2 then raise exception 'client roster visibility mismatch: %', visible_count; end if;
  select count(*) into visible_count from public.team_works_manuals where project_id = v_project_id;
  if visible_count <> 0 then raise exception 'client saw internal manuals (must be hidden): %', visible_count; end if;
  begin
    insert into public.team_works_manuals (project_id, no, title) values (v_project_id, 2, 'client-inserted manual');
    raise exception 'client inserted a manual';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- ANON: no access at all.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  begin
    perform 1 from public.team_works_participants limit 1;
    raise exception 'anon read Team Works participants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.team_works_manuals limit 1;
    raise exception 'anon read Team Works manuals';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise notice 'Team Works R1 operations RLS verification passed; transaction will roll back';
end
$$;

rollback;
