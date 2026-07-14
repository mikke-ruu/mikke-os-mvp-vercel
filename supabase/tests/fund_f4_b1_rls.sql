-- Fund F4-b1 production-safe RLS verification.
-- Run as a database administrator after the migration. Every test row is
-- enclosed in one transaction and removed by the final rollback.

begin;

do $$
declare
  owner_a_user_id uuid;
  owner_a_profile_id uuid;
  owner_b_user_id uuid;
  owner_b_profile_id uuid;
  project_a_id uuid;
  project_b_id uuid;
  support_a_id uuid;
  support_b_id uuid;
  visible_count integer;
  affected_count integer;
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  select profiles.user_id, profiles.id
  into owner_a_user_id, owner_a_profile_id
  from public.profiles
  order by profiles.created_at
  limit 1;

  select profiles.user_id, profiles.id
  into owner_b_user_id, owner_b_profile_id
  from public.profiles
  where profiles.user_id <> owner_a_user_id
  order by profiles.created_at
  limit 1;

  if owner_a_user_id is null or owner_b_user_id is null then
    raise exception 'Fund F4-b1 RLS test requires profiles for two different auth users';
  end if;

  insert into public.fund_projects (
    owner_user_id,
    owner_profile_id,
    source_local_id,
    slug,
    title
  )
  values
    (owner_a_user_id, owner_a_profile_id, 'rls-a-' || suffix, 'rls-a-' || suffix, 'F4 RLS owner A'),
    (owner_b_user_id, owner_b_profile_id, 'rls-b-' || suffix, 'rls-b-' || suffix, 'F4 RLS owner B');

  select id into project_a_id
  from public.fund_projects
  where source_local_id = 'rls-a-' || suffix;

  select id into project_b_id
  from public.fund_projects
  where source_local_id = 'rls-b-' || suffix;

  insert into public.fund_supports (
    project_id,
    source_local_id,
    supporter_name,
    supporter_email,
    amount,
    comment
  )
  values
    (project_a_id, 'rls-support-a-' || suffix, 'private A', 'private-a@example.invalid', 1000, 'owner A only'),
    (project_b_id, 'rls-support-b-' || suffix, 'private B', 'private-b@example.invalid', 2000, 'owner B only');

  select id into support_a_id
  from public.fund_supports
  where source_local_id = 'rls-support-a-' || suffix;

  select id into support_b_id
  from public.fund_supports
  where source_local_id = 'rls-support-b-' || suffix;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*) into visible_count
  from public.fund_projects
  where id in (project_a_id, project_b_id);
  if visible_count <> 0 then
    raise exception 'anon could read Fund projects';
  end if;

  select count(*) into visible_count
  from public.fund_supports
  where id in (support_a_id, support_b_id);
  if visible_count <> 0 then
    raise exception 'anon could read owner-private Fund supports';
  end if;

  execute 'reset role';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_a_user_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', owner_a_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count
  from public.fund_projects
  where id in (project_a_id, project_b_id);
  if visible_count <> 1 then
    raise exception 'owner A project visibility mismatch: %', visible_count;
  end if;

  select count(*) into visible_count
  from public.fund_supports
  where id in (support_a_id, support_b_id);
  if visible_count <> 1 then
    raise exception 'owner A support visibility mismatch: %', visible_count;
  end if;

  update public.fund_projects
  set title = 'must not change'
  where id = project_b_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then
    raise exception 'owner A updated owner B project';
  end if;

  update public.fund_supports
  set comment = 'must not change'
  where id = support_b_id;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then
    raise exception 'owner A updated owner B support';
  end if;

  begin
    insert into public.fund_projects (
      owner_user_id,
      owner_profile_id,
      slug,
      title
    ) values (
      owner_b_user_id,
      owner_b_profile_id,
      'rls-forbidden-' || suffix,
      'must be rejected'
    );
    raise exception 'owner A inserted a project for owner B';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.fund_supports (
      project_id,
      supporter_name
    ) values (
      project_b_id,
      'must be rejected'
    );
    raise exception 'owner A inserted a support into owner B project';
  exception
    when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_b_user_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', owner_b_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count
  from public.fund_projects
  where id in (project_a_id, project_b_id);
  if visible_count <> 1 then
    raise exception 'owner B project visibility mismatch: %', visible_count;
  end if;

  select count(*) into visible_count
  from public.fund_supports
  where id in (support_a_id, support_b_id);
  if visible_count <> 1 then
    raise exception 'owner B support visibility mismatch: %', visible_count;
  end if;

  execute 'reset role';
  raise notice 'Fund F4-b1 RLS verification passed; transaction will roll back';
end;
$$;

rollback;
