-- Run only on an isolated DB with the candidate migration. No fixture/customer data.
begin;
set local statement_timeout='10s';
do $$
begin
  if exists(select 1 from academy_publication_private.policies where enabled) then
    raise exception 'test_requires_disabled_rollout';
  end if;
  if has_table_privilege('authenticated','academy_publication_private.enrollments','INSERT') then
    raise exception 'enrollment_direct_write_exposed';
  end if;
  if has_table_privilege('authenticated','academy_publication_private.publication_permits','INSERT') then
    raise exception 'publication_permit_exposed';
  end if;
  if has_function_privilege('anon','public.academy_first_publication_command(uuid,text,uuid,uuid,boolean,text,bigint)','EXECUTE') then
    raise exception 'anonymous_rpc_exposed';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='academy_publication_private' and c.relkind='r' and not c.relrowsecurity) then
    raise exception 'missing_rls';
  end if;
end $$;
-- End-to-end cases still required: two owners/HQs, duplicate concurrent publish,
-- forced course-update failure rolls back ledger/outbox, expired/revoked quote,
-- editor refusal, legacy owner refusal, cancellation boundary and direct PATCH.
rollback;
