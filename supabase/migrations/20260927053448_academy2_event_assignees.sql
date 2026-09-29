-- Candidate only: scoped operational assignees; no legacy row is migrated or overwritten.
-- Connect-certified instructor requests remain fail-closed until verified instructor accounts are connected.
-- Explicit external staff directory. Never infer external status from an unconfirmed certification.
create table academy2_access.external_event_instructors (
 id uuid primary key default gen_random_uuid(),headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 name text not null check(length(btrim(name)) between 1 and 200),active boolean not null default true
);
alter table academy2_access.external_event_instructors enable row level security;
revoke all on academy2_access.external_event_instructors from public,anon,authenticated,service_role;
create table academy2_access.event_assignees (
 class_id uuid primary key references public.academy_classes(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 revision integer not null check(revision>0),
 kind text not null check(kind in('headquarters','external')),
 staff_user_id uuid references auth.users(id) on delete restrict,
 external_instructor_id uuid references academy2_access.external_event_instructors(id) on delete restrict,
 changed_by uuid not null references auth.users(id),changed_at timestamptz not null default now(),
 check((kind='headquarters' and staff_user_id is not null and external_instructor_id is null) or (kind='external' and staff_user_id is null and external_instructor_id is not null))
);
create table academy2_access.event_assignee_commands (
 request_id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 class_id uuid not null references public.academy_classes(id),actor_id uuid not null references auth.users(id),
 expected_revision integer not null,input jsonb not null,created_at timestamptz not null default now()
);
alter table academy2_access.event_assignees enable row level security;
alter table academy2_access.event_assignee_commands enable row level security;
revoke all on academy2_access.event_assignees,academy2_access.event_assignee_commands from public,anon,authenticated,service_role;
create function academy2_access.event_assignee_view(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff jsonb;external_staff jsonb;current_assignment jsonb;
begin
 if not academy2_access.can(p_hq,'applications.read') or not exists(select 1 from public.academy_classes c join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id where c.id=p_event and c.headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ')) order by m.user_id),'[]'::jsonb) into staff from academy2_access.memberships m left join public.profiles p on p.user_id=m.user_id where m.headquarters_id=p_hq and m.active;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name) order by i.id),'[]'::jsonb) into external_staff from academy2_access.external_event_instructors i where i.headquarters_id=p_hq and i.active;
 select jsonb_build_object('revision',a.revision,'kind',a.kind,'assigneeId',coalesce(a.staff_user_id,a.external_instructor_id),'name',case when a.kind='headquarters' then coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ') else i.name end) into current_assignment from academy2_access.event_assignees a left join public.profiles p on p.user_id=a.staff_user_id left join academy2_access.external_event_instructors i on i.id=a.external_instructor_id and i.headquarters_id=a.headquarters_id where a.class_id=p_event and a.headquarters_id=p_hq;
 return jsonb_build_object('assignment',current_assignment,'staff',staff,'external',external_staff,'certified','[]'::jsonb,'certifiedHold','講師本人のカード決済登録と依頼受付の確認を接続しています。');
end $$;
create function academy2_access.set_event_assignee(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_kind text,p_assignee uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes;a academy2_access.event_assignees;cmd academy2_access.event_assignee_commands;input jsonb:=jsonb_build_object('kind',p_kind,'assignee_id',p_assignee);
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_expected<0 or p_assignee is null or p_kind is null or p_kind not in('headquarters','external') then raise exception 'academy2_invalid_assignee' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,37));
 select * into cmd from academy2_access.event_assignee_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.class_id<>p_event or cmd.actor_id<>auth.uid() or cmd.expected_revision<>p_expected or cmd.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.event_assignee_view(p_hq,p_event);
 end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if not found or not exists(select 1 from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if c.status not in('planned','active') or c.instructor_id is not null or exists(select 1 from public.academy_class_instructor_requests where class_id=c.id and headquarters_id=p_hq and status in('requested','accepted')) then raise exception 'academy2_existing_assignment_preserved' using errcode='22023';end if;
 select * into a from academy2_access.event_assignees where class_id=p_event for update;
 if coalesce(a.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 if p_kind='headquarters' and not exists(select 1 from academy2_access.memberships where headquarters_id=p_hq and user_id=p_assignee and active) then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
 if p_kind='external' and not exists(select 1 from academy2_access.external_event_instructors where id=p_assignee and headquarters_id=p_hq and active) then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
 insert into academy2_access.event_assignees(class_id,headquarters_id,revision,kind,staff_user_id,external_instructor_id,changed_by)
 values(p_event,p_hq,p_expected+1,p_kind,case when p_kind='headquarters' then p_assignee end,case when p_kind='external' then p_assignee end,auth.uid())
 on conflict(class_id) do update set revision=excluded.revision,kind=excluded.kind,staff_user_id=excluded.staff_user_id,external_instructor_id=excluded.external_instructor_id,changed_by=excluded.changed_by,changed_at=now();
 insert into academy2_access.event_assignee_commands values(p_request,p_hq,p_event,auth.uid(),p_expected,input,now());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.assignee.saved',p_event);
 return academy2_access.event_assignee_view(p_hq,p_event);
end $$;
revoke all on function academy2_access.event_assignee_view(uuid,uuid),academy2_access.set_event_assignee(uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_assignee_view(uuid,uuid),academy2_access.set_event_assignee(uuid,uuid,integer,uuid,text,uuid) to authenticated;
create function public.academy2_event_assignees(p_headquarters_id uuid,p_event_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.event_assignee_view(p_headquarters_id,p_event_id)$$;
create function public.academy2_set_event_assignee(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_kind text,p_assignee_id uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.set_event_assignee(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_kind,p_assignee_id)$$;
revoke all on function public.academy2_event_assignees(uuid,uuid),public.academy2_set_event_assignee(uuid,uuid,integer,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.academy2_event_assignees(uuid,uuid),public.academy2_set_event_assignee(uuid,uuid,integer,uuid,text,uuid) to authenticated;
-- Proposed fee only, scoped to an existing 2.0 event request. Never executes a transfer.
create table academy2_access.instructor_request_fee_drafts (
 request_id uuid primary key references public.academy_class_instructor_requests(id) on delete restrict,
 revision integer not null check(revision>0),amount_yen bigint not null check(amount_yen>=0),
 changed_by uuid not null references auth.users(id),changed_at timestamptz not null default now()
);
alter table academy2_access.instructor_request_fee_drafts enable row level security;
revoke all on academy2_access.instructor_request_fee_drafts from public,anon,authenticated,service_role;
create function academy2_access.request_fee_view(p_hq uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;fee academy2_access.instructor_request_fee_drafts;
begin
 select * into q from public.academy_class_instructor_requests where id=p_request and headquarters_id=p_hq;
 if q.id is null or not exists(select 1 from academy2_access.event_plans where class_id=q.class_id and headquarters_id=p_hq) or not (academy2_access.can(p_hq,'finance.read') or academy2_access.can(p_hq,'teacher_fee.edit',q.id) or exists(select 1 from public.academy_instructors i join academy2_access.tenants t on t.headquarters_id=i.headquarters_id and t.runtime_enabled where i.id=q.instructor_id and i.headquarters_id=p_hq and i.user_id=auth.uid())) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into fee from academy2_access.instructor_request_fee_drafts where request_id=q.id;
 return jsonb_build_object('requestId',q.id,'revision',coalesce(fee.revision,0),'amountYen',fee.amount_yen,'requestStatus',q.status,'editable',q.status='requested' and academy2_access.can(p_hq,'teacher_fee.edit',q.id),'paymentExecutionAvailable',false);
end $$;
create function academy2_access.save_request_fee(p_hq uuid,p_request uuid,p_expected integer,p_amount bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;fee academy2_access.instructor_request_fee_drafts;
begin
 if not academy2_access.can(p_hq,'teacher_fee.edit',p_request) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into q from public.academy_class_instructor_requests where id=p_request and headquarters_id=p_hq for update;
 if q.id is null or not exists(select 1 from academy2_access.event_plans where class_id=q.class_id and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if q.status<>'requested' or p_amount is null or p_amount<0 or p_expected is null or p_expected<0 then raise exception 'academy2_invalid_fee' using errcode='22023';end if;
 select * into fee from academy2_access.instructor_request_fee_drafts where request_id=q.id for update;
 if coalesce(fee.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 insert into academy2_access.instructor_request_fee_drafts values(q.id,p_expected+1,p_amount,auth.uid(),now()) on conflict(request_id) do update set revision=excluded.revision,amount_yen=excluded.amount_yen,changed_by=excluded.changed_by,changed_at=excluded.changed_at;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'instructor_request.fee_draft.saved',q.id);
 return academy2_access.request_fee_view(p_hq,q.id);
end $$;
revoke all on function academy2_access.request_fee_view(uuid,uuid),academy2_access.save_request_fee(uuid,uuid,integer,bigint) from public,anon,authenticated,service_role;
grant execute on function academy2_access.request_fee_view(uuid,uuid),academy2_access.save_request_fee(uuid,uuid,integer,bigint) to authenticated;
create function public.academy2_request_fee(p_headquarters_id uuid,p_request_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.request_fee_view(p_headquarters_id,p_request_id)$$;
create function public.academy2_save_request_fee(p_headquarters_id uuid,p_request_id uuid,p_expected_revision integer,p_amount_yen bigint) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_request_fee(p_headquarters_id,p_request_id,p_expected_revision,p_amount_yen)$$;
revoke all on function public.academy2_request_fee(uuid,uuid),public.academy2_save_request_fee(uuid,uuid,integer,bigint) from public,anon,service_role;
grant execute on function public.academy2_request_fee(uuid,uuid),public.academy2_save_request_fee(uuid,uuid,integer,bigint) to authenticated;
-- Feed the existing approved event list; do not leave saved staff invisible there.
create function academy2_access.events_with_assignees(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb;result jsonb;
begin
 base:=academy2_access.events(p_hq);
 select coalesce(jsonb_agg(item||jsonb_build_object('instructor_name',coalesce(item->>'instructor_name',case when a.kind='headquarters' then coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ') else ex.name end)) order by ordinal),'[]'::jsonb) into result
 from jsonb_array_elements(base) with ordinality rows(item,ordinal)
 left join academy2_access.event_assignees a on a.class_id=(item->>'id')::uuid and a.headquarters_id=p_hq
 left join public.profiles p on p.user_id=a.staff_user_id
 left join academy2_access.external_event_instructors ex on ex.id=a.external_instructor_id and ex.headquarters_id=p_hq;
 return result;
end $$;
revoke all on function academy2_access.events_with_assignees(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.events_with_assignees(uuid) to authenticated;
create or replace function public.academy2_events(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.events_with_assignees(p_headquarters_id)$$;
