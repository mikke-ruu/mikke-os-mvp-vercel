-- Provider readiness is written only by a trusted integration, never a client.
-- No connections are seeded; production Connect synchronization remains separate.
create table academy2_access.payment_provider_connections (
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 provider text not null check(provider in('local_simulator','stripe_connect')),
 account_reference text not null,
 charges_enabled boolean not null default false,payouts_enabled boolean not null default false,
 verified_at timestamptz not null,valid_until timestamptz not null,
 check(isfinite(verified_at) and isfinite(valid_until) and valid_until>verified_at),
 check((provider='local_simulator' and account_reference like 'local:academy2:%') or (provider='stripe_connect' and account_reference ~ '^acct_[A-Za-z0-9]+$'))
);
create table academy2_access.opening_checkouts (
 id uuid primary key,invoice_id uuid not null unique references academy2_access.opening_license_invoices(id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 requested_by uuid not null references auth.users(id),provider text not null check(provider='local_simulator'),
 account_reference text not null,amount_minor bigint not null check(amount_minor>0),currency text not null check(currency='JPY'),
 created_at timestamptz not null default clock_timestamp()
);
create table academy2_access.opening_settlements (
 checkout_id uuid primary key references academy2_access.opening_checkouts(id),
 invoice_id uuid not null unique references academy2_access.opening_license_invoices(id),
 provider text not null check(provider='local_simulator'),receipt_reference text not null unique,
 amount_minor bigint not null check(amount_minor>0),currency text not null check(currency='JPY'),
 settled_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.payment_provider_connections enable row level security;
alter table academy2_access.opening_checkouts enable row level security;
alter table academy2_access.opening_settlements enable row level security;
revoke all on academy2_access.payment_provider_connections,academy2_access.opening_checkouts,academy2_access.opening_settlements from public,anon,authenticated,service_role;
create trigger academy2_opening_checkout_immutable before update or delete on academy2_access.opening_checkouts for each row execute function academy2_access.opening_immutable();
create trigger academy2_opening_settlement_immutable before update or delete on academy2_access.opening_settlements for each row execute function academy2_access.opening_immutable();

create function academy2_access.payment_provider_ready(p_hq uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy2_access.payment_provider_connections p join academy2_access.tenants t on t.headquarters_id=p.headquarters_id
 where p.headquarters_id=p_hq and t.runtime_enabled and p.charges_enabled and p.verified_at<=now() and p.valid_until>now())
$$;
create function academy2_access.opening_checkout_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c academy2_access.opening_checkouts;i academy2_access.opening_license_invoices;title text;
begin
 select * into c from academy2_access.opening_checkouts where id=p_id;
 select * into i from academy2_access.opening_license_invoices where id=c.invoice_id;
 if auth.uid() is null or c.id is null or c.requested_by<>auth.uid() or i.instructor_user_id<>auth.uid()
 or c.headquarters_id<>i.headquarters_id or not exists(select 1 from academy2_access.tenants where headquarters_id=c.headquarters_id and runtime_enabled) then
  raise exception 'academy2_checkout_forbidden' using errcode='42501';end if;
 select configuration->>'title' into title from academy2_access.sales_plan_draft_revisions where draft_id=i.plan_id and revision=i.plan_revision;
 return jsonb_build_object('id',c.id,'application_id',i.application_id,'provider',c.provider,'amount_minor',c.amount_minor,'currency',c.currency,'title',title,
  'status',i.status,'paid_at',i.paid_at,'can_pay',i.status='unpaid' and academy2_access.instructor_operation_authorized(i.application_id) and academy2_access.payment_provider_ready(i.headquarters_id));
end $$;
create function academy2_access.opening_checkout_request(p_application uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i academy2_access.opening_license_invoices;c academy2_access.opening_checkouts;p academy2_access.payment_provider_connections;
begin
 if p_request is null or not coalesce(academy2_access.instructor_operation_authorized(p_application),false) then raise exception 'academy2_checkout_forbidden' using errcode='42501';end if;
 select * into i from academy2_access.opening_license_invoices where application_id=p_application for update;
 if i.id is null or i.instructor_user_id is distinct from auth.uid() then raise exception 'academy2_invoice_unavailable' using errcode='42501';end if;
 select * into p from academy2_access.payment_provider_connections where headquarters_id=i.headquarters_id;
 -- This adapter never silently substitutes simulation for Stripe.
 if p.provider is distinct from 'local_simulator' or not academy2_access.payment_provider_ready(i.headquarters_id) then raise exception 'academy2_payment_provider_not_connected' using errcode='55000';end if;
 select * into c from academy2_access.opening_checkouts where id=p_request;
 if found and (c.invoice_id<>i.id or c.requested_by<>auth.uid()) then raise exception 'academy2_checkout_conflict' using errcode='PT409';end if;
 select * into c from academy2_access.opening_checkouts where invoice_id=i.id;
 if not found then
  if i.status<>'unpaid' then raise exception 'academy2_payment_state_requires_review' using errcode='PT409';end if;
  insert into academy2_access.opening_checkouts(id,invoice_id,headquarters_id,requested_by,provider,account_reference,amount_minor,currency)
   values(p_request,i.id,i.headquarters_id,auth.uid(),p.provider,p.account_reference,i.amount_minor,i.currency) returning * into c;
 end if;
 return academy2_access.opening_checkout_view(c.id);
end $$;
create function academy2_access.settle_local_opening_checkout(p_id uuid,p_receipt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c academy2_access.opening_checkouts;i academy2_access.opening_license_invoices;s academy2_access.opening_settlements;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'academy2_provider_only' using errcode='42501';end if;
 select * into c from academy2_access.opening_checkouts where id=p_id for update;
 select * into i from academy2_access.opening_license_invoices where id=c.invoice_id for update;
 if c.id is null or c.provider<>'local_simulator' or p_receipt is distinct from ('local-checkout:'||p_id::text)
 or i.headquarters_id<>c.headquarters_id or i.instructor_user_id<>c.requested_by or i.amount_minor<>c.amount_minor or i.currency<>c.currency
 or not exists(select 1 from academy2_access.payment_provider_connections p where p.headquarters_id=c.headquarters_id and p.provider=c.provider and p.account_reference=c.account_reference)
 or not academy2_access.payment_provider_ready(c.headquarters_id) then raise exception 'academy2_local_settlement_forbidden' using errcode='42501';end if;
 select * into s from academy2_access.opening_settlements where checkout_id=p_id;
 if found then
  if s.receipt_reference<>p_receipt or s.invoice_id<>i.id or i.status<>'paid' then raise exception 'academy2_settlement_conflict' using errcode='PT409';end if;
  return jsonb_build_object('id',c.id,'status','paid','provider','local_simulator');
 end if;
 if i.status<>'unpaid' then raise exception 'academy2_payment_state_requires_review' using errcode='PT409';end if;
 insert into academy2_access.opening_settlements(checkout_id,invoice_id,provider,receipt_reference,amount_minor,currency)
  values(c.id,i.id,c.provider,p_receipt,c.amount_minor,c.currency) returning * into s;
 update academy2_access.opening_license_invoices set status='paid',paid_at=s.settled_at where id=i.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(i.headquarters_id,c.requested_by,'opening_license.local_payment_verified',i.id);
 return jsonb_build_object('id',c.id,'status','paid','provider','local_simulator');
end $$;
revoke all on function academy2_access.payment_provider_ready(uuid),academy2_access.opening_checkout_view(uuid),academy2_access.opening_checkout_request(uuid,uuid),academy2_access.settle_local_opening_checkout(uuid,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.opening_checkout_view(uuid),academy2_access.opening_checkout_request(uuid,uuid) to authenticated;
grant execute on function academy2_access.settle_local_opening_checkout(uuid,text) to service_role;
grant usage on schema academy2_access to service_role;
create function public.academy2_opening_checkout(p_checkout_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.opening_checkout_view(p_checkout_id)$$;
create function public.academy2_request_opening_checkout(p_application_id uuid,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.opening_checkout_request(p_application_id,p_request_id)$$;
create function public.academy2_settle_local_opening_checkout(p_checkout_id uuid,p_receipt_reference text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.settle_local_opening_checkout(p_checkout_id,p_receipt_reference)$$;
revoke all on function public.academy2_opening_checkout(uuid),public.academy2_request_opening_checkout(uuid,uuid),public.academy2_settle_local_opening_checkout(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.academy2_opening_checkout(uuid),public.academy2_request_opening_checkout(uuid,uuid) to authenticated;
grant execute on function public.academy2_settle_local_opening_checkout(uuid,text) to service_role;
notify pgrst,'reload schema';
