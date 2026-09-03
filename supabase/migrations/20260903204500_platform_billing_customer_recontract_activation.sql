-- A Stripe Customer may start a later subscription after an immutable earlier
-- subscription ended. Subscription identity remains unique and replay-safe.
alter table platform_billing_private.subscriptions
  drop constraint if exists subscriptions_provider_customer_id_key;
create index if not exists platform_billing_subscription_customer_history_idx
  on platform_billing_private.subscriptions(provider_customer_id,created_at desc,id);

do $recontract$
declare v_definition text; v_old text; v_new text;
begin
 v_definition:=pg_catalog.pg_get_functiondef('public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)'::regprocedure);
 v_definition:=pg_catalog.replace(v_definition,chr(13)||chr(10),chr(10));
 v_old:='where source_attempt_id=p_attempt_id or provider_customer_id=p_provider_customer_id'||chr(10)||'    or provider_subscription_id=p_provider_subscription_id';
 v_new:='where source_attempt_id=p_attempt_id or provider_subscription_id=p_provider_subscription_id';
 if pg_catalog.strpos(v_definition,v_old)=0 then
  raise exception using errcode='55000',message='PLATFORM_BILLING_ACTIVATION_DEFINITION_DRIFT';
 end if;
 v_definition:=pg_catalog.replace(v_definition,v_old,v_new);
 execute v_definition;
end
$recontract$;

revoke all on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz) to service_role;
