begin;
do $$ begin
 if (select count(*) from platform_billing_private.internal_resource_grants)<>3 then raise exception 'grant count'; end if;
 if (select count(*) from platform_billing_private.internal_resource_grants where purpose='official_operations' and expires_at is null)<>2 then raise exception 'official grants'; end if;
 if (select count(*) from platform_billing_private.internal_resource_grants where purpose='test_only' and expires_at=starts_at+interval '30 days')<>1 then raise exception 'test grant'; end if;
 if has_table_privilege('service_role','platform_billing_private.internal_resource_grants','select') or has_table_privilege('authenticated','platform_billing_private.internal_resource_grants','select') then raise exception 'ledger ACL'; end if;
 if has_function_privilege('authenticated','public.platform_billing_internal_grant_revoke(uuid,uuid,text)','execute') then raise exception 'revoke ACL'; end if;
 if to_regprocedure('public.platform_billing_internal_grant_revoke(uuid,text)') is not null then raise exception 'unsafe revoke signature'; end if;
end $$;
select 'platform_billing_internal_resource_grants_test_ok' result;
rollback;
