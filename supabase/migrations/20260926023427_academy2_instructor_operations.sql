-- Instructor operations use new intake origins only. No migration of legacy paid
-- applications, no grants inferred from certification, and no payment provider call.
create table academy2_access.instructor_contracts (
 id uuid primary key,activity_id uuid not null references academy2_access.instructor_activities(id),
 version text not null check(length(btrim(version)) between 1 and 200),
 accepted_by uuid not null references auth.users(id),accepted_at timestamptz not null,
 starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null check(status in('active','ended')),
 unique(id,activity_id),check(isfinite(accepted_at) and isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)
);
create table academy2_access.instructor_license_grants (
 id uuid primary key,activity_id uuid not null references academy2_access.instructor_activities(id),
 contract_id uuid not null,starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null check(status in('active','revoked')),
 foreign key(contract_id,activity_id) references academy2_access.instructor_contracts(id,activity_id),
 check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)
);
create table academy2_access.instructor_workflows (
 application_id uuid primary key references academy2_access.opening_license_origins(application_id),
 revision integer not null default 1 check(revision>0),configuration jsonb not null,
 format text check(format in('online','in_person')),starts_at timestamptz,ends_at timestamptz,online_url text,
 kit_required boolean,shipping_address text,shipping_address_id uuid,shipping_confirmed_at timestamptz,shipping_confirmed_by uuid references auth.users(id),shipped_at timestamptz,tracking_number text,
 attendance text not null default 'unconfirmed' check(attendance in('unconfirmed','present','absent')),
 attended_at timestamptz,attended_by uuid references auth.users(id),
 report_status text not null default 'not_reported' check(report_status in('not_reported','submitted','accepted')),
 report_text text,reported_at timestamptz,reported_by uuid references auth.users(id),
 certified_at timestamptz,certified_by uuid references auth.users(id),
 check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)),
 check(shipped_at is null or isfinite(shipped_at))
);
create table academy2_access.instructor_commands (
 request_id uuid primary key,application_id uuid not null references academy2_access.instructor_workflows(application_id),
 actor_id uuid not null references auth.users(id),action text not null,expected_revision integer not null,input jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
create table academy2_access.instructor_application_permits (
 application_id uuid primary key references academy2_access.instructor_workflows(application_id),
 actor_id uuid not null,transaction_id bigint not null,action text not null check(action in('confirm_tuition','submit_completion'))
);
do $$declare t text;begin
 foreach t in array array['instructor_contracts','instructor_license_grants','instructor_workflows','instructor_commands','instructor_application_permits'] loop
 execute format('alter table academy2_access.%I enable row level security',t);
 execute format('revoke all on academy2_access.%I from public,anon,authenticated,service_role',t);
 end loop;
end$$;

-- Contract and grant provisioning is not exposed by this migration. Only a
-- separately verified enrollment/contract service may write these canonical rows.
create function academy2_access.instructor_contract_scope() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from academy2_access.instructor_activities where id=new.activity_id and user_id=new.accepted_by) then raise exception 'academy2_contract_scope' using errcode='42501';end if;
 return new;
end$$;
create trigger academy2_instructor_contract_scope before insert or update on academy2_access.instructor_contracts for each row execute function academy2_access.instructor_contract_scope();
create function academy2_access.initialize_instructor_workflow() returns trigger language plpgsql security definer set search_path='' as $$
declare cfg jsonb;methods jsonb;begin
 select configuration into cfg from academy2_access.sales_plan_draft_revisions where draft_id=new.plan_id and revision=new.plan_revision;
 methods:=cfg->'allowed_methods';
 insert into academy2_access.instructor_workflows(application_id,configuration,kit_required,format)
 values(new.application_id,cfg,case cfg#>>'{opening_license,kit}' when 'none' then false when 'included' then true else null end,
 case when jsonb_typeof(methods)='array' and jsonb_array_length(methods)=1 and methods->>0 in('online','in_person') then methods->>0 else null end);
 return new;
end$$;
create trigger academy2_initialize_instructor_workflow after insert on academy2_access.opening_license_origins for each row execute function academy2_access.initialize_instructor_workflow();

-- Complete authorization, not a client assertion and not the old string proof.
-- PL/pgSQL deliberately resolves payment_provider_ready after its next migration.
create function academy2_access.instructor_operation_authorized(p_application uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare o academy2_access.opening_license_origins;begin
 select * into o from academy2_access.opening_license_origins where application_id=p_application;
 if o.application_id is null or auth.uid() is distinct from o.instructor_user_id then return false;end if;
 return academy2_access.payment_provider_ready(o.headquarters_id) and exists(
 select 1 from academy2_access.instructor_activities a
 join academy2_access.tenants t on t.headquarters_id=a.headquarters_id and t.runtime_enabled
 join public.academy_instructors i on i.id=a.instructor_id and i.headquarters_id=a.headquarters_id and i.user_id=a.user_id
 join academy2_access.instructor_contracts c on c.activity_id=a.id and c.accepted_by=a.user_id
 join academy2_access.instructor_license_grants g on g.activity_id=a.id and g.contract_id=c.id
 where a.id=o.activity_id and a.headquarters_id=o.headquarters_id and a.instructor_id=o.instructor_id and a.user_id=o.instructor_user_id and a.sales_plan_id=o.plan_id and a.status='active'
 and c.status='active' and c.accepted_at<=now() and c.starts_at<=now() and c.ends_at>now()
 and g.status='active' and g.starts_at<=now() and g.ends_at>now());
end$$;
create function academy2_access.instructor_payment_authorization(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o academy2_access.opening_license_origins;c academy2_access.instructor_contracts;g academy2_access.instructor_license_grants;account text;expiry timestamptz;begin
 if not academy2_access.instructor_operation_authorized(p_application) then raise exception 'academy2_instructor_authorization_required' using errcode='42501';end if;
 select * into o from academy2_access.opening_license_origins where application_id=p_application;
 select cc.* into c from academy2_access.instructor_contracts cc where cc.activity_id=o.activity_id and cc.accepted_by=auth.uid() and cc.status='active' and cc.accepted_at<=now() and cc.starts_at<=now() and cc.ends_at>now() and exists(select 1 from academy2_access.instructor_license_grants gg where gg.contract_id=cc.id and gg.activity_id=cc.activity_id and gg.status='active' and gg.starts_at<=now() and gg.ends_at>now()) order by cc.ends_at desc limit 1;
 select * into g from academy2_access.instructor_license_grants where activity_id=o.activity_id and contract_id=c.id and status='active' and starts_at<=now() and ends_at>now() order by ends_at desc limit 1;
 select account_reference,valid_until into account,expiry from academy2_access.payment_provider_connections where headquarters_id=o.headquarters_id;
 if g.id is null or account is null then raise exception 'academy2_instructor_authorization_required' using errcode='42501';end if;
 insert into academy2_access.opening_license_authorizations(application_id,contract_reference,instructor_license_reference,connect_account_reference,verifier_revision,verified_at,valid_until)
 values(p_application,c.id::text,g.id::text,account,'instructor-operations-v1',clock_timestamp(),least(c.ends_at,g.ends_at,expiry)) on conflict(application_id) do nothing;
end$$;

create function academy2_access.instructor_operation_command(p_application uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o academy2_access.opening_license_origins;w academy2_access.instructor_workflows;a public.academy_offering_applications;cmd academy2_access.instructor_commands;
 allowed boolean;keys text[];s timestamptz;e timestamptz;shipped timestamptz;address_value text;address_id uuid;result jsonb;gate jsonb;begin
 select * into o from academy2_access.opening_license_origins where application_id=p_application;
 if o.application_id is null or auth.uid() is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 allowed:=case p_action when 'record_shipping' then academy2_access.can(o.headquarters_id,'applications.operate') when 'confirm_certification' then academy2_access.can(o.headquarters_id,'certification.confirm') when 'set_kit_destination' then academy2_access.instructor_operation_authorized(p_application) when 'confirm_tuition' then academy2_access.instructor_operation_authorized(p_application) when 'confirm_schedule' then academy2_access.instructor_operation_authorized(p_application) when 'record_attendance' then academy2_access.instructor_operation_authorized(p_application) when 'submit_completion' then academy2_access.instructor_operation_authorized(p_application) else false end;
 if allowed is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 keys:=case p_action when 'confirm_schedule' then array['startsAt','endsAt','onlineUrl'] when 'submit_completion' then array['report'] when 'set_kit_destination' then array['addressId'] when 'record_shipping' then array['trackingNumber','shippedAt'] else array[]::text[] end;
 if p_request is null or p_expected is null or p_expected<1 or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_each(p_input) k where not k.key=any(keys) or jsonb_typeof(k.value)<>'string') then raise exception 'academy2_invalid_command' using errcode='22023';end if;
 select * into w from academy2_access.instructor_workflows where application_id=p_application for update;
 if not found then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
 select * into cmd from academy2_access.instructor_commands where request_id=p_request;
 if found then
  if cmd.application_id<>p_application or cmd.actor_id<>auth.uid() or cmd.action<>p_action or cmd.expected_revision<>p_expected or cmd.input<>p_input then raise exception 'academy2_command_conflict' using errcode='PT409';end if;
  return academy2_access.instructor_application_view(p_application);
 end if;
 if w.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 if w.kit_required is null or w.format is null or w.configuration->>'study_style' is distinct from 'instructor' then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
 select * into a from public.academy_offering_applications where id=p_application for update;
 if p_action in('record_attendance','submit_completion','confirm_certification','record_shipping') then
  gate:=academy2_access.opening_learner_gate(p_application,case p_action when 'confirm_certification' then 'certify' when 'submit_completion' then 'completion_report' else 'complete' end);
  if a.status<>'paid' or gate->>'outcome' is distinct from 'allow' then raise exception 'academy2_opening_license_unpaid' using errcode='22023';end if;
 end if;
 if p_action='confirm_tuition' then
  if a.status<>'pending' or a.payment_method not in('bank','external') then raise exception 'academy2_payment_not_pending' using errcode='22023';end if;
  perform academy2_access.instructor_payment_authorization(p_application);
  result:=academy2_access.prepare_opening_payment(p_application,p_request);
  if result->>'outcome' is distinct from 'prepared' then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
  insert into academy2_access.instructor_application_permits values(p_application,auth.uid(),txid_current(),p_action);
  update public.academy_offering_applications set status='paid',paid_at=clock_timestamp(),paid_by=auth.uid() where id=p_application;
  result:=academy2_access.record_opening_payment(p_application,p_request);
  if result->>'outcome' not in('created','existing','not_applicable') then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
 elsif p_action='confirm_schedule' then
  if w.report_status<>'not_reported' then raise exception 'academy2_instructor_report_required' using errcode='22023';end if;
  begin s:=(p_input->>'startsAt')::timestamptz;e:=(p_input->>'endsAt')::timestamptz;exception when others then raise exception 'academy2_invalid_schedule' using errcode='22023';end;
  if s is null or e is null or not isfinite(s) or not isfinite(e) or e<=s or length(coalesce(p_input->>'onlineUrl',''))>2000 or coalesce(p_input->>'onlineUrl','')~'[[:cntrl:]]' or (w.format='online' and coalesce(p_input->>'onlineUrl','')!~'^https://[^[:space:]]+$') then raise exception 'academy2_invalid_schedule' using errcode='22023';end if;
  update academy2_access.instructor_workflows set starts_at=s,ends_at=e,online_url=case when format='online' then p_input->>'onlineUrl' else null end where application_id=p_application;
 elsif p_action='set_kit_destination' then
  if w.kit_required is distinct from true or w.shipped_at is not null or w.configuration#>>'{kit,recipient}' is distinct from 'instructor' then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
  begin address_id:=(p_input->>'addressId')::uuid;exception when others then raise exception 'academy2_invalid_shipping' using errcode='22023';end;
  select address_text into address_value from public.academy_instructor_addresses where id=address_id and instructor_id=o.instructor_id;
  if nullif(btrim(address_value),'') is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
  update academy2_access.instructor_workflows set shipping_address=address_value,shipping_address_id=address_id,shipping_confirmed_at=clock_timestamp(),shipping_confirmed_by=auth.uid() where application_id=p_application;
 elsif p_action='record_shipping' then
  if w.kit_required is distinct from true or w.shipped_at is not null or w.starts_at is null or w.shipping_confirmed_at is null or nullif(btrim(w.shipping_address),'') is null or length(coalesce(p_input->>'trackingNumber',''))>200 then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
  begin shipped:=(p_input->>'shippedAt')::timestamptz;exception when others then raise exception 'academy2_invalid_shipping' using errcode='22023';end;
  if shipped is null or not isfinite(shipped) then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
  update academy2_access.instructor_workflows set shipped_at=shipped,tracking_number=nullif(p_input->>'trackingNumber','') where application_id=p_application;
 elsif p_action='record_attendance' then
  if w.starts_at is null or w.attendance<>'unconfirmed' or w.report_status<>'not_reported' then raise exception 'academy2_instructor_schedule_required' using errcode='22023';end if;
  update academy2_access.instructor_workflows set attendance='present',attended_at=clock_timestamp(),attended_by=auth.uid() where application_id=p_application;
 elsif p_action='submit_completion' then
  if w.attendance<>'present' or w.starts_at is null or w.report_status<>'not_reported' or length(coalesce(p_input->>'report',''))>4000 then raise exception 'academy2_instructor_report_required' using errcode='22023';end if;
  insert into academy2_access.instructor_application_permits values(p_application,auth.uid(),txid_current(),p_action);
  update public.academy_offering_applications set completed_at=clock_timestamp(),completed_by=auth.uid() where id=p_application;
  update academy2_access.instructor_workflows set report_status='submitted',report_text=coalesce(p_input->>'report',''),reported_at=clock_timestamp(),reported_by=auth.uid() where application_id=p_application;
 elsif p_action='confirm_certification' then
  if w.report_status<>'submitted' or w.certified_at is not null or w.configuration#>'{after,skill_certification}' is distinct from 'true'::jsonb then raise exception 'academy2_instructor_report_required' using errcode='22023';end if;
  -- This persists the fact of skill certification. It does not issue a certificate,
  -- grant commercial/instructor rights or enroll the learner in recurring dues.
  update academy2_access.instructor_workflows set certified_at=clock_timestamp(),certified_by=auth.uid(),report_status='accepted' where application_id=p_application;
 end if;
 update academy2_access.instructor_workflows set revision=revision+1 where application_id=p_application;
 insert into academy2_access.instructor_commands(request_id,application_id,actor_id,action,expected_revision,input) values(p_request,p_application,auth.uid(),p_action,p_expected,p_input);
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(o.headquarters_id,auth.uid(),'instructor.'||p_action,p_application);
 return academy2_access.instructor_application_view(p_application);
end$$;



-- One consumed permit, not a reusable transaction flag. Old API/direct writes
-- cannot mutate a new instructor application after or alongside a valid command.
create function academy2_access.guard_instructor_application() returns trigger language plpgsql security definer set search_path='' as $$declare action_name text;begin
 if not exists(select 1 from academy2_access.instructor_workflows where application_id=old.id) then return case when tg_op='DELETE' then old else new end;end if;
 if tg_op='DELETE' then raise exception 'academy2_instructor_history_immutable' using errcode='42501';end if;
 delete from academy2_access.instructor_application_permits where application_id=old.id and actor_id=auth.uid() and transaction_id=txid_current() returning action into action_name;
 if action_name='confirm_tuition' then
  if old.status<>'pending' or new.status<>'paid' or new.paid_at is null or not isfinite(new.paid_at) or new.paid_by is distinct from auth.uid() or (to_jsonb(new)-array['status','paid_at','paid_by']) is distinct from (to_jsonb(old)-array['status','paid_at','paid_by']) then raise exception 'academy2_invalid_payment_transition' using errcode='42501';end if;
 elsif action_name='submit_completion' then
  if old.status<>'paid' or old.completed_at is not null or new.completed_at is null or new.completed_by is distinct from auth.uid() or (to_jsonb(new)-array['completed_at','completed_by']) is distinct from (to_jsonb(old)-array['completed_at','completed_by']) then raise exception 'academy2_invalid_completion_transition' using errcode='42501';end if;
 else raise exception 'academy2_command_required' using errcode='42501';end if;
 return new;
end$$;
create trigger academy2_instructor_application_guard before update or delete on public.academy_offering_applications for each row execute function academy2_access.guard_instructor_application();

create function academy2_access.instructor_application_view(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o academy2_access.opening_license_origins;w academy2_access.instructor_workflows;a public.academy_offering_applications;inv academy2_access.opening_license_invoices;
 self boolean;active boolean;finance boolean;actions jsonb:='[]';n text;status_label text;license_status text;gate jsonb;progress jsonb:='{}';addresses jsonb:='[]';op text;hqname text;begin
 select * into o from academy2_access.opening_license_origins where application_id=p_application;
 self:=auth.uid() is not null and auth.uid()=o.instructor_user_id;
 if o.application_id is null or not exists(select 1 from academy2_access.tenants where headquarters_id=o.headquarters_id and runtime_enabled) or not (coalesce(self,false) or academy2_access.can(o.headquarters_id,'applications.read')) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into w from academy2_access.instructor_workflows where application_id=p_application;
 if not found then raise exception 'academy2_instructor_scope_on_hold' using errcode='22023';end if;
 select * into a from public.academy_offering_applications where id=p_application;
 select * into inv from academy2_access.opening_license_invoices where application_id=p_application;
 select name into hqname from public.academy_headquarters where id=o.headquarters_id;
 active:=academy2_access.instructor_operation_authorized(p_application);
 finance:=self or academy2_access.can(o.headquarters_id,'finance.read');
 license_status:=coalesce(inv.status,case when exists(select 1 from academy2_access.opening_license_payment_events where application_id=p_application and offering_snapshot->'enabled'='false'::jsonb) then 'not_required' else 'unknown' end);
 gate:=academy2_access.opening_learner_gate(p_application,'completion_report');
 if active then
  if w.kit_required is true and w.shipped_at is null and w.configuration#>>'{kit,recipient}'='instructor' then
   actions:=actions||'"set_kit_destination"'::jsonb;
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'address',address_text) order by created_at),'[]') into addresses from public.academy_instructor_addresses where instructor_id=o.instructor_id;
  end if;
  if w.report_status='not_reported' then actions:=actions||'"confirm_schedule"'::jsonb;end if;
  if a.status='pending' then actions:=actions||'"confirm_tuition"'::jsonb;end if;
  if inv.status='unpaid' then actions:=actions||'"pay_opening_license"'::jsonb;end if;
  if a.status='paid' and w.starts_at is not null and gate->>'outcome'='allow' and w.report_status='not_reported' then
   if w.attendance='unconfirmed' then actions:=actions||'"record_attendance"'::jsonb;end if;
   if w.attendance='present' then actions:=actions||'"submit_completion"'::jsonb;end if;
  end if;
 end if;
 if academy2_access.can(o.headquarters_id,'applications.operate') and w.kit_required is true and w.shipped_at is null and w.shipping_confirmed_at is not null and w.starts_at is not null and gate->>'outcome'='allow' then actions:=actions||'"record_shipping"'::jsonb;end if;
 if academy2_access.can(o.headquarters_id,'certification.confirm') and w.report_status='submitted' and w.certified_at is null and gate->>'outcome'='allow' and w.configuration#>'{after,skill_certification}'='true'::jsonb then actions:=actions||'"confirm_certification"'::jsonb;end if;
 n:=case when actions?'confirm_tuition' then 'confirm_tuition' when actions?'pay_opening_license' then 'pay_opening_license' when w.starts_at is null and actions?'confirm_schedule' then 'confirm_schedule' when actions?'record_attendance' then 'record_attendance' when actions?'submit_completion' then 'completion_report' else null end;
 status_label:=case when w.certified_at is not null then '認定済み' when w.report_status='submitted' then '本部確認待ち' when w.report_status='accepted' then '完了' when a.status='pending' then '入金確認待ち' when license_status='unpaid' then '開講準備' when w.starts_at is null then '日程調整中' else '開催確定' end;
 foreach op in array array['complete','completion_report','certify','issue_certificate','grant_rights','release_materials'] loop
  gate:=academy2_access.opening_learner_gate(p_application,op,null);
  progress:=progress||jsonb_build_object(op,jsonb_build_object('state',gate->>'outcome','message',case when gate->>'outcome'='allow' then null else '受講準備中' end));
 end loop;
 return jsonb_build_object('revision',w.revision,'allowedActions',actions,'headquartersId',o.headquarters_id,'headquartersName',hqname,'activityId',o.activity_id,
 'details',jsonb_build_object('statusLabel',status_label,'appliedAt',a.created_at,'shippingAddress',w.shipping_address,'shippedAt',w.shipped_at,'trackingNumber',w.tracking_number,'scheduleInput',jsonb_build_object('date',coalesce(to_char(w.starts_at at time zone 'Asia/Tokyo','YYYY-MM-DD'),''),'startsAt',coalesce(to_char(w.starts_at at time zone 'Asia/Tokyo','HH24:MI'),''),'endsAt',coalesce(to_char(w.ends_at at time zone 'Asia/Tokyo','HH24:MI'),''),'onlineUrl',coalesce(w.online_url,'')),'kitDestination',jsonb_build_object('recipient',case when w.configuration#>>'{kit,recipient}' in('instructor','learner') then w.configuration#>>'{kit,recipient}' else null end,'options',addresses,'selectedAddress',w.shipping_address,'selectedAddressId',w.shipping_address_id)),
 'view',jsonb_build_object('outcome','ready','applicationId',a.id,'learnerName',a.applicant_name,'planTitle',a.offering_title,'contact',jsonb_build_object('email',a.applicant_email,'mode','external_email'),
 'tuition',jsonb_build_object('status',case when a.status='paid' then 'paid' else 'unpaid' end,'amountMinor',case when finance then a.price else null end,'currency','JPY','method',case a.payment_method when 'bank' then 'bank_transfer' when 'external' then 'external_url' else 'unknown' end,'recipient','instructor'),
 'openingLicense',jsonb_build_object('status',license_status,'amountMinor',case when finance then inv.amount_minor else null end,'currency','JPY'),
 'schedule',jsonb_build_object('mode','arranged_after_application','startsAt',w.starts_at,'endsAt',w.ends_at,'format',w.format,'status',case when w.report_status<>'not_reported' then 'completed' when w.starts_at is not null then 'confirmed' else 'unconfirmed' end),
 'completion',jsonb_build_object('attendance',w.attendance,'report',w.report_status,'certification',case when w.certified_at is not null then 'certified' when w.configuration#>'{after,skill_certification}'='true'::jsonb then 'pending' else 'none' end),
 'kit',jsonb_build_object('required',w.kit_required,'status',case when w.kit_required is false then 'not_required' when w.shipped_at is not null then 'shipped' else 'preparing' end),
 'nextAction',case when n is null then jsonb_build_object('outcome','none') else jsonb_build_object('outcome','action','key',n) end,'progression',progress,'automaticMailHistory','[]'::jsonb));
end$$;

create function public.academy2_my_instructor_applications() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='[]';r record;d jsonb;begin
 if auth.uid() is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 for r in select o.application_id from academy2_access.opening_license_origins o join academy2_access.instructor_workflows w using(application_id) join academy2_access.tenants t on t.headquarters_id=o.headquarters_id and t.runtime_enabled where o.instructor_user_id=auth.uid() order by o.created_at desc loop
  d:=academy2_access.instructor_application_view(r.application_id);
  result:=result||jsonb_build_array(jsonb_build_object('applicationId',r.application_id,'learnerName',d#>>'{view,learnerName}','planTitle',d#>>'{view,planTitle}','statusLabel',d#>>'{details,statusLabel}','nextAction',d#>>'{view,nextAction,key}','headquartersId',d->'headquartersId','headquartersName',d->'headquartersName','activityId',d->'activityId','completionReport',d#>>'{view,completion,report}','certification',d#>>'{view,completion,certification}','scheduleStartsAt',d#>>'{view,schedule,startsAt}','scheduleEndsAt',d#>>'{view,schedule,endsAt}','format',d#>>'{view,schedule,format}','eventId',null,'appliedAt',d#>>'{details,appliedAt}'));
 end loop;
 return result;
end$$;
create function public.academy2_instructor_application(p_application uuid) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.instructor_application_view(p_application)$$;
create function public.academy2_instructor_operation_command(p_application uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select academy2_access.instructor_operation_command(p_application,p_expected,p_request,p_action,p_input)$$;
revoke all on function academy2_access.instructor_contract_scope(),academy2_access.initialize_instructor_workflow(),academy2_access.instructor_operation_authorized(uuid),academy2_access.instructor_payment_authorization(uuid),academy2_access.guard_instructor_application(),academy2_access.instructor_application_view(uuid),academy2_access.instructor_operation_command(uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.academy2_my_instructor_applications(),public.academy2_instructor_application(uuid),public.academy2_instructor_operation_command(uuid,integer,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.academy2_my_instructor_applications(),public.academy2_instructor_application(uuid),public.academy2_instructor_operation_command(uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
