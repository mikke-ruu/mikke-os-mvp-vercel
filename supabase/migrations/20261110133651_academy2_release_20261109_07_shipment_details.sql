-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-shipment-details.local.sql
-- LOCAL ONLY. Add presentation metadata while delegating every shipment mutation
-- to the existing scoped, revisioned, audited headquarters command.
begin;
create table academy2_access.hq_shipment_details (
 application_id uuid primary key references public.academy_offering_applications(id),
 carrier text not null check(char_length(carrier) between 1 and 100),
 shipped_date date not null
);
alter table academy2_access.hq_shipment_details enable row level security;
revoke all on academy2_access.hq_shipment_details from public,anon,authenticated,service_role;
create table academy2_access.hq_shipment_detail_commands (
 request_id uuid primary key,
 headquarters_id uuid not null,
 application_id uuid not null,
 actor_id uuid not null,
 expected_revision integer not null,
 input jsonb not null,
 created_at timestamptz not null default now()
);
alter table academy2_access.hq_shipment_detail_commands enable row level security;
revoke all on academy2_access.hq_shipment_detail_commands from public,anon,authenticated,service_role;
create function public.academy2_hq_application_with_shipping(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; shipment academy2_access.hq_shipment_details;
begin
 result:=public.academy2_hq_application(p_headquarters_id,p_application_id);
 if jsonb_typeof(result#>'{headquarters,shipping}')='object' then
  select * into shipment from academy2_access.hq_shipment_details where application_id=p_application_id;
  if found then
   result:=jsonb_set(result,'{headquarters,shipping}',(result#>'{headquarters,shipping}')||jsonb_build_object('carrier',shipment.carrier,'shippedDate',shipment.shipped_date));
  end if;
 end if;
 return result;
end $$;
revoke all on function public.academy2_hq_application_with_shipping(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_hq_application_with_shipping(uuid,uuid) to authenticated;
create function public.academy2_hq_record_shipment(p_headquarters_id uuid,p_application_id uuid,p_expected_revision integer,p_request_id uuid,p_shipped_date date,p_carrier text,p_tracking_number text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare command academy2_access.hq_shipment_detail_commands; input jsonb; actual_date date; result jsonb;
begin
 if auth.uid() is null or academy2_access.can(p_headquarters_id,'applications.operate') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from academy2_access.operation_enrollments where application_id=p_application_id and headquarters_id=p_headquarters_id) then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null or p_carrier is null or char_length(btrim(p_carrier)) not between 1 and 100 or p_tracking_number is null or char_length(p_tracking_number)>200 then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
 if p_carrier not in('japan_post_clickpost','japan_post_letterpack','japan_post_yupack','japan_post_yupacket','yamato','sagawa','untracked') and (p_carrier not like 'other:%' or char_length(btrim(substr(p_carrier,7)))=0) then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
 if p_carrier<>'untracked' and btrim(p_tracking_number)='' then raise exception 'academy2_tracking_required' using errcode='22023';end if;
 input:=jsonb_build_object('date',p_shipped_date,'carrier',p_carrier,'trackingNumber',p_tracking_number);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,174));
 select * into command from academy2_access.hq_shipment_detail_commands where request_id=p_request_id;
 if found then
  if command.headquarters_id<>p_headquarters_id or command.application_id<>p_application_id or command.actor_id<>auth.uid() or command.expected_revision<>p_expected_revision or command.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return public.academy2_hq_application_with_shipping(p_headquarters_id,p_application_id);
 end if;
 actual_date:=coalesce(p_shipped_date,(clock_timestamp() at time zone 'Asia/Tokyo')::date);
 if actual_date>(clock_timestamp() at time zone 'Asia/Tokyo')::date then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end if;
 -- The existing command enforces payment, confirmed destination, event, role,
 -- revision, replay binding and audit. A date is serialized at midnight JST.
 result:=public.academy2_hq_application_command(p_headquarters_id,p_application_id,p_expected_revision,p_request_id,'record_shipping',jsonb_build_object('shippedAt',actual_date::text||'T00:00:00+09:00','trackingNumber',p_tracking_number));
 insert into academy2_access.hq_shipment_details(application_id,carrier,shipped_date) values(p_application_id,p_carrier,actual_date);
 insert into academy2_access.hq_shipment_detail_commands(request_id,headquarters_id,application_id,actor_id,expected_revision,input) values(p_request_id,p_headquarters_id,p_application_id,auth.uid(),p_expected_revision,input);
 return public.academy2_hq_application_with_shipping(p_headquarters_id,p_application_id);
end $$;
revoke all on function public.academy2_hq_record_shipment(uuid,uuid,integer,uuid,date,text,text) from public,anon,authenticated,service_role;
grant execute on function public.academy2_hq_record_shipment(uuid,uuid,integer,uuid,date,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
