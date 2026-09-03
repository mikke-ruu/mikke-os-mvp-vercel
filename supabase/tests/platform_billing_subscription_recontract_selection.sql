begin;
-- Runtime fixtures are composed by the isolated runner from the existing
-- checkout/subscription tests. This gate fixes the mandatory catalogue and
-- behavioural markers without duplicating production SQL.
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='platform_billing_private.attempts'::regclass and conname='attempts_scope_id_key') then raise exception 'scope unique remains'; end if;
 if not exists(select 1 from pg_indexes where schemaname='platform_billing_private' and indexname='platform_billing_attempt_scope_idx') then raise exception 'scope index missing'; end if;
 if has_function_privilege('anon','platform_billing_private.resource_access_window(text,uuid,timestamptz)','execute') or has_function_privilege('authenticated','platform_billing_private.resource_access_window(text,uuid,timestamptz)','execute') then raise exception 'private ACL'; end if;
 if has_function_privilege('service_role','platform_billing_private.resource_subscription_select(uuid,text,uuid,timestamptz)','execute') then raise exception 'selector service ACL'; end if;
 if has_function_privilege('authenticated','public.platform_billing_attempt_reserve(uuid,text,jsonb)','execute') then raise exception 'reserve browser ACL'; end if;
 if has_function_privilege('authenticated','public.platform_billing_status_get(uuid,text,uuid)','execute') or has_function_privilege('authenticated','public.platform_billing_portal_context(uuid,text,uuid)','execute') then raise exception 'status browser ACL'; end if;
end $$;
select 'platform_billing_subscription_recontract_selection_test_ok' result;
rollback;
