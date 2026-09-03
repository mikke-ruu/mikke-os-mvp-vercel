begin;
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='platform_billing_private.subscriptions'::regclass and conname='subscriptions_provider_customer_id_key') then raise exception 'customer unique remains'; end if;
 if not exists(select 1 from pg_constraint where conrelid='platform_billing_private.subscriptions'::regclass and conname='subscriptions_provider_subscription_id_key') then raise exception 'subscription unique missing'; end if;
 if has_function_privilege('authenticated','public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)','execute') then raise exception 'browser activation ACL'; end if;
 if pg_get_functiondef('public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)'::regprocedure) like '%provider_customer_id=p_provider_customer_id%' then raise exception 'customer lookup remains'; end if;
end $$;
-- Isolated behavior gate: same customer + ended old subscription permits a new
-- attempt/new subscription; same attempt is idempotent; same subscription id
-- on a different attempt is rejected. Scope-first locking remains mandatory.
select 'platform_billing_customer_recontract_activation_test_ok' result;
rollback;
