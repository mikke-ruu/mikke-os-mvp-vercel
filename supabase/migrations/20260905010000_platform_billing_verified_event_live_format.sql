-- Keep the verified-payment RPC aligned with the persisted provider identity
-- constraints. Stripe event and Checkout Session IDs have the same shape in
-- test and live mode; the environment is enforced by the server-side adapter.

set statement_timeout = '60s';
set lock_timeout = '5s';

alter table platform_billing_private.verified_provider_events
  drop constraint if exists verified_provider_events_provider_event_id_check;
alter table platform_billing_private.verified_provider_events
  add constraint verified_provider_events_provider_event_id_check
  check (provider_event_id ~ '^evt_[A-Za-z0-9]+$');

do $migration$
declare
  v_signature regprocedure :=
    'public.platform_billing_verified_payment_grant(uuid,uuid,text,text,text,timestamptz)'::regprocedure;
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_updated := replace(
    v_definition,
    $needle$p_provider_event_id !~ '^evt_test_[A-Za-z0-9]+$'$needle$,
    $replacement$p_provider_event_id !~ '^evt_[A-Za-z0-9]+$'$replacement$
  );
  v_updated := replace(
    v_updated,
    $needle$p_provider_session_id !~ '^cs_test_[A-Za-z0-9]+$'$needle$,
    $replacement$p_provider_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'$replacement$
  );

  if v_updated = v_definition
    or position($needle$^evt_test_[A-Za-z0-9]+$$needle$ in v_updated) > 0
    or position($needle$^cs_test_[A-Za-z0-9]+$$needle$ in v_updated) > 0 then
    raise exception 'platform_billing_verified_payment_grant_signature_drift';
  end if;

  execute v_updated;
end;
$migration$;

comment on function public.platform_billing_verified_payment_grant(
  uuid, uuid, text, text, text, timestamptz
) is 'Service-only verified payment grant. Accepts Stripe test/live identifier shapes; application runtime pins the configured Stripe mode.';
