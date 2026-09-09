begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

insert into auth.users(id,email,is_anonymous,raw_user_meta_data,raw_app_meta_data)
values ('cb090909-0000-4000-8000-000000000001','community-bind-test@example.invalid',false,'{}','{}');

create function pg_temp.fail_community_create_child() returns trigger language plpgsql as $$
begin
  if current_setting('community_test.fail_phase',true) = tg_table_name then
    raise exception 'LOCAL_CREATE_CHILD_FAILURE';
  end if;
  return new;
end;
$$;
create trigger community_test_membership_failure before insert on public.community_memberships
for each row execute function pg_temp.fail_community_create_child();
create trigger community_test_room_failure before insert on public.community_rooms
for each row execute function pg_temp.fail_community_create_child();
create trigger community_test_parent_failure before insert on public.community_communities
for each row execute function pg_temp.fail_community_create_child();
create trigger community_test_safety_failure before insert on public.community_safety_settings
for each row execute function pg_temp.fail_community_create_child();

do $$
declare
  v_actor uuid := 'cb090909-0000-4000-8000-000000000001';
  v_created public.community_communities;
  v_pending jsonb;
  v_after jsonb;
  v_phase text;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated','is_anonymous',false)::text,true);
  set local role service_role;
  perform public.platform_billing_community_trial_start(v_actor,'cb090909-0000-4000-8000-000000000011');
  reset role;
  set local role authenticated;
  v_created := public.community_create_with_platform_entitlement('Local bind success','local-bind-success',null,'Test owner');
  reset role;
  if (select count(*) from public.community_memberships where community_id=v_created.id) <> 1
    or (select count(*) from public.community_rooms where community_id=v_created.id) <> 3
    or not exists(select 1 from platform_billing_private.creation_entitlements
      where actor_user_id=v_actor and resource_id=v_created.id and status='consumed') then
    raise exception 'bound creation did not complete all child rows';
  end if;
  if not community_private.community_owner_write_allowed(v_created.id,clock_timestamp()) then
    raise exception 'new trial owner must pass real retention guard';
  end if;
  set local role service_role;
  perform public.platform_billing_community_trial_start(v_actor,'cb090909-0000-4000-8000-000000000012');
  reset role;
  select to_jsonb(e) into strict v_pending from platform_billing_private.creation_entitlements e
    where actor_user_id=v_actor and status='available' and resource_id is null;
  foreach v_phase in array array['community_communities','community_safety_settings','community_memberships','community_rooms'] loop
    perform set_config('community_test.fail_phase',v_phase,true);
    begin
      set local role authenticated;
      perform public.community_create_with_platform_entitlement('Local bind failure','local-bind-failure',null,'Test owner');
      reset role;
      raise exception 'expected child failure did not occur';
    exception when others then
      reset role;
      if sqlerrm <> 'LOCAL_CREATE_CHILD_FAILURE' then raise; end if;
    end;
    select to_jsonb(e) into strict v_after from platform_billing_private.creation_entitlements e
      where id=(v_pending->>'id')::uuid;
    if v_after is distinct from v_pending then raise exception 'failed creation mutated grant'; end if;
    if exists(select 1 from public.community_communities where slug='local-bind-failure') then
      raise exception 'failed creation left a Community';
    end if;
  end loop;
  perform set_config('community_test.fail_phase','',true);
  set local role authenticated;
  perform public.community_create_with_platform_entitlement('Local second success','local-bind-second',null,'Test owner');
  reset role;
  if (select count(*) from public.community_communities where owner_user_id=v_actor) <> 2
    or (select count(*) from platform_billing_private.creation_entitlements where actor_user_id=v_actor and status='consumed') <> 2 then
    raise exception 'two independent Communities must consume two grants';
  end if;
  begin
    set local role authenticated;
    perform public.community_create_with_platform_entitlement('Local forbidden third','local-bind-third',null,'Test owner');
    reset role;
    raise exception 'missing grant unexpectedly accepted';
  exception when others then
    reset role;
    if sqlerrm <> 'COMMUNITY_CREATE_ENTITLEMENT_CONFLICT' then raise; end if;
  end;
end;
$$;
select 'community_creation_bind_before_children_test_ok';
rollback;
