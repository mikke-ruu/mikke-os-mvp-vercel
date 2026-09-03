-- Synthetic isolated Postgres only. Caller owns BEGIN/ROLLBACK.
-- Prerequisite: checkout ledger migration, then creation entitlement migration.

create function pg_temp.creation_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'creation entitlement assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.creation_denied(statement text, code text, message text default null)
returns void language plpgsql as $$
declare
  actual_code text;
  actual_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate, actual_message = message_text;
  end;
  if actual_code is distinct from code
    or (message is not null and actual_message is distinct from message) then
    raise exception 'expected % / %, got % / %', code, message, actual_code, actual_message;
  end if;
end;
$$;

insert into auth.users (id, is_anonymous) values
  ('a9020000-0000-4000-8000-000000000001', false),
  ('a9020000-0000-4000-8000-000000000002', false),
  ('a9020000-0000-4000-8000-000000000003', true);

do $$
declare
  role_name text;
  function_row record;
begin
  perform pg_temp.creation_assert(
    (select relrowsecurity from pg_class where oid = 'platform_billing_private.creation_entitlements'::regclass),
    'creation table RLS'
  );
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.creation_assert(
      not has_table_privilege(
        role_name,
        'platform_billing_private.creation_entitlements',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
      ),
      'creation table private ' || role_name
    );
  end loop;

  for function_row in
    select p.oid, p.proname, p.proconfig, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'platform_billing_creation_entitlement_grant',
        'platform_billing_creation_status'
      )
  loop
    perform pg_temp.creation_assert(
      function_row.prosecdef and function_row.proconfig @> array['search_path=""'],
      'definer and empty search_path ' || function_row.proname
    );
    perform pg_temp.creation_assert(
      not has_function_privilege('anon', function_row.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
      and has_function_privilege('service_role', function_row.oid, 'EXECUTE'),
      'service-only RPC ' || function_row.proname
    );
  end loop;
end;
$$;

set local role anon;
select pg_temp.creation_denied(
  $q$select public.platform_billing_creation_status('a9020000-0000-4000-8000-000000000001', 'community_platform', null)$q$,
  '42501'
);
select pg_temp.creation_denied(
  $q$select * from platform_billing_private.creation_entitlements$q$,
  '42501'
);
reset role;

set local role authenticated;
select pg_temp.creation_denied(
  $q$select public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000001', 'community_platform', 'starter',
    'verified_trial', 'b9020000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp() + interval '30 days',
    'c9020000-0000-4000-8000-000000000001'
  )$q$,
  '42501'
);
reset role;

set local role service_role;
select pg_temp.creation_denied(
  $q$select * from platform_billing_private.creation_entitlements$q$,
  '42501'
);
select pg_temp.creation_denied(
  $q$select public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000003', 'community_platform', 'starter',
    'verified_trial', 'b9020000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp() + interval '30 days',
    'c9020000-0000-4000-8000-000000000002'
  )$q$,
  '42501',
  'PLATFORM_BILLING_FORBIDDEN'
);

select set_config(
  'test.creation_grant',
  public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000001',
    'community_platform',
    'starter',
    'verified_trial',
    'b9020000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    'c9020000-0000-4000-8000-000000000001'
  )::text,
  true
);
select pg_temp.creation_assert(
  current_setting('test.creation_grant')::jsonb @> '{"created":true,"state":"available","productKey":"community_platform","planKey":"starter"}'::jsonb,
  'first grant available'
);
select pg_temp.creation_assert(
  public.platform_billing_creation_status(
    'a9020000-0000-4000-8000-000000000001',
    'community_platform',
    null
  )->>'state' = 'available',
  'status projects available'
);

reset role;
select set_config(
  'test.creation_starts_at',
  (select starts_at::text from platform_billing_private.creation_entitlements limit 1),
  true
);
select set_config(
  'test.creation_expires_at',
  (select expires_at::text from platform_billing_private.creation_entitlements limit 1),
  true
);
set local role service_role;

select pg_temp.creation_assert(
  public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000001',
    'community_platform',
    'starter',
    'verified_trial',
    'b9020000-0000-4000-8000-000000000001',
    current_setting('test.creation_starts_at')::timestamptz,
    current_setting('test.creation_expires_at')::timestamptz,
    'c9020000-0000-4000-8000-000000000001'
  )->'created' = 'false'::jsonb,
  'same grant idempotent'
);
select pg_temp.creation_denied(
  $q$select public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000001', 'community_platform', 'standard',
    'verified_trial', 'b9020000-0000-4000-8000-000000000001',
    current_setting('test.creation_starts_at')::timestamptz,
    current_setting('test.creation_expires_at')::timestamptz,
    'c9020000-0000-4000-8000-000000000001'
  )$q$,
  '23505',
  'PLATFORM_BILLING_IDEMPOTENCY_CONFLICT'
);
select pg_temp.creation_denied(
  $q$select public.platform_billing_creation_entitlement_grant(
    'a9020000-0000-4000-8000-000000000001', 'community_platform', 'starter',
    'verified_trial', 'b9020000-0000-4000-8000-000000000099',
    statement_timestamp(), statement_timestamp() + interval '30 days',
    'c9020000-0000-4000-8000-000000000099'
  )$q$,
  '23505',
  'PLATFORM_BILLING_CREATION_ALREADY_AVAILABLE'
);
reset role;

select pg_temp.creation_denied(
  $q$update platform_billing_private.creation_entitlements set actor_user_id = 'a9020000-0000-4000-8000-000000000002'$q$,
  '42501',
  'PLATFORM_BILLING_CREATION_IMMUTABLE'
);
select pg_temp.creation_denied(
  $q$delete from platform_billing_private.creation_entitlements$q$,
  '42501',
  'PLATFORM_BILLING_CREATION_IMMUTABLE'
);
select pg_temp.creation_denied(
  $q$truncate platform_billing_private.creation_entitlements$q$,
  '42501',
  'PLATFORM_BILLING_CREATION_IMMUTABLE'
);

update platform_billing_private.creation_entitlements
set status = 'consumed',
    resource_id = 'd9020000-0000-4000-8000-000000000001',
    consumed_at = statement_timestamp(),
    updated_at = statement_timestamp()
where actor_user_id = 'a9020000-0000-4000-8000-000000000001'
  and product_key = 'community_platform';

set local role service_role;
select pg_temp.creation_assert(
  public.platform_billing_creation_status(
    'a9020000-0000-4000-8000-000000000001',
    'community_platform',
    'd9020000-0000-4000-8000-000000000001'
  ) @> '{"state":"consumed","planKey":"starter","resourceId":"d9020000-0000-4000-8000-000000000001"}'::jsonb,
  'status projects consumed resource'
);
select pg_temp.creation_assert(
  public.platform_billing_creation_status(
    'a9020000-0000-4000-8000-000000000001',
    'community_platform',
    null
  )->>'state' = 'none',
  'consumed grant does not reopen creation'
);
reset role;

select pg_temp.creation_assert(
  (select count(*) = 1 from platform_billing_private.creation_entitlements),
  'one durable entitlement'
);
select 'platform_billing_creation_entitlements_test_ok' as result;
