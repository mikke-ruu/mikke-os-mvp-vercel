-- Team Works P8-c invite, collaboration, and actor visibility verification.
-- Requires two existing profiles and rolls all fixtures back.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_actor_user_id uuid;
  v_actor_email text;
  v_organization_id uuid := gen_random_uuid();
  v_owner_member_id uuid := gen_random_uuid();
  v_actor_member_id uuid := gen_random_uuid();
  v_wrong_member_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_task_id uuid := gen_random_uuid();
  v_invite_id uuid := gen_random_uuid();
  v_wrong_invite_id uuid := gen_random_uuid();
  v_client_form_id uuid := gen_random_uuid();
  v_worker_form_id uuid := gen_random_uuid();
  v_deliverable_id uuid := gen_random_uuid();
  v_count integer;
begin
  if has_table_privilege('anon', 'public.team_works_member_invites', 'select')
    or has_table_privilege('authenticated', 'public.team_works_member_invites', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_form_submissions', 'delete')
    or has_table_privilege('authenticated', 'public.team_works_project_comments', 'delete') then
    raise exception 'P8-c grants are broader than intended';
  end if;

  select p.user_id into v_owner_user_id from public.profiles p order by p.created_at, p.id limit 1;
  select p.user_id, u.email into v_actor_user_id, v_actor_email
  from public.profiles p join auth.users u on u.id = p.user_id
  where p.user_id <> v_owner_user_id and u.email is not null
  order by p.created_at, p.id limit 1;
  if v_owner_user_id is null or v_actor_user_id is null then
    raise exception 'P8-c verification requires two profiled auth users';
  end if;

  insert into public.team_works_organizations(id, owner_user_id, name)
  values (v_organization_id, v_owner_user_id, 'P8-c organization');
  insert into public.team_works_organization_members(id, organization_id, user_id, display_name, role, status)
  values (v_owner_member_id, v_organization_id, v_owner_user_id, 'Owner', 'owner', 'active');
  insert into public.team_works_projects(id, organization_id, title, status, client_visible)
  values (v_project_id, v_organization_id, 'P8-c project', 'active', true);
  insert into public.team_works_project_members(project_id, organization_id, organization_member_id, project_role)
  values (v_project_id, v_organization_id, v_owner_member_id, 'owner');
  insert into public.team_works_project_tasks(id, project_id, title, status, client_visible)
  values (v_task_id, v_project_id, 'P8-c task', 'in_progress', true);
  insert into public.team_works_member_invites(id, organization_id, project_id, email, role, created_by_user_id)
  values
    (v_invite_id, v_organization_id, v_project_id, v_actor_email, 'client_user', v_owner_user_id),
    (v_wrong_invite_id, v_organization_id, v_project_id, 'not-' || v_actor_email, 'client_user', v_owner_user_id);
  insert into public.team_works_project_forms(id, project_id, task_id, name, input_actor, client_visible, fields)
  values
    (v_client_form_id, v_project_id, v_task_id, 'Client form', 'client', true, '[{"id":"answer","type":"short_text"}]'),
    (v_worker_form_id, v_project_id, v_task_id, 'Worker form', 'worker', false, '[{"id":"report","type":"long_text"}]');
  insert into public.team_works_project_deliverables(id, project_id, task_id, title, deliverable_type, status, client_visible)
  values (v_deliverable_id, v_project_id, v_task_id, 'Client review', 'url', 'client_review', true);
  insert into public.team_works_project_comments(project_id, task_id, deliverable_id, author_member_id, audience, body)
  values
    (v_project_id, v_task_id, null, v_owner_member_id, 'internal', 'internal comment'),
    (v_project_id, v_task_id, v_deliverable_id, v_owner_member_id, 'client', 'client comment');

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into v_count from public.team_works_member_invites where id = v_invite_id;
  if v_count <> 0 then raise exception 'recipient enumerated invite row'; end if;
  begin
    insert into public.team_works_organization_members(
      id, organization_id, user_id, display_name, role, status, invite_id
    ) values (
      v_wrong_member_id, v_organization_id, v_actor_user_id, 'Wrong recipient', 'client_user', 'active', v_wrong_invite_id
    );
    raise exception 'mismatched email accepted invite';
  exception when insufficient_privilege then null;
  end;
  insert into public.team_works_organization_members(
    id, organization_id, user_id, display_name, role, status, invite_id
  ) values (
    v_actor_member_id, v_organization_id, v_actor_user_id, 'Invited client', 'client_user', 'active', v_invite_id
  );
  select count(*) into v_count from public.team_works_project_forms where project_id = v_project_id;
  if v_count <> 1 then raise exception 'client form visibility mismatch: %', v_count; end if;
  insert into public.team_works_form_submissions(project_id, form_id, submitted_by_member_id, answers, status)
  values (v_project_id, v_client_form_id, v_actor_member_id, '{"answer":"accepted"}', 'submitted');
  begin
    insert into public.team_works_form_submissions(project_id, form_id, submitted_by_member_id, answers)
    values (v_project_id, v_worker_form_id, v_actor_member_id, '{"report":"forbidden"}');
    raise exception 'client submitted worker form';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_count from public.team_works_project_deliverables where id = v_deliverable_id;
  if v_count <> 1 then raise exception 'client deliverable visibility mismatch'; end if;
  select count(*) into v_count from public.team_works_project_comments where project_id = v_project_id;
  if v_count <> 1 then raise exception 'client comment visibility mismatch: %', v_count; end if;

  execute 'reset role';
  select count(*) into v_count from public.team_works_member_invites
  where id = v_invite_id and status = 'accepted' and accepted_by_user_id = v_actor_user_id;
  if v_count <> 1 then raise exception 'invite acceptance was not recorded'; end if;
  select count(*) into v_count from public.team_works_project_members
  where project_id = v_project_id and organization_member_id = v_actor_member_id and project_role = 'client';
  if v_count <> 1 then raise exception 'invite did not create client project membership'; end if;

  update public.team_works_organization_members set role = 'worker' where id = v_actor_member_id;
  update public.team_works_project_members set project_role = 'worker'
  where project_id = v_project_id and organization_member_id = v_actor_member_id;
  update public.team_works_project_tasks set assignee_member_id = v_actor_member_id where id = v_task_id;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.team_works_project_forms where project_id = v_project_id;
  if v_count <> 1 then raise exception 'worker form visibility mismatch: %', v_count; end if;
  select count(*) into v_count from public.team_works_project_comments where project_id = v_project_id;
  if v_count <> 2 then raise exception 'worker comment visibility mismatch: %', v_count; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  begin
    perform 1 from public.team_works_project_forms limit 1;
    raise exception 'anon read Team Works forms';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise notice 'Team Works P8-c collaboration verification passed; transaction will roll back';
end
$$;

rollback;
