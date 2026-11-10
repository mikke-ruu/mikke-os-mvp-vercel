-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-participants.local.sql
-- LOCAL CANDIDATE ONLY. No production migration or deployment.
begin;
create table academy2_access.hq_internal_notes(
 request_id uuid primary key, headquarters_id uuid not null,
 subject text not null, actor_id uuid not null, body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.hq_internal_notes enable row level security;
revoke all on academy2_access.hq_internal_notes from public,anon,authenticated,service_role;
create table academy2_access.hq_payment_corrections(
 request_id uuid primary key, headquarters_id uuid not null, application_id uuid not null,
 actor_id uuid not null, expected_revision integer not null, before_state jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.hq_payment_corrections enable row level security;
revoke all on academy2_access.hq_payment_corrections from public,anon,authenticated,service_role;
create table academy2_access.hq_payment_correction_permits(
 application_id uuid primary key, actor_id uuid not null, transaction_id bigint not null,
 old_row jsonb not null, new_row jsonb not null
);
alter table academy2_access.hq_payment_correction_permits enable row level security;
revoke all on academy2_access.hq_payment_correction_permits from public,anon,authenticated,service_role;

-- No caller can manufacture this permit. Both immutable guards require an exact
-- authorized command, transaction, actor and complete pre/post row match.
create function academy2_access.has_payment_correction_permit(p_old jsonb,p_new jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy2_access.hq_payment_correction_permits p
 where p.application_id=(p_old->>'id')::uuid and p.actor_id=auth.uid() and p.transaction_id=txid_current()
 and p.old_row=p_old and p.new_row=p_new)
$$;
revoke all on function academy2_access.has_payment_correction_permit(jsonb,jsonb) from public,anon,authenticated,service_role;

do $patch$
declare def text; old text; replacement text; target regprocedure;
begin
 target:='academy2_access.operation_command(uuid,uuid,integer,uuid,text,jsonb)'::regprocedure;
 def:=pg_get_functiondef(target);
 old:=$old$if p_action in('confirm_completion','confirm_certification') and (a.status<>'paid' or nullif(btrim(p_input->>'review_note'),'') is null or length(p_input->>'review_note')>2000) then raise exception 'academy2_review_required' using errcode='22023';end if;$old$;
 replacement:=$new$if p_input ? 'review_note' and (jsonb_typeof(p_input->'review_note') is distinct from 'string' or length(p_input->>'review_note')>2000) then raise exception 'academy2_invalid_note' using errcode='22023';end if;
 if p_action='confirm_completion' and a.status<>'paid' then raise exception 'academy2_review_required' using errcode='22023';end if;
 if p_action='confirm_certification' and (a.status<>'paid' or nullif(btrim(p_input->>'review_note'),'') is null or length(p_input->>'review_note')>2000) then raise exception 'academy2_review_required' using errcode='22023';end if;$new$;
 if position(old in def)=0 then raise exception 'unrecognized completion contract';end if;
 execute replace(def,old,replacement);
 foreach target in array array['academy2_access.guard_operation_application()'::regprocedure,'private.academy_guard_offering_application()'::regprocedure] loop
  def:=pg_get_functiondef(target);
  if position('begin' in def)=0 then raise exception 'unrecognized application guard';end if;
  execute overlay(def placing $new$begin
 if academy2_access.has_payment_correction_permit(to_jsonb(old),to_jsonb(new)) then return new;end if;$new$ from position('begin' in def) for 5);
 end loop;
end $patch$;

-- Preserve original list scope and field redaction, including historical rows.
create function public.academy2_hq_application_cards(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; row jsonb; result jsonb:='[]'; a public.academy_offering_applications; image text; person text;
begin
 rows:=public.academy2_hq_applications(p_headquarters_id);
 for row in select value from jsonb_array_elements(rows) loop
  a:=null;image:=null;person:=null;
  select * into a from public.academy_offering_applications where id=(row->>'applicationId')::uuid and headquarters_id=p_headquarters_id;
  if a.id is not null then
   person:='user:'||a.learner_user_id::text;
   image:=coalesce(a.purchase_snapshot->>'main_image_url',a.purchase_snapshot->>'thumbnail_url',a.course_snapshot#>>'{0,main_image_url}',a.course_snapshot#>>'{0,thumbnail_url}');
   if nullif(image,'') is null then select coalesce(to_jsonb(o)->>'main_image_url',to_jsonb(o)->>'thumbnail_url') into image from public.academy_offerings o where o.id=a.offering_id and o.headquarters_id=p_headquarters_id;end if;
   if nullif(image,'') is null then select coalesce(b->>'url',b->>'image_url') into image from public.academy_offerings o cross join lateral jsonb_array_elements(o.lp_blocks) b where o.id=a.offering_id and o.headquarters_id=p_headquarters_id and b->>'type' in('image','hero') and coalesce(b->>'url',b->>'image_url','')<>'' limit 1;end if;
   if nullif(image,'') is null then
    select coalesce(to_jsonb(c)->>'thumbnail_url',to_jsonb(c)->>'main_image_url',to_jsonb(c)#>>'{feature_settings,marketing,images,0}') into image
    from public.academy_courses c where c.headquarters_id=p_headquarters_id and c.id=any(a.course_ids)
    order by array_position(a.course_ids,c.id) limit 1;
   end if;
  else
   select 'user:'||user_id::text into person from public.academy_applications where id=(row->>'applicationId')::uuid and headquarters_id=p_headquarters_id;
  end if;
  if person is null then person:='unlinked:'||(row->>'applicationId');end if;
  if image !~ '^(https?://|/[^/])' then image:=null;end if;
  result:=result||jsonb_build_array(row||jsonb_build_object('thumbnailUrl',nullif(image,''),'participantKey',person));
 end loop;
 return result;
end $$;

create function academy2_access.hq_note_history(p_hq uuid,p_subject text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.request_id,'action','note','note',n.body,'at',n.created_at,
 'actor',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(to_jsonb(p)->>'handle',''),'本部スタッフ')) order by n.created_at desc,n.request_id),'[]')
 from academy2_access.hq_internal_notes n left join public.profiles p on p.id=n.actor_id
 where n.headquarters_id=p_hq and n.subject=p_subject
$$;
revoke all on function academy2_access.hq_note_history(uuid,text) from public,anon,authenticated,service_role;

create function public.academy2_hq_application_workspace(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; history jsonb; row jsonb; person text; cancel_ok boolean:=false; a public.academy_offering_applications;e academy2_access.operation_enrollments;
begin
 result:=public.academy2_hq_application_with_shipping(p_headquarters_id,p_application_id);
 select * into a from public.academy_offering_applications where id=p_application_id and headquarters_id=p_headquarters_id;
 person:=case when a.learner_user_id is not null then 'user:'||a.learner_user_id::text else 'unlinked:'||p_application_id::text end;
 row:=jsonb_build_object('participantKey',person);
 select * into e from academy2_access.operation_enrollments where application_id=p_application_id and headquarters_id=p_headquarters_id;
 -- No payment correction after shipping, attendance start, completion or certification.
 cancel_ok:=coalesce(e.application_id is not null and academy2_access.can(p_headquarters_id,'payment.confirm') and academy2_access.can(p_headquarters_id,'finance.read')
 and a.status='paid' and a.payment_method in('bank','onsite','external') and a.completed_at is null and e.certification_at is null
 and exists(select 1 from academy2_access.operation_commands where application_id=a.id and action='confirm_payment')
 and not exists(select 1 from academy2_access.hq_shipping where application_id=a.id and shipped_at is not null)
 and not exists(select 1 from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision and configuration#>>'{kit,recipient}'='instructor' and configuration#>'{kit,enabled}'='true'::jsonb)
 and not exists(select 1 from public.academy_classes c where c.id=e.class_id and academy2_access.effective_schedule_start(a.id,c.starts_at)<=clock_timestamp()),false);
 select coalesce(jsonb_agg(item order by item->>'at' desc,item->>'id'),'[]') into history from (
  select jsonb_build_object('id',request_id,'action',action,'note',input->>'review_note','at',c.created_at,'actor',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(to_jsonb(p)->>'handle',''),'本部スタッフ')) item
  from academy2_access.operation_commands c left join public.profiles p on p.id=c.actor_id
  where c.application_id=p_application_id and (c.action<>'confirm_payment' or academy2_access.can(p_headquarters_id,'finance.read'))
  union all select jsonb_build_object('id',request_id,'action',action,'at',c.created_at,'actor',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(to_jsonb(p)->>'handle',''),'本部スタッフ'))
  from academy2_access.hq_shipping_commands c left join public.profiles p on p.id=c.actor_id where c.application_id=p_application_id
  union all select jsonb_build_object('id',request_id,'action','undo_payment','at',c.created_at,'actor',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(to_jsonb(p)->>'handle',''),'本部スタッフ'))
  from academy2_access.hq_payment_corrections c left join public.profiles p on p.id=c.actor_id where c.application_id=p_application_id and academy2_access.can(p_headquarters_id,'finance.read')
  union all select value from jsonb_array_elements(academy2_access.hq_note_history(p_headquarters_id,'application:'||p_application_id::text))
  union all select jsonb_build_object('id',p_application_id,'action','application_received','at',result#>>'{summary,appliedAt}','actor','申込受付')
 ) h;
 return result||jsonb_build_object('summary',(result->'summary')||jsonb_build_object('participantKey',row->'participantKey','thumbnailUrl',row->'thumbnailUrl'),
 'workspace',jsonb_build_object('history',history,'canWriteNote',academy2_access.can(p_headquarters_id,'applications.operate'),'canUndoPayment',cancel_ok));
end $$;

create function public.academy2_hq_participants(p_headquarters_id uuid,p_participant text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; result jsonb; entry jsonb;
begin
 rows:=public.academy2_hq_application_cards(p_headquarters_id);
 select coalesce(jsonb_agg(item order by item->>'lastAppliedAt' desc,item->>'key'),'[]') into result from (
  select jsonb_build_object('key',r->>'participantKey','name',(array_agg(r->>'applicantName' order by r->>'appliedAt' desc,r->>'applicationId'))[1],
  'lastAppliedAt',max(r->>'appliedAt'),'applications',jsonb_agg(r order by r->>'appliedAt' desc,r->>'applicationId'),
  'completedCount',count(*) filter(where nullif(r->>'completedAt','') is not null or r->>'completed'='true')) item
  from jsonb_array_elements(rows) r group by r->>'participantKey'
 ) grouped;
 if p_participant is null then return result;end if;
 select value into entry from jsonb_array_elements(result) where value->>'key'=p_participant;
 if entry is null then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 return entry||jsonb_build_object('contactEmail',coalesce(public.academy2_hq_application(p_headquarters_id,(entry#>>'{applications,0,applicationId}')::uuid)#>>'{headquarters,contactEmail}',public.academy2_hq_application(p_headquarters_id,(entry#>>'{applications,0,applicationId}')::uuid)#>>'{legacy,contactEmail}',public.academy2_hq_application(p_headquarters_id,(entry#>>'{applications,0,applicationId}')::uuid)#>>'{instructor,view,contact,email}'),'notes',academy2_access.hq_note_history(p_headquarters_id,p_participant),'canWriteNote',academy2_access.can(p_headquarters_id,'applications.operate'));
end $$;

create function public.academy2_hq_save_note(p_headquarters_id uuid,p_subject text,p_request_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior academy2_access.hq_internal_notes;
begin
 if auth.uid() is null or academy2_access.can(p_headquarters_id,'applications.operate') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request_id is null or p_body is null or length(btrim(p_body)) not between 1 and 2000 then raise exception 'academy2_invalid_note' using errcode='22023';end if;
 if p_subject like 'application:%' then
  perform public.academy2_hq_application(p_headquarters_id,substr(p_subject,13)::uuid);
 else
  perform public.academy2_hq_participants(p_headquarters_id,p_subject);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,684));
 select * into prior from academy2_access.hq_internal_notes where request_id=p_request_id;
 if found then
  if prior.headquarters_id<>p_headquarters_id or prior.subject<>p_subject or prior.actor_id<>auth.uid() or prior.body<>btrim(p_body) then raise exception 'academy2_note_conflict' using errcode='PT409';end if;
 else
  insert into academy2_access.hq_internal_notes(request_id,headquarters_id,subject,actor_id,body) values(p_request_id,p_headquarters_id,p_subject,auth.uid(),btrim(p_body));
 end if;
 return academy2_access.hq_note_history(p_headquarters_id,p_subject);
end $$;

create function public.academy2_hq_undo_payment(p_headquarters_id uuid,p_application_id uuid,p_expected_revision integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;a public.academy_offering_applications;prior academy2_access.hq_payment_corrections; result jsonb; new_row jsonb;
begin
 if auth.uid() is null or academy2_access.can(p_headquarters_id,'payment.confirm') is distinct from true or academy2_access.can(p_headquarters_id,'finance.read') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null then raise exception 'academy2_invalid_command' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,685));
 select * into e from academy2_access.operation_enrollments where application_id=p_application_id and headquarters_id=p_headquarters_id for update;
 if not found then raise exception 'academy2_scope_mismatch' using errcode='42501';end if;
 select * into prior from academy2_access.hq_payment_corrections where request_id=p_request_id;
 if found then
  if prior.headquarters_id<>p_headquarters_id or prior.application_id<>p_application_id or prior.actor_id<>auth.uid() or prior.expected_revision<>p_expected_revision then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return public.academy2_hq_application_workspace(p_headquarters_id,p_application_id);
 end if;
 if e.revision<>p_expected_revision then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into a from public.academy_offering_applications where id=p_application_id and headquarters_id=p_headquarters_id for update;
 -- Serialize with shipment recording; the enrollment lock also serializes HQ commands.
 perform 1 from academy2_access.hq_shipping where application_id=p_application_id for update;
 perform 1 from public.academy_classes where id=e.class_id for update;
 result:=public.academy2_hq_application_workspace(p_headquarters_id,p_application_id);
 if (result#>>'{workspace,canUndoPayment}')::boolean is distinct from true then raise exception 'academy2_payment_correction_locked' using errcode='22023';end if;
 new_row:=to_jsonb(a)||jsonb_build_object('status','pending','paid_at',null,'paid_by',null);
 insert into academy2_access.hq_payment_corrections(request_id,headquarters_id,application_id,actor_id,expected_revision,before_state) values(p_request_id,p_headquarters_id,p_application_id,auth.uid(),p_expected_revision,to_jsonb(a));
 insert into academy2_access.hq_payment_correction_permits(application_id,actor_id,transaction_id,old_row,new_row) values(a.id,auth.uid(),txid_current(),to_jsonb(a),new_row);
 update public.academy_offering_applications set status='pending',paid_at=null,paid_by=null where id=a.id;
 delete from academy2_access.hq_payment_correction_permits where application_id=a.id;
 update academy2_access.operation_enrollments set revision=revision+1 where application_id=a.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_headquarters_id,auth.uid(),'undo_payment',a.id);
 return public.academy2_hq_application_workspace(p_headquarters_id,p_application_id);
end $$;

revoke all on function public.academy2_hq_application_cards(uuid),public.academy2_hq_application_workspace(uuid,uuid),public.academy2_hq_participants(uuid,text),public.academy2_hq_save_note(uuid,text,uuid,text),public.academy2_hq_undo_payment(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_hq_application_cards(uuid),public.academy2_hq_application_workspace(uuid,uuid),public.academy2_hq_participants(uuid,text),public.academy2_hq_save_note(uuid,text,uuid,text),public.academy2_hq_undo_payment(uuid,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
