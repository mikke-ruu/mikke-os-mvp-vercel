-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-fulfillment-corrections.local.sql
-- LOCAL ONLY: explicit record corrections, never carrier cancellation or refund.
begin;
create table academy2_access.hq_fulfillment_corrections(
 request_id uuid primary key,headquarters_id uuid not null,application_id uuid not null,actor_id uuid not null,
 action text not null,expected_revision integer not null,input jsonb not null,before_state jsonb not null,after_state jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.hq_fulfillment_corrections enable row level security;
revoke all on academy2_access.hq_fulfillment_corrections from public,anon,authenticated,service_role;
create table academy2_access.hq_application_correction_permits(
 application_id uuid primary key,actor_id uuid not null,transaction_id bigint not null,old_row jsonb not null,new_row jsonb not null
);
alter table academy2_access.hq_application_correction_permits enable row level security;
revoke all on academy2_access.hq_application_correction_permits from public,anon,authenticated,service_role;
create function academy2_access.has_application_correction_permit(p_old jsonb,p_new jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy2_access.hq_application_correction_permits p where p.application_id=(p_old->>'id')::uuid
 and p.actor_id=auth.uid() and p.transaction_id=txid_current() and p.old_row=p_old and p.new_row=p_new)
$$;
revoke all on function academy2_access.has_application_correction_permit(jsonb,jsonb) from public,anon,authenticated,service_role;
do $patch$
declare def text; target regprocedure; old text;
begin
 foreach target in array array['academy2_access.guard_operation_application()'::regprocedure,'private.academy_guard_offering_application()'::regprocedure] loop
  def:=pg_get_functiondef(target);
  if position('has_payment_correction_permit' in def)=0 then raise exception 'unrecognized correction guard';end if;
  execute overlay(def placing $new$begin
 if academy2_access.has_application_correction_permit(to_jsonb(old),to_jsonb(new)) then return new;end if;$new$ from position('begin' in def) for 5);
 end loop;
 -- Correcting a manual payment is not inferred from the calendar. Keep shipping,
 -- completion, certification, permission and manual-command checks intact.
 target:='public.academy2_hq_application_workspace(uuid,uuid)'::regprocedure;
 def:=pg_get_functiondef(target);
 old:=$old$and not exists(select 1 from public.academy_classes c where c.id=e.class_id and academy2_access.effective_schedule_start(a.id,c.starts_at)<=clock_timestamp())$old$;
 if position(old in def)=0 then raise exception 'unrecognized payment correction contract';end if;
 execute replace(def,old,'');
end $patch$;

create function public.academy2_hq_fulfillment_workspace(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;history jsonb;e academy2_access.operation_enrollments;a public.academy_offering_applications;s academy2_access.hq_shipping;can_edit boolean;
begin
 result:=public.academy2_hq_application_workspace(p_headquarters_id,p_application_id);
 select * into e from academy2_access.operation_enrollments where application_id=p_application_id and headquarters_id=p_headquarters_id;
 select * into a from public.academy_offering_applications where id=p_application_id and headquarters_id=p_headquarters_id;
 select * into s from academy2_access.hq_shipping where application_id=p_application_id;
 if s.application_id is not null and s.shipped_at is null and a.completed_at is null and result#>>'{summary,tuition,status}'='paid' then
  result:=jsonb_set(result,'{summary,statusLabel}',to_jsonb('発送準備中'::text));
 end if;
 can_edit:=e.application_id is not null and academy2_access.can(p_headquarters_id,'applications.operate');
 select coalesce(jsonb_agg(item order by item->>'at' desc,item->>'id'),'[]') into history from (
  select value item from jsonb_array_elements(result#>'{workspace,history}')
  union all select jsonb_build_object('id',c.request_id,'action',c.action,'at',c.created_at,
  'actor',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(to_jsonb(p)->>'handle',''),'本部スタッフ'),
  'note',case when c.action='edit_shipping' then '追跡番号：'||coalesce(c.before_state#>>'{shipping,tracking_number}','なし')||' → '||coalesce(c.after_state#>>'{shipping,tracking_number}','なし') else null end)
  from academy2_access.hq_fulfillment_corrections c left join public.profiles p on p.id=c.actor_id
  where c.application_id=p_application_id and c.headquarters_id=p_headquarters_id
 ) h;
 return result||jsonb_build_object('summary',(result->'summary')||jsonb_build_object('fulfillment',jsonb_build_object(
 'required',coalesce((result#>>'{headquarters,shipping,required}')::boolean,false),'shipped',coalesce(result#>>'{headquarters,shipping,status}'='shipped',false))),
 'workspace',(result->'workspace')||jsonb_build_object('history',history,
 'canEditShipping',coalesce(can_edit and s.shipped_at is not null,false),
 'canUndoShipping',coalesce(can_edit and s.shipped_at is not null and a.completed_at is null and e.certification_at is null,false),
 'canUndoCompletion',coalesce(can_edit and a.completed_at is not null and e.certification_at is null and exists(select 1 from academy2_access.operation_commands where application_id=a.id and action='confirm_completion'),false)));
end $$;

create function public.academy2_hq_correct_fulfillment(p_headquarters_id uuid,p_application_id uuid,p_expected_revision integer,p_request_id uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;a public.academy_offering_applications;s academy2_access.hq_shipping;m academy2_access.hq_shipment_details;
 prior academy2_access.hq_fulfillment_corrections;before_state jsonb;after_state jsonb;next_row jsonb;carrier text;tracking text;day date;workspace jsonb;
begin
 if auth.uid() is null or academy2_access.can(p_headquarters_id,'applications.operate') is distinct from true or academy2_access.can(p_headquarters_id,'applications.read') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null or p_action is null or p_action not in('edit_shipping','undo_shipping','undo_completion') or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_command' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,689));
 select * into e from academy2_access.operation_enrollments where application_id=p_application_id and headquarters_id=p_headquarters_id for update;
 if not found then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 select * into prior from academy2_access.hq_fulfillment_corrections where request_id=p_request_id;
 if found then
  if prior.headquarters_id<>p_headquarters_id or prior.application_id<>p_application_id or prior.actor_id<>auth.uid() or prior.expected_revision<>p_expected_revision or prior.action<>p_action or prior.input<>p_input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return public.academy2_hq_fulfillment_workspace(p_headquarters_id,p_application_id);
 end if;
 if e.revision<>p_expected_revision then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into a from public.academy_offering_applications where id=p_application_id and headquarters_id=p_headquarters_id for update;
 select * into s from academy2_access.hq_shipping where application_id=p_application_id for update;
 select * into m from academy2_access.hq_shipment_details where application_id=p_application_id;
 before_state:=jsonb_build_object('application',to_jsonb(a),'shipping',to_jsonb(s),'metadata',to_jsonb(m));
 workspace:=public.academy2_hq_fulfillment_workspace(p_headquarters_id,p_application_id);
 if p_action='edit_shipping' then
  if (workspace#>>'{workspace,canEditShipping}')::boolean is distinct from true then raise exception 'academy2_correction_locked' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(p_input) x where x.key not in('date','carrier','trackingNumber') or jsonb_typeof(x.value)<>'string') then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
  carrier:=btrim(p_input->>'carrier');tracking:=btrim(p_input->>'trackingNumber');
  if carrier is null or char_length(carrier) not between 1 and 100 or tracking is null or char_length(tracking)>200 then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
  if carrier not in('japan_post_clickpost','japan_post_letterpack','japan_post_yupack','japan_post_yupacket','yamato','sagawa','untracked') and (carrier not like 'other:%' or char_length(btrim(substr(carrier,7)))=0) then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
  if carrier<>'untracked' and tracking='' or carrier='untracked' and tracking<>'' then raise exception 'academy2_invalid_tracking' using errcode='22023';end if;
  begin day:=(p_input->>'date')::date;exception when others then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end;
  if day is null or not isfinite(day) or day>(clock_timestamp() at time zone 'Asia/Tokyo')::date then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end if;
  update academy2_access.hq_shipping set shipped_at=(day::text||'T00:00:00+09:00')::timestamptz,tracking_number=nullif(tracking,'') where application_id=p_application_id;
  insert into academy2_access.hq_shipment_details(application_id,carrier,shipped_date) values(p_application_id,carrier,day) on conflict(application_id) do update set carrier=excluded.carrier,shipped_date=excluded.shipped_date;
 elsif p_action='undo_shipping' then
  if p_input<>'{}' or (workspace#>>'{workspace,canUndoShipping}')::boolean is distinct from true then raise exception 'academy2_correction_locked' using errcode='22023';end if;
  update academy2_access.hq_shipping set shipped_at=null,shipped_by=null,tracking_number=null where application_id=p_application_id;
  delete from academy2_access.hq_shipment_details where application_id=p_application_id;
 else
  if p_input<>'{}' or (workspace#>>'{workspace,canUndoCompletion}')::boolean is distinct from true then raise exception 'academy2_correction_locked' using errcode='22023';end if;
  next_row:=to_jsonb(a)||jsonb_build_object('completed_at',null,'completed_by',null);
  insert into academy2_access.hq_application_correction_permits(application_id,actor_id,transaction_id,old_row,new_row) values(a.id,auth.uid(),txid_current(),to_jsonb(a),next_row);
  update public.academy_offering_applications set completed_at=null,completed_by=null where id=a.id;
  delete from academy2_access.hq_application_correction_permits where application_id=a.id;
 end if;
 select * into a from public.academy_offering_applications where id=p_application_id;
 select * into s from academy2_access.hq_shipping where application_id=p_application_id;
 select * into m from academy2_access.hq_shipment_details where application_id=p_application_id;
 after_state:=jsonb_build_object('application',to_jsonb(a),'shipping',to_jsonb(s),'metadata',to_jsonb(m));
 insert into academy2_access.hq_fulfillment_corrections(request_id,headquarters_id,application_id,actor_id,action,expected_revision,input,before_state,after_state) values(p_request_id,p_headquarters_id,p_application_id,auth.uid(),p_action,p_expected_revision,p_input,before_state,after_state);
 update academy2_access.operation_enrollments set revision=revision+1 where application_id=p_application_id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_headquarters_id,auth.uid(),p_action,p_application_id);
 return public.academy2_hq_fulfillment_workspace(p_headquarters_id,p_application_id);
end $$;
revoke all on function public.academy2_hq_fulfillment_workspace(uuid,uuid),public.academy2_hq_correct_fulfillment(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.academy2_hq_fulfillment_workspace(uuid,uuid),public.academy2_hq_correct_fulfillment(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
