-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-hq-teachers.local.sql
-- LOCAL CANDIDATE ONLY. No production rollout or email dispatch.
begin;
alter table academy2_access.memberships drop constraint memberships_role_check;
alter table academy2_access.memberships add constraint memberships_role_check check(role in ('owner','administrator','learning_operator','course_editor','headquarters_teacher'));
alter table academy2_access.staff_invitations drop constraint staff_invitations_role_check;
alter table academy2_access.staff_invitations add constraint staff_invitations_role_check check(role in ('administrator','learning_operator','course_editor','headquarters_teacher'));

-- Keep the existing application/payment/correction permission gates unchanged.
create function public.academy2_hq_application_overview(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;event_id uuid;person text;items text;kit jsonb;material_method text;
begin
 result:=public.academy2_hq_fulfillment_workspace(p_headquarters_id,p_application_id);
 event_id:=(result#>>'{headquarters,event,id}')::uuid;
 if event_id is not null then
  select case when a.kind='headquarters' then '本部 ／ '||coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ')
    when a.kind='external' then '外部講師 ／ '||coalesce(x.name,'担当者未設定')
    when c.instructor_id is not null then '講師 ／ '||coalesce(nullif(ip.display_name,''),ip.handle,'登録済み講師') else '担当者未設定' end
   into person from public.academy_classes c
   left join academy2_access.event_assignees a on a.class_id=c.id and a.headquarters_id=c.headquarters_id
   left join public.profiles p on p.user_id=a.staff_user_id
   left join academy2_access.external_event_instructors x on x.id=a.external_instructor_id and x.headquarters_id=c.headquarters_id
   left join public.academy_instructors i on i.id=c.instructor_id and i.headquarters_id=c.headquarters_id
   left join public.profiles ip on ip.user_id=i.user_id
   where c.id=event_id and c.headquarters_id=p_headquarters_id;
  select r.configuration->'kit',coalesce(s.method,f.method,ep.kit_method) into kit,material_method from academy2_access.event_plans ep
   join academy2_access.sales_plan_draft_revisions r on r.draft_id=ep.plan_id and r.revision=ep.plan_revision
   left join academy2_access.application_material_snapshots s on s.application_id=p_application_id and s.headquarters_id=p_headquarters_id and s.class_id=ep.class_id
   left join academy2_access.event_material_fulfillment f on f.class_id=ep.class_id and f.headquarters_id=p_headquarters_id
   where ep.class_id=event_id and ep.headquarters_id=p_headquarters_id;
 end if;
 items:=case when result#>>'{headquarters,shipping,required}'='true' or (kit->>'enabled'='true' and material_method in('shipping','learner_shipping','designated_shipping')) then '教材・材料の発送あり'
   when kit->>'enabled'='true' then '教材・材料あり（会場などで受け渡し）'
   when kit->>'enabled'='false' then '教材・材料なし' else '教材・材料の設定記録なし' end;
 if result->'headquarters'<>'null'::jsonb then
  result:=jsonb_set(result,'{workspace}',coalesce(result->'workspace','{}'::jsonb)||jsonb_build_object('eventFacts',jsonb_build_object('assignee',coalesce(person,'担当者未設定'),'materials',items)));
 end if;
 return result;
end $$;
revoke all on function public.academy2_hq_application_overview(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_hq_application_overview(uuid,uuid) to authenticated;

-- An active, explicitly assigned staff member sees only their own teaching schedule.
-- No financial/contact/address/form/note fields or mutations are exposed.
create function public.academy2_my_hq_teaching(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from academy2_access.memberships m join academy2_access.tenants t using(headquarters_id)
  where m.headquarters_id=p_headquarters_id and m.user_id=auth.uid() and m.active and t.runtime_enabled) then
  raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'startsAt',c.starts_at,'endsAt',c.ends_at,
   'format',c.format,'venueName',c.venue_name,'meetingUrl',c.meeting_url,'status',c.status,
   'participants',(select coalesce(jsonb_agg(jsonb_build_object('name',names.name) order by names.name,names.id),'[]')
    from academy2_access.event_attendees(p_headquarters_id,c.id) names))
   order by c.starts_at nulls last,c.id),'[]') into result
 from academy2_access.event_assignees a join public.academy_classes c on c.id=a.class_id and c.headquarters_id=a.headquarters_id
 where a.headquarters_id=p_headquarters_id and a.kind='headquarters' and a.staff_user_id=auth.uid();
 return result;
end $$;
revoke all on function public.academy2_my_hq_teaching(uuid) from public,anon,service_role;
grant execute on function public.academy2_my_hq_teaching(uuid) to authenticated;

create function academy2_access.staff_manager(p_hq uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_actor is not null and exists(select 1 from academy2_access.memberships m join academy2_access.tenants t using(headquarters_id)
 join public.academy_headquarters h on h.id=m.headquarters_id
 where m.headquarters_id=p_hq and m.user_id=p_actor and m.active and t.runtime_enabled
 and (m.role='owner' or (m.role='administrator' and h.owner_user_id=p_actor)))
$$;
revoke all on function academy2_access.staff_manager(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function academy2_access.staff_invite(p_headquarters_id uuid,p_channel text,p_target text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); person public.profiles%rowtype; existing academy2_access.staff_invitations%rowtype; result academy2_access.staff_invitations%rowtype; target text;
begin
 if actor is null or not academy2_access.staff_manager(p_headquarters_id,actor) then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 if p_role is null or p_role not in('administrator','learning_operator','course_editor','headquarters_teacher') or p_channel is null or p_channel not in('mikke_id','email') then raise exception 'academy2_staff_invalid';end if;
 perform 1 from academy2_access.tenants where headquarters_id=p_headquarters_id and runtime_enabled for update;
 if not found then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 target:=lower(btrim(p_target));
 if p_channel='mikke_id' then
  target:=regexp_replace(target,'^@','');
  select * into person from public.profiles where lower(handle)=target;
  if person.user_id is null or person.user_id=actor then raise exception 'academy2_staff_target_unavailable';end if;
  if exists(select 1 from academy2_access.memberships where headquarters_id=p_headquarters_id and user_id=person.user_id) then raise exception 'academy2_staff_membership_exists';end if;
  select * into existing from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and target_user_id=person.user_id and status='pending';
 else
  if target is null or length(target)>320 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'academy2_staff_invalid';end if;
  if exists(select 1 from auth.users where id=actor and lower(btrim(email))=target) then raise exception 'academy2_staff_target_unavailable';end if;
  if exists(select 1 from auth.users u join academy2_access.memberships m on m.user_id=u.id where m.headquarters_id=p_headquarters_id and lower(btrim(u.email))=target) then raise exception 'academy2_staff_membership_exists' using errcode='22023';end if;
  select * into existing from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and recipient_email=target and status='pending';
 end if;
 if existing.id is not null then
  if existing.role<>p_role or existing.expires_at<=now() then raise exception 'academy2_staff_pending_conflict';end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'delivery_status',existing.delivery_status,'expires_at',existing.expires_at);
 end if;
 insert into academy2_access.staff_invitations(headquarters_id,invited_by,target_user_id,target_profile_id,recipient_email,role,channel,delivery_status)
 values(p_headquarters_id,actor,person.user_id,person.id,case when p_channel='email' then target end,p_role,p_channel,case when p_channel='email' then 'queued' else 'not_required' end) returning * into result;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_headquarters_id,actor,'staff.invited',result.id);
 return jsonb_build_object('id',result.id,'status',result.status,'delivery_status',result.delivery_status,'expires_at',result.expires_at);
end $$;

-- Identity-bound invitation lookup. Knowing an invitation UUID never grants access.
create function academy2_access.staff_invitation_for_self(p_id uuid) returns academy2_access.staff_invitations
language plpgsql stable security definer set search_path='' as $$
declare invitation academy2_access.staff_invitations;
begin
 select i.* into invitation from academy2_access.staff_invitations i where i.id=p_id and
 ((i.channel='mikke_id' and i.target_user_id=auth.uid()) or (i.channel='email' and exists
  (select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(btrim(u.email))=i.recipient_email)));
 if invitation.id is null or not academy2_access.staff_manager(invitation.headquarters_id,invitation.invited_by) then
  raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 return invitation;
end $$;
revoke all on function academy2_access.staff_invitation_for_self(uuid) from public,anon,authenticated,service_role;

create function public.academy2_staff_invitation(p_invitation_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i academy2_access.staff_invitations;
begin
 i:=academy2_access.staff_invitation_for_self(p_invitation_id);
 return jsonb_build_object('id',i.id,'headquartersId',i.headquarters_id,'name',(select name from public.academy_headquarters where id=i.headquarters_id),
  'role',i.role,'status',i.status,'expiresAt',i.expires_at,'expired',i.expires_at<=now());
end $$;
revoke all on function public.academy2_staff_invitation(uuid) from public,anon,service_role;
grant execute on function public.academy2_staff_invitation(uuid) to authenticated;

create or replace function academy2_access.staff_respond(p_invitation_id uuid,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();i academy2_access.staff_invitations;
begin
 if actor is null or p_response is null or p_response not in('accepted','declined') then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 -- Match the verified recipient both before and after taking the row lock.
 i:=academy2_access.staff_invitation_for_self(p_invitation_id);
 perform 1 from academy2_access.tenants where headquarters_id=i.headquarters_id and runtime_enabled for share;
 perform 1 from academy2_access.memberships where headquarters_id=i.headquarters_id and user_id=i.invited_by and active for share;
 select * into i from academy2_access.staff_invitations where id=p_invitation_id for update;
 i:=academy2_access.staff_invitation_for_self(p_invitation_id);
 if i.expires_at<=now() then raise exception 'academy2_staff_unavailable' using errcode='22023';end if;
 if i.status=p_response then return jsonb_build_object('id',i.id,'status',i.status);end if;
 if i.status<>'pending' then raise exception 'academy2_staff_unavailable' using errcode='22023';end if;
 if p_response='accepted' then
  if exists(select 1 from academy2_access.memberships where headquarters_id=i.headquarters_id and user_id=actor) then
   raise exception 'academy2_staff_membership_exists' using errcode='22023';end if;
  insert into academy2_access.memberships(headquarters_id,user_id,role,active) values(i.headquarters_id,actor,i.role,true);
 end if;
 update academy2_access.staff_invitations set status=p_response,responded_at=now() where id=i.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(i.headquarters_id,actor,'staff.'||p_response,i.id);
 return jsonb_build_object('id',i.id,'status',p_response);
end $$;

create function public.academy2_staff_directory(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare manager boolean:=academy2_access.staff_manager(p_headquarters_id,auth.uid());
begin
 if academy2_access.my_role(p_headquarters_id) is null or academy2_access.my_role(p_headquarters_id) not in('owner','administrator') then
  raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 return jsonb_build_object('canInvite',manager,'members',(select coalesce(jsonb_agg(jsonb_build_object('name',coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ'),'role',m.role,'active',m.active)),'[]')
  from academy2_access.memberships m left join public.profiles p on p.user_id=m.user_id where m.headquarters_id=p_headquarters_id),
  'invitations',case when manager then (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'status',i.status,'expiresAt',i.expires_at,'expired',i.expires_at<=now(),'target',coalesce(i.recipient_email,p.handle),'channel',i.channel) order by i.created_at desc),'[]')
    from academy2_access.staff_invitations i left join public.profiles p on p.user_id=i.target_user_id where i.headquarters_id=p_headquarters_id) else '[]'::jsonb end);
end $$;
revoke all on function public.academy2_staff_directory(uuid) from public,anon,service_role;
grant execute on function public.academy2_staff_directory(uuid) to authenticated;
commit;
notify pgrst,'reload schema';
