-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-guest-intake.local.sql
-- Local candidate only. Guest receipts never create Auth users or grant learning access.
begin;
create table academy2_access.guest_applications (
 id uuid primary key default gen_random_uuid(), headquarters_id uuid not null references public.academy_headquarters(id),
 offering_id uuid not null references public.academy_offerings(id), class_id uuid references public.academy_classes(id),
 plan_id uuid not null, plan_revision integer not null, session_hash text not null, request_id uuid not null,
 input jsonb not null, snapshot jsonb not null, answers jsonb not null, fields jsonb not null,
 name text not null, email text not null, price numeric not null, method text not null check(method in('bank','external','onsite')),
 created_at timestamptz not null default clock_timestamp(), consented_at timestamptz not null default clock_timestamp(),
 paid_at timestamptz, shipped_at date, carrier text, tracking text, completed_at timestamptz,
 revision integer not null default 1, receipt_state text not null default 'queued',
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 unique(session_hash,request_id)
);
create table academy2_access.guest_commands (
 request_id uuid primary key, application_id uuid not null references academy2_access.guest_applications(id),
 actor uuid not null references auth.users(id), action text not null, expected integer not null, input jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.guest_applications enable row level security;
alter table academy2_access.guest_commands enable row level security;
revoke all on academy2_access.guest_applications,academy2_access.guest_commands from public,anon,authenticated,service_role;

create function academy2_access.submit_guest(p_session text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare offer uuid;req uuid;cl uuid;ctx jsonb;conf jsonb;ev jsonb;seller jsonb;fields jsonb;answers jsonb;conditions jsonb;
 a academy2_access.guest_applications;s academy2_access.operation_sources;c public.academy_classes;normalized jsonb;fee jsonb;bank jsonb;
begin
 if auth.role() is distinct from 'service_role' or p_session !~ '^[a-f0-9]{64}$' then raise exception 'guest_server_only' using errcode='42501';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>40000 or exists(select 1 from jsonb_object_keys(p_input) k where k not in('offeringId','requestId','name','email','method','terms','agree','price','classId','answers','sellerPublication')) then raise exception 'guest_invalid' using errcode='22023';end if;
 offer:=(p_input->>'offeringId')::uuid;req:=(p_input->>'requestId')::uuid;cl:=nullif(p_input->>'classId','')::uuid;
 if offer is null or req is null or p_input->'agree' is distinct from 'true' or length(btrim(p_input->>'name')) not between 1 and 120 or length(p_input->>'email')>254 or p_input->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'guest_invalid' using errcode='22023';end if;
 normalized:=p_input||jsonb_build_object('name',btrim(p_input->>'name'),'email',lower(btrim(p_input->>'email')));
 perform pg_advisory_xact_lock(hashtextextended(p_session,7261106));
 select * into a from academy2_access.guest_applications where session_hash=p_session and request_id=req;
 if found then
  if a.input is distinct from normalized then raise exception 'guest_retry_changed' using errcode='PT409';end if;
 else
  if (select count(*) from academy2_access.guest_applications where session_hash=p_session and created_at>clock_timestamp()-interval '1 minute')>=5 or (select count(*) from academy2_access.guest_applications where email=normalized->>'email' and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'guest_rate_limit' using errcode='PT429';end if;
  perform 1 from public.academy_offerings where id=offer for share;
  select * into s from academy2_access.operation_sources where offering_id=offer for share;
  if not found then raise exception 'guest_source_unavailable' using errcode='42501';end if;
  -- Locks the same event row as the existing authenticated submit path.
  if cl is not null then select * into c from public.academy_classes where id=cl and headquarters_id=s.headquarters_id for update;end if;
  ctx:=academy2_access.public_intake_with_form(offer,false);conf:=academy2_access.intake_configuration(offer);
  seller:=public.academy2_public_seller_disclosure(offer);
  if ctx->>'mode' is distinct from 'headquarters' or ctx#>>'{offering,purchase_mode}' is distinct from 'all' or ctx#>>'{offering,kind}'='月額レッスン' or p_input->>'method' not in('bank','external','onsite') or (ctx#>'{offering,payment_methods}'?(p_input->>'method')) is distinct from true
   or ctx#>'{offering,price}' is distinct from p_input->'price' or ctx#>>'{terms,version}' is distinct from p_input->>'terms' or nullif(ctx#>>'{terms,body}','') is null
   or seller->>'publication_request' is distinct from p_input->>'sellerPublication' or seller is null
   or jsonb_array_length(coalesce(ctx#>'{applicationForm,readinessReasons}','[]'))>0 then raise exception 'guest_conditions_changed' using errcode='PT409';end if;
  if (ctx->>'eventRequired')::boolean then
   select value into ev from jsonb_array_elements(ctx->'events') where value->>'id'=cl::text;
   if c.id is null or ev is null or ev->'formReady'='false' or c.registration_status<>'open' or c.status not in('planned','active') or (c.schedule_mode='fixed' and c.starts_at<=clock_timestamp()) then raise exception 'guest_event_unavailable' using errcode='22023';end if;
   if c.capacity is not null and c.capacity <= (select count(*) from academy2_access.event_attendees(s.headquarters_id,cl))+(select count(*) from academy2_access.guest_applications where class_id=cl) then raise exception 'guest_event_full' using errcode='22023';end if;
  elsif cl is not null then raise exception 'guest_event_not_needed' using errcode='22023';end if;
  conditions:=academy2_access.intake_condition_context(conf,ev,false);
  if conditions->'kit_ready'='false' then raise exception 'guest_delivery_unavailable' using errcode='22023';end if;
  fields:=academy2_access.intake_runtime_fields(conf,conditions);
  answers:=academy2_access.normalize_intake_answers(fields,p_input->'answers');
  -- Receipt contains the current valid bank destination, fixed at this submission.
  select to_jsonb(h)->'default_payment_note' into bank from public.academy_headquarters h where h.id=s.headquarters_id;
  insert into academy2_access.guest_applications(headquarters_id,offering_id,class_id,plan_id,plan_revision,session_hash,request_id,input,snapshot,answers,fields,name,email,price,method)
  values(s.headquarters_id,offer,cl,s.plan_id,s.plan_revision,p_session,req,normalized,
   jsonb_build_object('intake',ctx,'seller',seller,'event',ev,'context',conditions,'bankNote',bank),answers,fields,
   normalized->>'name',normalized->>'email',(ctx#>>'{offering,price}')::numeric,p_input->>'method') returning * into a;
 end if;
 return jsonb_build_object('id',a.id,'price',a.price,'status','pending','headquarters_id',a.headquarters_id,'offering_title',a.snapshot#>>'{intake,offering,title}','payment_method',a.method,'external_payment_url',case when a.method='external' then a.snapshot#>>'{intake,offering,external_payment_url}' end,'mail_status',a.receipt_state);
end$$;

-- Prevent the existing authenticated path from overlooking seats occupied by guests.
create function academy2_access.guest_seat_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes;begin
 if new.class_id is null then return new;end if;
 select * into c from public.academy_classes where id=new.class_id for update;
 if c.capacity is not null and c.capacity <= (select count(*) from academy2_access.event_attendees(c.headquarters_id,c.id))+(select count(*) from academy2_access.guest_applications where class_id=c.id) then raise exception 'academy2_event_full' using errcode='22023';end if;
 return new;end$$;
create trigger academy_guest_seat_guard before insert on academy2_access.operation_enrollments for each row execute function academy2_access.guest_seat_guard();
revoke all on function academy2_access.guest_seat_guard() from public,anon,authenticated,service_role;

create function academy2_access.guest_hq(p_hq uuid,p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a academy2_access.guest_applications;result jsonb:='[]';summary jsonb;required boolean;next text;event jsonb;allowed jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 for a in select * from academy2_access.guest_applications where headquarters_id=p_hq and (p_id is null or id=p_id) order by created_at desc loop
  event:=a.snapshot->'event';required:=coalesce((a.snapshot#>>'{context,kit_shipping}')::boolean,false) or coalesce((a.snapshot#>>'{context,physical_certificate}')::boolean,false);
  next:=case when a.paid_at is null then 'confirm_payment' when required and a.shipped_at is null then 'record_shipping' when a.completed_at is null then 'confirm_completion' else 'done' end;
  allowed:='[]';
  if next='confirm_payment' and academy2_access.can(p_hq,'payment.confirm') then allowed:=jsonb_build_array(next);elsif next in('record_shipping','confirm_completion') and academy2_access.can(p_hq,'applications.operate') then allowed:=jsonb_build_array(next);end if;
  summary:=jsonb_build_object('source','guest','applicationId',a.id,'headquartersId',p_hq,'saleChannel','headquarters','applicantName',a.name,'planTitle',a.snapshot#>>'{intake,offering,title}','appliedAt',a.created_at,'statusLabel',case when a.completed_at is not null then '受講完了' when a.paid_at is not null then '入金確認済み' else '入金確認待ち' end,'nextAction',next,'revision',a.revision,'completedAt',a.completed_at,'certifiedAt',null,'participantKey','unlinked:'||a.id::text,'thumbnailUrl',a.snapshot#>>'{intake,offering,courses,0,main_image_url}','kitStatus',case when not required then 'not_required' when a.shipped_at is null then 'preparing' else 'shipped' end,'fulfillment',jsonb_build_object('required',required,'shipped',a.shipped_at is not null),'tuition',jsonb_build_object('amount',a.price,'currency','JPY','method',a.method,'status',case when a.paid_at is null then 'pending' else 'paid' end),'schedule',case when a.class_id is null then null else jsonb_build_object('id',a.class_id,'startsAt',event->'startsAt','endsAt',event->'endsAt','mode',event->'scheduleMode','individual',event->'individualConsultation') end);
  result:=result||jsonb_build_array(jsonb_build_object('summary',summary,'headquarters',null,'instructor',null,'legacy',null,'guest',jsonb_build_object('email',a.email,'answers',a.answers,'fields',a.fields,'allowedActions',allowed,'shippingRequired',required,'shippedAt',a.shipped_at,'carrier',a.carrier,'tracking',a.tracking,'paidAt',a.paid_at,'receiptState',a.receipt_state,'consentedAt',a.consented_at,'terms',a.snapshot#>'{intake,terms}','canUndoPayment',a.paid_at is not null and a.shipped_at is null and a.completed_at is null and academy2_access.can(p_hq,'payment.confirm'),'canUndoShipping',a.shipped_at is not null and a.completed_at is null and academy2_access.can(p_hq,'applications.operate'),'canUndoCompletion',a.completed_at is not null and academy2_access.can(p_hq,'applications.operate'))));
 end loop;return result;
end$$;

create function academy2_access.guest_command(p_hq uuid,p_id uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;cmd academy2_access.guest_commands;required boolean;permission text;
begin
 permission:=case when p_action in('confirm_payment','undo_payment') then 'payment.confirm' when p_action in('record_shipping','undo_shipping','confirm_completion','undo_completion') then 'applications.operate' end;
 if permission is null or auth.uid() is null or not academy2_access.can(p_hq,'applications.read') or not academy2_access.can(p_hq,permission) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'guest_invalid' using errcode='22023';end if;
 select * into a from academy2_access.guest_applications where id=p_id and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into cmd from academy2_access.guest_commands where request_id=p_request;
 if found then
  if cmd.application_id<>p_id or cmd.actor<>auth.uid() or cmd.action<>p_action or cmd.expected<>p_expected or cmd.input<>p_input then raise exception 'guest_conflict' using errcode='PT409';end if;
  return academy2_access.guest_hq(p_hq,p_id)->0;
 end if;
 if a.revision<>p_expected then raise exception 'guest_conflict' using errcode='PT409';end if;
 required:=coalesce((a.snapshot#>>'{context,kit_shipping}')::boolean,false) or coalesce((a.snapshot#>>'{context,physical_certificate}')::boolean,false);
 if p_action='confirm_payment' then
  if a.paid_at is not null then raise exception 'guest_state' using errcode='22023';end if;
  update academy2_access.guest_applications set paid_at=clock_timestamp() where id=p_id;
 elsif p_action='record_shipping' then
  if a.paid_at is null or not required or a.shipped_at is not null or nullif(a.answers->>'shipping_address','') is null or (p_input->>'date')::date>(clock_timestamp() at time zone 'Asia/Tokyo')::date or nullif(p_input->>'date','') is null or nullif(p_input->>'carrier','') is null or length(p_input->>'carrier')>100 or (p_input->>'carrier'<>'untracked' and nullif(p_input->>'tracking','') is null) or length(p_input->>'tracking')>200 then raise exception 'guest_shipping' using errcode='22023';end if;
  update academy2_access.guest_applications set shipped_at=(p_input->>'date')::date,carrier=p_input->>'carrier',tracking=p_input->>'tracking' where id=p_id;
 elsif p_action='confirm_completion' then
  if a.paid_at is null or a.completed_at is not null or (required and a.shipped_at is null) then raise exception 'guest_state' using errcode='22023';end if;
  update academy2_access.guest_applications set completed_at=clock_timestamp() where id=p_id;
 elsif p_action='undo_payment' then
  if a.paid_at is null or a.shipped_at is not null or a.completed_at is not null then raise exception 'guest_state' using errcode='22023';end if;
  update academy2_access.guest_applications set paid_at=null where id=p_id;
 elsif p_action='undo_shipping' then
  if a.shipped_at is null or a.completed_at is not null then raise exception 'guest_state' using errcode='22023';end if;
  update academy2_access.guest_applications set shipped_at=null,carrier=null,tracking=null where id=p_id;
 elsif p_action='undo_completion' then
  if a.completed_at is null then raise exception 'guest_state' using errcode='22023';end if;
  update academy2_access.guest_applications set completed_at=null where id=p_id;
 end if;
 update academy2_access.guest_applications set revision=revision+1 where id=p_id;
 insert into academy2_access.guest_commands values(p_request,p_id,auth.uid(),p_action,p_expected,p_input,clock_timestamp());
 return academy2_access.guest_hq(p_hq,p_id)->0;
end$$;

-- Server-only frozen receipt source. No public lookup by ID/email.
create function academy2_access.guest_receipt(p_id uuid,p_session text,p_state text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;begin
 if auth.role() is distinct from 'service_role' then raise exception 'guest_server_only' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=p_id and session_hash=p_session for update;
 if not found then raise exception 'guest_unavailable' using errcode='42501';end if;
 if p_state in('sent','failed') and a.receipt_state='queued' then update academy2_access.guest_applications set receipt_state=p_state where id=p_id;end if;
 return jsonb_build_object('id',a.id,'to',a.email,'name',a.name,'price',a.price,'method',a.method,'snapshot',a.snapshot,'state',case when p_state in('sent','failed') then p_state else a.receipt_state end);
end$$;
revoke all on function academy2_access.submit_guest(text,jsonb),academy2_access.guest_hq(uuid,uuid),academy2_access.guest_command(uuid,uuid,integer,uuid,text,jsonb),academy2_access.guest_receipt(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.submit_guest(text,jsonb),academy2_access.guest_receipt(uuid,text,text) to service_role;
grant execute on function academy2_access.guest_hq(uuid,uuid),academy2_access.guest_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
create function public.academy2_submit_guest(p_session text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.submit_guest(p_session,p_input)$$;
create function public.academy2_guest_receipt(p_id uuid,p_session text,p_state text default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.guest_receipt(p_id,p_session,p_state)$$;
create function public.academy2_guest_hq(p_hq uuid,p_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.guest_hq(p_hq,p_id)$$;
create function public.academy2_guest_command(p_hq uuid,p_id uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.guest_command(p_hq,p_id,p_expected,p_request,p_action,p_input)$$;
revoke all on function public.academy2_submit_guest(text,jsonb),public.academy2_guest_receipt(uuid,text,text),public.academy2_guest_hq(uuid,uuid),public.academy2_guest_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.academy2_submit_guest(text,jsonb),public.academy2_guest_receipt(uuid,text,text) to service_role;
grant execute on function public.academy2_guest_hq(uuid,uuid),public.academy2_guest_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
