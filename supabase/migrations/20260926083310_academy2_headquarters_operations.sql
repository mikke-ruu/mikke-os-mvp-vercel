-- HQ read/command projection over the existing two operational graphs.
-- No existing application is enrolled, no payment/license is backfilled.
create table academy2_access.hq_shipping (
 application_id uuid primary key references academy2_access.operation_enrollments(application_id) on delete restrict,
 address text,confirmed_at timestamptz,confirmed_by uuid references auth.users(id),
 shipped_at timestamptz,shipped_by uuid references auth.users(id),tracking_number text,
 check(shipped_at is null or isfinite(shipped_at)),
 check(address is null or char_length(address) between 1 and 2000)
);
create table academy2_access.hq_shipping_commands (
 request_id uuid primary key,application_id uuid not null references academy2_access.hq_shipping(application_id),
 actor_id uuid not null references auth.users(id),action text not null,expected_revision integer not null,input jsonb not null,
 created_at timestamptz not null default now()
);
alter table academy2_access.hq_shipping enable row level security;
alter table academy2_access.hq_shipping_commands enable row level security;
revoke all on academy2_access.hq_shipping,academy2_access.hq_shipping_commands from public,anon,authenticated,service_role;

create function academy2_access.initialize_hq_shipping() returns trigger language plpgsql security definer set search_path='' as $$
declare config jsonb;begin
 select configuration into config from academy2_access.sales_plan_draft_revisions where draft_id=new.plan_id and revision=new.plan_revision;
 if config#>'{kit,enabled}'='true'::jsonb then
  if config#>>'{kit,recipient}' is distinct from 'learner' then raise exception 'academy2_shipping_scope_on_hold' using errcode='22023';end if;
  insert into academy2_access.hq_shipping(application_id) values(new.application_id);
 end if;
 return new;
end$$;
create trigger academy2_initialize_hq_shipping after insert on academy2_access.operation_enrollments for each row execute function academy2_access.initialize_hq_shipping();

-- A direct call to the pre-existing completion API must respect the same kit gate.
create function academy2_access.guard_hq_shipping_completion() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.completed_at is null and new.completed_at is not null and exists(select 1 from academy2_access.hq_shipping where application_id=old.id and shipped_at is null) then raise exception 'academy2_shipping_not_complete' using errcode='22023';end if;
 return new;
end$$;
create trigger academy2_hq_shipping_completion before update on public.academy_offering_applications for each row execute function academy2_access.guard_hq_shipping_completion();

create function academy2_access.hq_application(p_hq uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.academy_offering_applications;e academy2_access.operation_enrollments;w academy2_access.instructor_workflows;s academy2_access.hq_shipping;
 d jsonb;summary jsonb;hq jsonb;teacher jsonb;config jsonb;actions jsonb:='[]';event jsonb;finance boolean;n text;label text;kit_status text;
begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into a from public.academy_offering_applications where id=p_id and headquarters_id=p_hq;
 if a.id is null then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 finance:=academy2_access.can(p_hq,'finance.read');
 select * into e from academy2_access.operation_enrollments where application_id=p_id and headquarters_id=p_hq;
 if e.application_id is not null then
  d:=academy2_access.operation_view(p_hq,p_id);
  if not finance then d:=d-array['price','payment_status','payment_method','paid_at'];end if;
  select configuration into config from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision;
  select * into s from academy2_access.hq_shipping where application_id=p_id;
  select jsonb_build_object('id',c.id,'revision',ep.revision,'startsAt',c.starts_at,'endsAt',c.ends_at,'format',c.format,'venueName',c.venue_name,'meetingUrl',c.meeting_url) into event from public.academy_classes c join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=p_hq where c.id=e.class_id and c.headquarters_id=p_hq;
  if event is not null and a.completed_at is null and academy2_access.can(p_hq,'applications.operate') then actions:=actions||'"confirm_schedule"'::jsonb;end if;
  if a.status='pending' and a.payment_method='bank' and academy2_access.can(p_hq,'payment.confirm') then actions:=actions||'"confirm_payment"'::jsonb;end if;
  if s.application_id is not null and s.shipped_at is null and academy2_access.can(p_hq,'applications.operate') then
   actions:=actions||'"set_shipping_destination"'::jsonb;
   if a.status='paid' and s.confirmed_at is not null and event->>'startsAt' is not null then actions:=actions||'"record_shipping"'::jsonb;end if;
  end if;
  if a.status='paid' and a.completed_at is null and academy2_access.can(p_hq,'applications.operate') and (s.application_id is null or s.shipped_at is not null) and exists(select 1 from public.academy_classes c where c.id=e.class_id and c.headquarters_id=p_hq and c.starts_at is not null and c.status<>'cancelled') then actions:=actions||'"confirm_completion"'::jsonb;end if;
  if a.status='paid' and a.completed_at is not null and e.certification_at is null and config#>'{after,skill_certification}'='true'::jsonb and academy2_access.can(p_hq,'certification.confirm') then actions:=actions||'"confirm_certification"'::jsonb;end if;
  kit_status:=case when s.application_id is null then 'not_required' when s.shipped_at is not null then 'shipped' else 'preparing' end;
  n:=case when actions?'confirm_payment' then 'confirm_payment' when event->>'startsAt' is null and academy2_access.can(p_hq,'applications.operate') then 'confirm_schedule' when actions?'set_shipping_destination' and s.confirmed_at is null then 'set_shipping_destination' when actions?'record_shipping' then 'record_shipping' when actions?'confirm_completion' then 'confirm_completion' when actions?'confirm_certification' then 'confirm_certification' else null end;
  label:=case when e.certification_at is not null then '認定済み' when a.completed_at is not null then case when config#>'{after,skill_certification}'='true'::jsonb then '認定待ち' else '修了' end when a.status='pending' then case when finance then '入金確認待ち' else '受講準備中' end when event->>'startsAt' is null then '日程調整中' when s.application_id is not null and s.shipped_at is null then '発送準備中' else '受講中' end;
  hq:=d||jsonb_build_object('contactEmail',a.applicant_email,'event',event,'allowedActions',actions,'shipping',jsonb_build_object('required',s.application_id is not null,'status',kit_status,'address',s.address,'shippedAt',s.shipped_at,'trackingNumber',s.tracking_number));
  summary:=jsonb_build_object('applicationId',a.id,'headquartersId',p_hq,'saleChannel','headquarters','applicantName',a.applicant_name,'planTitle',a.offering_title,'appliedAt',a.created_at,'statusLabel',label,'nextAction',n,'revision',e.revision,'kitStatus',kit_status,'completedAt',a.completed_at,'certifiedAt',e.certification_at);
 else
  select wf.* into w from academy2_access.instructor_workflows wf join academy2_access.opening_license_origins o on o.application_id=wf.application_id where wf.application_id=p_id and o.headquarters_id=p_hq;
  if w.application_id is null then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
  teacher:=academy2_access.instructor_application_view(p_id);
  select coalesce(jsonb_agg(value),'[]') into actions from jsonb_array_elements(teacher->'allowedActions') where value#>>'{}' in('record_shipping','confirm_certification');
  teacher:=jsonb_set(teacher,'{allowedActions}',actions);
  -- HQ context never inherits instructor self privileges or personal address book.
  teacher:=jsonb_set(teacher,'{details,kitDestination,options}','[]');
  if not finance then
   teacher:=jsonb_set(teacher,'{view,tuition}',jsonb_build_object('status','unknown','amountMinor',null,'currency','JPY','method','unknown','recipient','instructor'));
   teacher:=jsonb_set(teacher,'{view,openingLicense,amountMinor}','null');
  end if;
  n:=case when actions?'record_shipping' then 'record_shipping' when actions?'confirm_certification' then 'confirm_certification' else null end;
  teacher:=jsonb_set(teacher,'{view,nextAction}',case when n is null then jsonb_build_object('outcome','none') else jsonb_build_object('outcome','action','key',n) end);
  label:=case when not finance and a.status='pending' then '受講準備中' else teacher#>>'{details,statusLabel}' end;
  teacher:=jsonb_set(teacher,'{details,statusLabel}',to_jsonb(label));
  summary:=jsonb_build_object('applicationId',a.id,'headquartersId',p_hq,'saleChannel','instructor','applicantName',a.applicant_name,'planTitle',a.offering_title,'appliedAt',a.created_at,'statusLabel',label,'nextAction',n,'revision',w.revision,'kitStatus',teacher#>>'{view,kit,status}','completedAt',a.completed_at,'certifiedAt',w.certified_at);
 end if;
 if finance then summary:=summary||jsonb_build_object('tuition',jsonb_build_object('amount',a.price,'currency','JPY','status',a.status,'method',a.payment_method));end if;
 return jsonb_build_object('summary',summary,'headquarters',hq,'instructor',teacher);
end$$;

create function academy2_access.hq_applications(p_hq uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(academy2_access.hq_application(p_hq,ids.application_id)->'summary' order by a.created_at desc,a.id),'[]') into result from (
 select application_id from academy2_access.operation_enrollments where headquarters_id=p_hq
 union select o.application_id from academy2_access.opening_license_origins o join academy2_access.instructor_workflows w using(application_id) where o.headquarters_id=p_hq
 )ids join public.academy_offering_applications a on a.id=ids.application_id and a.headquarters_id=p_hq;
 return result;
end$$;

create function academy2_access.hq_application_command(p_hq uuid,p_id uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;s academy2_access.hq_shipping;cmd academy2_access.hq_shipping_commands;a public.academy_offering_applications;stamp timestamptz;address_value text;keys text[];
begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.academy_offering_applications where id=p_id and headquarters_id=p_hq) then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 select * into e from academy2_access.operation_enrollments where application_id=p_id and headquarters_id=p_hq for update;
 if e.application_id is null then
  if p_action is null or p_action not in('record_shipping','confirm_certification') or not exists(select 1 from academy2_access.opening_license_origins where application_id=p_id and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
  perform academy2_access.instructor_operation_command(p_id,p_expected,p_request,p_action,p_input);
 elsif p_action in('confirm_payment','confirm_completion','confirm_certification') then
  perform academy2_access.operation_command(p_hq,p_id,p_expected,p_request,p_action,p_input);
 else
  if not academy2_access.can(p_hq,'applications.operate') or p_action is null or p_action not in('set_shipping_destination','record_shipping') then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if p_request is null or p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_command' using errcode='22023';end if;
  keys:=case when p_action='set_shipping_destination' then array['address'] else array['shippedAt','trackingNumber'] end;
  if exists(select 1 from jsonb_each(p_input) x where x.key<>all(keys) or jsonb_typeof(x.value)<>'string') then raise exception 'academy2_invalid_command' using errcode='22023';end if;
  select * into cmd from academy2_access.hq_shipping_commands where request_id=p_request;
  if cmd.request_id is not null then
   if cmd.application_id<>p_id or cmd.actor_id<>auth.uid() or cmd.action<>p_action or cmd.expected_revision<>p_expected or cmd.input<>p_input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
   return academy2_access.hq_application(p_hq,p_id);
  end if;
  if e.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  select * into s from academy2_access.hq_shipping where application_id=p_id for update;
  select * into a from public.academy_offering_applications where id=p_id;
  if s.application_id is null or s.shipped_at is not null or a.status not in('pending','paid') or a.completed_at is not null then raise exception 'academy2_shipping_not_ready' using errcode='22023';end if;
  if p_action='set_shipping_destination' then
   address_value:=btrim(p_input->>'address');
   if address_value is null or char_length(address_value) not between 1 and 2000 then raise exception 'academy2_invalid_address' using errcode='22023';end if;
   update academy2_access.hq_shipping set address=address_value,confirmed_at=clock_timestamp(),confirmed_by=auth.uid() where application_id=p_id;
  else
   begin stamp:=(p_input->>'shippedAt')::timestamptz;exception when others then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end;
   if stamp is null or not isfinite(stamp) or length(coalesce(p_input->>'trackingNumber',''))>200 or s.confirmed_at is null or a.status<>'paid' or not exists(select 1 from public.academy_classes where id=e.class_id and headquarters_id=p_hq and starts_at is not null and status<>'cancelled') then raise exception 'academy2_shipping_not_ready' using errcode='22023';end if;
   update academy2_access.hq_shipping set shipped_at=stamp,shipped_by=auth.uid(),tracking_number=nullif(btrim(p_input->>'trackingNumber'),'') where application_id=p_id;
  end if;
  insert into academy2_access.hq_shipping_commands values(p_request,p_id,auth.uid(),p_action,p_expected,p_input,clock_timestamp());
  update academy2_access.operation_enrollments set revision=revision+1 where application_id=p_id;
  insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'hq.'||p_action,p_id);
 end if;
 return academy2_access.hq_application(p_hq,p_id);
end$$;

revoke all on function academy2_access.initialize_hq_shipping(),academy2_access.guard_hq_shipping_completion(),academy2_access.hq_application(uuid,uuid),academy2_access.hq_applications(uuid),academy2_access.hq_application_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.academy2_hq_applications(p_headquarters_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.hq_applications(p_headquarters_id)$$;
create function public.academy2_hq_application(p_headquarters_id uuid,p_application_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.hq_application(p_headquarters_id,p_application_id)$$;
create function public.academy2_hq_application_command(p_headquarters_id uuid,p_application_id uuid,p_expected_revision integer,p_request_id uuid,p_action text,p_input jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select academy2_access.hq_application_command(p_headquarters_id,p_application_id,p_expected_revision,p_request_id,p_action,p_input)$$;
revoke all on function public.academy2_hq_applications(uuid),public.academy2_hq_application(uuid,uuid),public.academy2_hq_application_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.academy2_hq_applications(uuid),public.academy2_hq_application(uuid,uuid),public.academy2_hq_application_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;


-- Permit only explicitly configured learner kits; other held options remain held.
create or replace function academy2_access.bind_operation_source(p_hq uuid,p_offering uuid,p_plan uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.academy_offerings;r academy2_access.sales_plan_draft_revisions;b academy2_access.operation_sources;ids uuid[];
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into o from public.academy_offerings where id=p_offering and headquarters_id=p_hq for share;
 select rev.* into r from academy2_access.sales_plan_draft_revisions rev join academy2_access.sales_plan_drafts d on d.id=rev.draft_id and d.headquarters_id=p_hq where rev.draft_id=p_plan and rev.revision=p_revision;
 if o.id is null or r.draft_id is null then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 select array_agg(value::uuid order by ord) into ids from jsonb_array_elements_text(r.configuration->'course_ids') with ordinality a(value,ord);
 if o.status<>'published' or o.purchase_mode<>'all' or o.kind='月額レッスン' or o.kind is distinct from r.configuration->>'kind' or o.course_ids is distinct from ids or o.price is distinct from (r.configuration->>'price')::numeric or o.title is distinct from r.configuration->>'title'
  or r.configuration->>'purchase_mode' is distinct from 'all'
  or coalesce((r.configuration#>>'{after,commercial_license}')::boolean,false)
  or coalesce((r.configuration#>>'{after,instructor_license}')::boolean,false)
  or coalesce((r.configuration#>>'{dues,enabled}')::boolean,false)
  or (coalesce((r.configuration#>>'{kit,enabled}')::boolean,false) and r.configuration#>>'{kit,recipient}' is distinct from 'learner')
  or coalesce((r.configuration#>>'{opening_license,enabled}')::boolean,false)
  or coalesce((r.configuration#>>'{materials,enabled}')::boolean,false)
  or r.configuration->>'study_style' is distinct from 'instructor'
  or cardinality(o.course_ids)<>1
  or (r.configuration#>'{after,certificate}') is not null and r.configuration#>'{after,certificate}'<>'null'::jsonb
  or coalesce(r.configuration->>'community','none')<>'none'
  or nullif(btrim(r.configuration#>>'{terms,version}'),'') is null or nullif(btrim(r.configuration#>>'{terms,body}'),'') is null
  or ('bank'=any(o.payment_methods)) is distinct from true or ((r.configuration->'payment_methods')?'bank') is distinct from true
  or (r.configuration->>'study_style' in('instructor','materials_only')) is distinct from true
 then raise exception 'academy2_operational_scope_on_hold' using errcode='22023';end if;
 insert into academy2_access.operation_sources(offering_id,headquarters_id,plan_id,plan_revision,bound_by) values(p_offering,p_hq,p_plan,p_revision,auth.uid()) on conflict(offering_id) do nothing;
 select * into b from academy2_access.operation_sources where offering_id=p_offering for update;
 if b.headquarters_id<>p_hq or b.plan_id<>p_plan or b.plan_revision<>p_revision then raise exception 'academy2_source_already_bound' using errcode='PT409';end if;
 return jsonb_build_object('offering_id',p_offering,'plan_id',p_plan,'plan_revision',p_revision,'publication_changed',false);
end $$;


notify pgrst,'reload schema';
