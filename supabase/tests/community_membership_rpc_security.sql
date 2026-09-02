begin;

do $$
declare
  v_names text[] := array[
    'community_invite_by_mikke_id',
    'community_leave',
    'community_submit_join_application',
    'community_review_join_application'
  ];
  v_name text;
  v_config text[];
begin
  foreach v_name in array v_names loop
    select procedure.proconfig
      into v_config
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_name;

    if v_config is distinct from array['search_path=""']::text[] then
      raise exception 'unsafe search_path for %: %', v_name, v_config;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.community_invite_by_mikke_id(uuid,text,text,timestamptz)',
    'execute'
  ) or has_function_privilege('anon', 'public.community_leave(uuid)', 'execute')
    or has_function_privilege(
      'anon',
      'public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.community_review_join_application(uuid,text,text)',
      'execute'
    ) then
    raise exception 'anon must not execute Community membership RPCs';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_invite_by_mikke_id(uuid,text,text,timestamptz)',
    'execute'
  ) or not has_function_privilege('authenticated', 'public.community_leave(uuid)', 'execute')
    or not has_function_privilege(
      'authenticated',
      'public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.community_review_join_application(uuid,text,text)',
      'execute'
    ) then
    raise exception 'authenticated must execute Community membership RPCs';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"c9020000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
set local role authenticated;

do $$
begin
  perform public.community_invite_by_mikke_id(
    'c9020000-0000-4000-8000-000000000010'::uuid,
    'anonymous-user',
    null,
    null
  );
  raise exception 'anonymous Auth invite unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_leave('c9020000-0000-4000-8000-000000000010'::uuid);
  raise exception 'anonymous Auth leave unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_submit_join_application(
    'c9020000-0000-4000-8000-000000000010'::uuid,
    'Anonymous',
    'Anonymous User',
    '09000000000',
    null,
    true,
    true,
    true
  );
  raise exception 'anonymous Auth application unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.community_review_join_application(
    'c9020000-0000-4000-8000-000000000020'::uuid,
    'approved',
    null
  );
  raise exception 'anonymous Auth review unexpectedly succeeded';
exception
  when sqlstate '42501' then
    if sqlerrm <> 'COMMUNITY_ANONYMOUS_DENIED' then
      raise;
    end if;
end;
$$;

reset role;
select 'community_membership_rpc_security_test_ok';

rollback;
