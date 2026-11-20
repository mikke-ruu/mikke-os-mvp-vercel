-- Preserve existing member/learner scope; add HQ-scoped guest mail status.
begin;
alter function public.academy2_hq_mail_status(uuid,uuid[]) rename to academy2_hq_mail_status_before_guest;
alter function public.academy2_hq_mail_followup(uuid,uuid,integer,text) rename to academy2_hq_mail_followup_before_guest;
alter function public.academy2_application_mail_content(uuid,uuid) rename to academy2_application_mail_content_before_guest;
revoke all on function public.academy2_hq_mail_status_before_guest(uuid,uuid[]),public.academy2_hq_mail_followup_before_guest(uuid,uuid,integer,text),public.academy2_application_mail_content_before_guest(uuid,uuid) from public,anon,authenticated,service_role;

create function public.academy2_hq_mail_status(p_hq uuid,p_applications uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare normal_ids uuid[];result jsonb;guest_rows jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.read') then raise exception 'forbidden' using errcode='42501';end if;
 if cardinality(p_applications)>200 or exists(select 1 from unnest(p_applications) i where not exists(select 1 from public.academy_offering_applications where id=i and headquarters_id=p_hq) and not exists(select 1 from academy2_access.guest_applications where id=i and headquarters_id=p_hq)) then raise exception 'scope' using errcode='42501';end if;
 select coalesce(array_agg(id),'{}') into normal_ids from public.academy_offering_applications where headquarters_id=p_hq and id=any(p_applications);
 result:=public.academy2_hq_mail_status_before_guest(p_hq,normal_ids);
 select coalesce(jsonb_agg(jsonb_build_object('applicationId',a.id,'paidAt',case when academy2_access.can(p_hq,'finance.read') then a.paid_at end,
 'receipt',jsonb_build_object('state',a.receipt_state,'sentAt',case when d.state='sent' then d.finished_at end),
 'participation',case when j.id is null then jsonb_build_object('state','unrecorded') else jsonb_build_object('id',j.id,'state',j.state,'sentAt',j.sent_at,'contactedAt',j.contacted_at,'revision',j.revision) end,
 'canManage',academy2_access.can(p_hq,'applications.operate'))),'[]') into guest_rows
 from academy2_access.guest_applications a left join academy2_access.guest_receipt_deliveries d on d.application_id=a.id
 left join lateral(select * from academy2_access.guest_participation_mail where application_id=a.id order by created_at desc,id desc limit 1) j on true
 where a.headquarters_id=p_hq and a.id=any(p_applications);
 return result||guest_rows;
end$$;

create function public.academy2_hq_mail_followup(p_hq uuid,p_job uuid,p_expected integer,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare j academy2_access.guest_participation_mail;a academy2_access.guest_applications;
begin
 if not exists(select 1 from academy2_access.guest_participation_mail where id=p_job) then perform public.academy2_hq_mail_followup_before_guest(p_hq,p_job,p_expected,p_action);return;end if;
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.operate') then raise exception 'forbidden' using errcode='42501';end if;
 select * into j from academy2_access.guest_participation_mail where id=p_job and headquarters_id=p_hq;
 if not found then raise exception 'scope' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=j.application_id and headquarters_id=p_hq for update;
 select * into j from academy2_access.guest_participation_mail where id=p_job for update;
 if j.revision<>p_expected then raise exception 'conflict' using errcode='PT409';end if;
 if p_action='retry' and j.state='failed' and a.paid_at=j.payment_at then update academy2_access.guest_participation_mail set state='queued',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
 elsif p_action='contacted' and j.state in('failed','unknown') and j.contacted_at is null then update academy2_access.guest_participation_mail set contacted_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=p_job;
 else raise exception 'invalid_state' using errcode='22023';end if;
end$$;

create function public.academy2_application_mail_content(p_hq uuid,p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a academy2_access.guest_applications;payload jsonb;message jsonb;receipt jsonb;original jsonb;
begin
 select * into a from academy2_access.guest_applications where id=p_application and headquarters_id=p_hq;
 if a.id is null then
  original:=public.academy2_application_mail_content_before_guest(p_hq,p_application);
  if jsonb_typeof(original->'participation')='object' then select j.message into message from academy2_access.participation_mail j where application_id=p_application and headquarters_id=p_hq order by created_at desc,id desc limit 1;end if;
  return original||jsonb_build_object('participationMessage',message);
 end if;
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.read') then raise exception 'scope' using errcode='42501';end if;
 select d.message into receipt from academy2_access.guest_receipt_deliveries d where application_id=a.id;
 select j.payload,j.message into payload,message from academy2_access.guest_participation_mail j where application_id=a.id order by created_at desc,id desc limit 1;
 return jsonb_build_object('receiptMessage',receipt,'participationMessage',message,'participation',payload,'links',jsonb_build_object('plan',payload->>'planPath','home',payload->>'homePath'));
end$$;
revoke all on function public.academy2_hq_mail_status(uuid,uuid[]),public.academy2_hq_mail_followup(uuid,uuid,integer,text),public.academy2_application_mail_content(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_hq_mail_status(uuid,uuid[]),public.academy2_hq_mail_followup(uuid,uuid,integer,text),public.academy2_application_mail_content(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
