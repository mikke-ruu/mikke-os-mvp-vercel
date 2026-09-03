begin;
do $$ begin
 if has_function_privilege('authenticated','private.academy_anonymize_ended_headquarters_at(uuid,timestamptz)','execute') then raise exception 'academy worker ACL'; end if;
 if has_function_privilege('authenticated','public.community_apply_platform_retention_anonymization(uuid,timestamptz)','execute') then raise exception 'community worker ACL'; end if;
 if not has_function_privilege('service_role','public.community_apply_platform_retention_anonymization(uuid,timestamptz)','execute') then raise exception 'community service ACL'; end if;
end $$;
-- The isolated behavior harness composes old-ended + new-current fixtures for
-- both products. Expected result is NOT_DUE with both immutable old ledgers and
-- all app data unchanged; unique latest-ended remains anonymizable.
select 'platform_retention_recontract_workers_test_ok' result;
rollback;
