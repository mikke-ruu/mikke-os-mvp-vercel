-- Read models and additive operational records. No existing row is enrolled,
-- published, charged, certified or migrated by installing this migration.
create table academy2_access.operation_sources (
 offering_id uuid primary key references public.academy_offerings(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 plan_id uuid not null, plan_revision integer not null,
 bound_by uuid not null references auth.users(id),bound_at timestamptz not null default now(),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
create table academy2_access.event_plans (
 class_id uuid primary key references public.academy_classes(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 plan_id uuid not null,plan_revision integer not null,revision integer not null default 1,
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
create table academy2_access.operation_enrollments (
 application_id uuid primary key references public.academy_offering_applications(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 plan_id uuid not null,plan_revision integer not null,
 class_id uuid references public.academy_classes(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 consent_version text not null,consent_body text not null,consented_at timestamptz not null,
 consented_by uuid not null references auth.users(id),
 certification_at timestamptz,certification_by uuid references auth.users(id),certification_note text,
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
create index academy2_operations_hq on academy2_access.operation_enrollments(headquarters_id,application_id);
create index academy2_operations_class on academy2_access.operation_enrollments(class_id);
create table academy2_access.operation_commands (
 request_id uuid primary key,application_id uuid not null references academy2_access.operation_enrollments(application_id) on delete restrict,
 actor_id uuid not null references auth.users(id), action text not null,expected_revision integer not null,
 input jsonb not null,transaction_id bigint,created_at timestamptz not null default now()
);
alter table academy2_access.operation_sources enable row level security;
alter table academy2_access.event_plans enable row level security;
alter table academy2_access.operation_enrollments enable row level security;
alter table academy2_access.operation_commands enable row level security;
revoke all on academy2_access.operation_sources,academy2_access.event_plans,academy2_access.operation_enrollments,academy2_access.operation_commands from public,anon,authenticated,service_role;

-- Canonical active seat projection includes both existing registration systems.
-- A booking of the same offering application is not counted twice.
create function academy2_access.event_attendees(p_hq uuid,p_event uuid) returns table(id text,name text)
language sql stable security definer set search_path='' as $$
 select 'legacy:'||a.id::text,a.applicant_name from public.academy_applications a where a.class_id=p_event and a.headquarters_id=p_hq and a.status<>'cancelled'
 union
 select 'offering:'||a.id::text,a.applicant_name from academy2_access.operation_enrollments e join public.academy_offering_applications a on a.id=e.application_id and a.headquarters_id=e.headquarters_id where e.class_id=p_event and e.headquarters_id=p_hq and a.status in('pending','paid')
 union
 select 'offering:'||a.id::text,a.applicant_name from public.academy_offering_class_bookings b join public.academy_offering_applications a on a.id=b.application_id and a.headquarters_id=b.headquarters_id where b.class_id=p_event and b.headquarters_id=p_hq and b.status='assigned' and a.status in('pending','paid')
$$;
revoke all on function academy2_access.event_attendees(uuid,uuid) from public,anon,authenticated,service_role;
create function academy2_access.events(p_hq uuid,p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'headquarters_id',c.headquarters_id,'title',c.title,
  'sales_plan_id',ep.plan_id,'sales_plan_name',r.configuration->>'title','course_name',co.name,
  'main_image_url',co.main_image_url,'instructor_name',i.business_name,
  'instructor_response_status',(select ir.status from public.academy_class_instructor_requests ir where ir.class_id=c.id and ir.headquarters_id=p_hq and ir.instructor_id=c.instructor_id order by ir.created_at desc,ir.id limit 1),
  'schedule_mode',c.schedule_mode,'starts_at',c.starts_at,'ends_at',c.ends_at,'format',c.format,
  'capacity',c.capacity,'status',c.status,'registration_status',c.registration_status,'revision',ep.revision,
  'application_count',(select count(*) from academy2_access.event_attendees(p_hq,c.id)),
  'applicant_names',(select coalesce(jsonb_agg(name order by id),'[]'::jsonb) from academy2_access.event_attendees(p_hq,c.id))
 ) order by c.starts_at nulls last,c.id),'[]'::jsonb) into result
 from public.academy_classes c join public.academy_courses co on co.id=c.course_id and co.headquarters_id=c.headquarters_id
 left join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id
 left join academy2_access.sales_plan_draft_revisions r on r.draft_id=ep.plan_id and r.revision=ep.plan_revision
 left join public.academy_instructors i on i.id=c.instructor_id and i.headquarters_id=c.headquarters_id
 where c.headquarters_id=p_hq and (p_event is null or c.id=p_event);
 if p_event is not null and jsonb_array_length(result)=0 then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 return case when p_event is null then result else result->0 end;
end $$;

-- A bridge to an already published offering, not a publication mechanism.
create function academy2_access.bind_operation_source(p_hq uuid,p_offering uuid,p_plan uuid,p_revision integer) returns jsonb
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
  or coalesce((r.configuration#>>'{kit,enabled}')::boolean,false)
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

create function academy2_access.operation_view(p_hq uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;a public.academy_offering_applications;j jsonb;self boolean;
begin
 select * into e from academy2_access.operation_enrollments where application_id=p_id and headquarters_id=p_hq;
 select * into a from public.academy_offering_applications where id=e.application_id and headquarters_id=p_hq;
 self:=a.learner_user_id=auth.uid();
 if auth.uid() is null or a.id is null or not exists(select 1 from academy2_access.tenants t where t.headquarters_id=p_hq and t.runtime_enabled) or not (self or academy2_access.can(p_hq,'applications.read')) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 j:=jsonb_build_object('id',a.id,'headquarters_id',p_hq,'sales_plan_id',e.plan_id,'sales_plan_name',a.offering_title,'applicant_name',a.applicant_name,'class_id',e.class_id,'revision',e.revision,
 'completed_at',a.completed_at,'certified_at',e.certification_at,'consent_version',e.consent_version,'consented_at',e.consented_at,
 'next_action',case
 when a.status='pending' and academy2_access.can(p_hq,'payment.confirm') then 'confirm_payment'
 when e.class_id is not null and not exists(select 1 from public.academy_classes c where c.id=e.class_id and c.starts_at is not null) then case when academy2_access.can(p_hq,'applications.operate') then 'confirm_schedule' else 'wait' end
 when a.status='pending' then 'wait'
 when a.completed_at is null then case when academy2_access.can(p_hq,'applications.operate') then 'confirm_completion' else 'wait' end
 when e.certification_at is null and exists(select 1 from academy2_access.sales_plan_draft_revisions r where r.draft_id=e.plan_id and r.revision=e.plan_revision and r.configuration#>>'{after,skill_certification}'='true') then case when academy2_access.can(p_hq,'certification.confirm') then 'review_outcome' else 'wait' end
 else 'done' end);
 if self or academy2_access.can(p_hq,'finance.read') then j:=j||jsonb_build_object('price',a.price,'payment_status',a.status,'payment_method',a.payment_method,'paid_at',a.paid_at);end if;
 return j;
end $$;

create function academy2_access.operations(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(academy2_access.operation_view(p_hq,e.application_id) order by a.created_at desc),'[]'::jsonb) from academy2_access.operation_enrollments e join public.academy_offering_applications a on a.id=e.application_id where e.headquarters_id=p_hq);
end $$;

create function academy2_access.submit_operation(p_offering uuid,p_request uuid,p_name text,p_terms_version text,p_agree boolean,p_expected_price numeric,p_class uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s academy2_access.operation_sources;o public.academy_offerings;r academy2_access.sales_plan_draft_revisions;a public.academy_offering_applications;c public.academy_classes;email text;new_id uuid:=gen_random_uuid();
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'academy2_sign_in_required' using errcode='42501';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null or p_request is null or nullif(btrim(p_name),'') is null or length(p_name)>200 or p_agree is distinct from true then raise exception 'academy2_application_incomplete' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_offering::text,0));
 select * into a from public.academy_offering_applications where learner_user_id=auth.uid() and request_token=p_request;
 if found then
  if a.offering_id<>p_offering or a.applicant_name<>btrim(p_name) or a.price is distinct from p_expected_price or not exists(select 1 from academy2_access.operation_enrollments e where e.application_id=a.id and e.consented_by=auth.uid() and e.consent_version=p_terms_version and e.class_id is not distinct from p_class) then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.operation_view(a.headquarters_id,a.id);
 end if;
 select * into s from academy2_access.operation_sources where offering_id=p_offering;
 select * into o from public.academy_offerings where id=p_offering and headquarters_id=s.headquarters_id for share;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=s.plan_id and revision=s.plan_revision;
 if o.id is null or not exists(select 1 from academy2_access.tenants t where t.headquarters_id=s.headquarters_id and t.runtime_enabled) then raise exception 'academy2_source_unavailable' using errcode='42501';end if;
 if o.status<>'published' or not public.academy_is_publicly_available(o.headquarters_id) or ('bank'=any(o.payment_methods)) is distinct from true or o.purchase_mode<>'all' or o.kind is distinct from r.configuration->>'kind' or o.price is distinct from p_expected_price or p_terms_version is distinct from r.configuration#>>'{terms,version}'
  or o.price is distinct from (r.configuration->>'price')::numeric or o.title is distinct from r.configuration->>'title'
  or o.course_ids is distinct from (select array_agg(value::uuid order by ord) from jsonb_array_elements_text(r.configuration->'course_ids') with ordinality a(value,ord))
  or exists(select 1 from unnest(o.course_ids) target_id where not exists(select 1 from public.academy_courses published_course where published_course.id=target_id and published_course.headquarters_id=o.headquarters_id and published_course.is_published))
 then raise exception 'academy2_publication_or_terms_changed' using errcode='PT409';end if;
 if r.configuration->>'study_style'='materials_only' then
  if p_class is not null then raise exception 'academy2_materials_event_not_needed' using errcode='22023';end if;
 else
  select * into c from public.academy_classes where id=p_class and headquarters_id=s.headquarters_id for update;
  if c.id is null or not c.course_id=any(o.course_ids) or c.registration_status<>'open' or c.status not in('planned','active') or ((r.configuration->'allowed_methods')?c.format) is distinct from true or not exists(select 1 from academy2_access.event_plans ep where ep.class_id=c.id and ep.headquarters_id=s.headquarters_id and ep.plan_id=s.plan_id and ep.plan_revision=s.plan_revision) then raise exception 'academy2_event_not_open' using errcode='22023';end if;
  if c.capacity is not null and c.capacity<=(select count(*) from academy2_access.event_attendees(o.headquarters_id,c.id)) then raise exception 'academy2_event_full' using errcode='22023';end if;
 end if;
 -- The existing snapshot trigger remains authoritative for legacy purchase_snapshot.
 -- V2 configuration is retained by the immutable revision FK below, not added to that legacy JSON.
 insert into academy2_access.submission_permits(application_id,offering_id,actor_id,request_id,transaction_id) values(new_id,p_offering,auth.uid(),p_request,txid_current());
 insert into public.academy_offering_applications(id,offering_id,headquarters_id,learner_user_id,request_token,applicant_name,applicant_email,offering_title,course_ids,course_snapshot,price,currency,payment_method)
 values(new_id,o.id,o.headquarters_id,auth.uid(),p_request,btrim(p_name),email,o.title,o.course_ids,r.course_snapshot,o.price,o.currency,'bank');
 insert into academy2_access.operation_enrollments(application_id,headquarters_id,plan_id,plan_revision,class_id,consent_version,consent_body,consented_at,consented_by)
 values(new_id,s.headquarters_id,s.plan_id,s.plan_revision,p_class,p_terms_version,r.configuration#>>'{terms,body}',clock_timestamp(),auth.uid());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(s.headquarters_id,auth.uid(),'application.submit',new_id);
 return academy2_access.operation_view(s.headquarters_id,new_id);
end $$;

create function academy2_access.operation_command(p_hq uuid,p_id uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;a public.academy_offering_applications;cmd academy2_access.operation_commands;r academy2_access.sales_plan_draft_revisions;permission text;
begin
 permission:=case p_action when 'confirm_payment' then 'payment.confirm' when 'confirm_completion' then 'applications.operate' when 'confirm_certification' then 'certification.confirm' else null end;
 if permission is null or not academy2_access.can(p_hq,permission) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k<>'review_note') then raise exception 'academy2_invalid_command' using errcode='22023';end if;
 select * into e from academy2_access.operation_enrollments where application_id=p_id and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_application_unavailable' using errcode='42501';end if;
 select * into cmd from academy2_access.operation_commands where request_id=p_request;
 if found then
  if cmd.application_id<>p_id or cmd.actor_id<>auth.uid() or cmd.action<>p_action or cmd.expected_revision<>p_expected or cmd.input<>p_input then raise exception 'academy2_command_conflict' using errcode='PT409';end if;
  return academy2_access.operation_view(p_hq,p_id);
 end if;
 if e.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into a from public.academy_offering_applications where id=p_id and headquarters_id=p_hq for update;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision;
 if p_action='confirm_payment' and (a.status<>'pending' or a.payment_method<>'bank') then raise exception 'academy2_payment_not_pending' using errcode='22023';end if;
 if p_action in('confirm_completion','confirm_certification') and (a.status<>'paid' or nullif(btrim(p_input->>'review_note'),'') is null or length(p_input->>'review_note')>2000) then raise exception 'academy2_review_required' using errcode='22023';end if;
 if p_action='confirm_completion' and (a.completed_at is not null or (e.class_id is not null and not exists(select 1 from public.academy_classes c where c.id=e.class_id and c.headquarters_id=p_hq and c.starts_at is not null and c.status<>'cancelled'))) then raise exception 'academy2_completion_not_ready' using errcode='22023';end if;
 if p_action='confirm_certification' and (a.completed_at is null or e.certification_at is not null or (r.configuration#>>'{after,skill_certification}')::boolean is distinct from true) then raise exception 'academy2_certification_not_ready' using errcode='22023';end if;
 insert into academy2_access.operation_commands(request_id,application_id,actor_id,action,expected_revision,input,transaction_id) values(p_request,p_id,auth.uid(),p_action,p_expected,p_input,txid_current());
 if p_action='confirm_payment' then update public.academy_offering_applications set status='paid',paid_at=clock_timestamp(),paid_by=auth.uid() where id=p_id;
 elsif p_action='confirm_completion' then update public.academy_offering_applications set completed_at=clock_timestamp(),completed_by=auth.uid() where id=p_id;
 else update academy2_access.operation_enrollments set certification_at=clock_timestamp(),certification_by=auth.uid(),certification_note=p_input->>'review_note' where application_id=p_id;end if;
 update academy2_access.operation_enrollments set revision=revision+1 where application_id=p_id;
 update academy2_access.operation_commands set transaction_id=null where request_id=p_request;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),p_action,p_id);
 return academy2_access.operation_view(p_hq,p_id);
end $$;

-- Keep legacy provider/manual APIs from mutating a new v2 application outside its command.
create function academy2_access.guard_operation_application() returns trigger
language plpgsql security definer set search_path='' as $$declare command_action text;begin
 if not exists(select 1 from academy2_access.operation_enrollments where application_id=old.id) then return new;end if;
 select action into command_action from academy2_access.operation_commands where application_id=old.id and actor_id=auth.uid() and transaction_id=txid_current();
 if command_action='confirm_payment' then
  if old.status<>'pending' or new.status<>'paid' or new.paid_by is distinct from auth.uid() or new.paid_at is null or (to_jsonb(new)-array['status','paid_at','paid_by']) is distinct from (to_jsonb(old)-array['status','paid_at','paid_by']) then raise exception 'academy2_invalid_payment_transition' using errcode='42501';end if;
 elsif command_action='confirm_completion' then
  if old.status<>'paid' or old.completed_at is not null or new.completed_at is null or new.completed_by is distinct from auth.uid() or (to_jsonb(new)-array['completed_at','completed_by']) is distinct from (to_jsonb(old)-array['completed_at','completed_by']) then raise exception 'academy2_invalid_completion_transition' using errcode='42501';end if;
 else raise exception 'academy2_command_required' using errcode='42501';end if;
 return new;
end $$;
create trigger academy2_operation_application_guard before update on public.academy_offering_applications for each row execute function academy2_access.guard_operation_application();
revoke all on function academy2_access.guard_operation_application() from public,anon,authenticated,service_role;

revoke all on function academy2_access.events(uuid,uuid),academy2_access.bind_operation_source(uuid,uuid,uuid,integer),academy2_access.operation_view(uuid,uuid),academy2_access.operations(uuid),academy2_access.submit_operation(uuid,uuid,text,text,boolean,numeric,uuid),academy2_access.operation_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.events(uuid,uuid),academy2_access.bind_operation_source(uuid,uuid,uuid,integer),academy2_access.operation_view(uuid,uuid),academy2_access.operations(uuid),academy2_access.submit_operation(uuid,uuid,text,text,boolean,numeric,uuid),academy2_access.operation_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
create function public.academy2_events(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.events(p_headquarters_id)$$;
create function public.academy2_event(p_headquarters_id uuid,p_event_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.events(p_headquarters_id,p_event_id)$$;
create function public.academy2_bind_operation_source(p_headquarters_id uuid,p_offering_id uuid,p_plan_id uuid,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.bind_operation_source(p_headquarters_id,p_offering_id,p_plan_id,p_revision)$$;
create function public.academy2_operations(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.operations(p_headquarters_id)$$;
create function public.academy2_operation(p_headquarters_id uuid,p_application_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.operation_view(p_headquarters_id,p_application_id)$$;
create function public.academy2_submit_operation(p_offering_id uuid,p_request_id uuid,p_name text,p_terms_version text,p_agree boolean,p_expected_price numeric,p_class_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.submit_operation(p_offering_id,p_request_id,p_name,p_terms_version,p_agree,p_expected_price,p_class_id)$$;
create function public.academy2_operation_command(p_headquarters_id uuid,p_application_id uuid,p_expected_revision integer,p_request_id uuid,p_action text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.operation_command(p_headquarters_id,p_application_id,p_expected_revision,p_request_id,p_action,p_input)$$;
revoke all on function public.academy2_events(uuid),public.academy2_event(uuid,uuid),public.academy2_bind_operation_source(uuid,uuid,uuid,integer),public.academy2_operations(uuid),public.academy2_operation(uuid,uuid),public.academy2_submit_operation(uuid,uuid,text,text,boolean,numeric,uuid),public.academy2_operation_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.academy2_events(uuid),public.academy2_event(uuid,uuid),public.academy2_bind_operation_source(uuid,uuid,uuid,integer),public.academy2_operations(uuid),public.academy2_operation(uuid,uuid),public.academy2_submit_operation(uuid,uuid,text,text,boolean,numeric,uuid),public.academy2_operation_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
