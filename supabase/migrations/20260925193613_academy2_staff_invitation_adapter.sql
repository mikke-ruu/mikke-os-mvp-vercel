-- Opt-in adapter: reuses existing profiles identity and HQ invitation 14-day window.
-- Legacy invitations/members and instructor-roster invitations are never rewritten.
-- Email stays queued for separately reviewed dispatch; no provider call/token emission.
create table academy2_access.staff_invitations (
 id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 invited_by uuid not null references auth.users(id),
 target_user_id uuid references auth.users(id),
 target_profile_id uuid references public.profiles(id),
 recipient_email text,
 role text not null check(role in ('administrator','learning_operator','course_editor')),
 channel text not null check(channel in ('mikke_id','email')),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 delivery_status text not null check(delivery_status in ('not_required','queued')),
 expires_at timestamptz not null default(now()+interval '14 days'),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check((channel='mikke_id' and target_user_id is not null and target_profile_id is not null and recipient_email is null and delivery_status='not_required') or (channel='email' and recipient_email is not null and target_user_id is null and target_profile_id is null and delivery_status='queued'))
);
alter table academy2_access.staff_invitations enable row level security;
revoke all on academy2_access.staff_invitations from public,anon,authenticated,service_role;
create unique index academy2_staff_pending_user on academy2_access.staff_invitations(headquarters_id,target_user_id) where status='pending' and channel='mikke_id';
create unique index academy2_staff_pending_email on academy2_access.staff_invitations(headquarters_id,recipient_email) where status='pending' and channel='email';

create function academy2_access.staff_invite(p_headquarters_id uuid,p_channel text,p_target text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); person public.profiles%rowtype; existing academy2_access.staff_invitations%rowtype; result academy2_access.staff_invitations%rowtype; target text;
begin
 if actor is null or academy2_access.my_role(p_headquarters_id) is distinct from 'owner' then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 if p_role is null or p_role not in('administrator','learning_operator','course_editor') or p_channel is null or p_channel not in('mikke_id','email') then raise exception 'academy2_staff_invalid';end if;
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

create function academy2_access.staff_respond(p_invitation_id uuid,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation academy2_access.staff_invitations%rowtype;
begin
 if actor is null or p_response is null or p_response not in('accepted','declined') then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 select * into invitation from academy2_access.staff_invitations where id=p_invitation_id and channel='mikke_id' and target_user_id=actor for update;
 if invitation.id is null then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 perform 1 from academy2_access.tenants where headquarters_id=invitation.headquarters_id and runtime_enabled for share;
 if not found or invitation.expires_at<=now() or not exists(select 1 from public.profiles where id=invitation.target_profile_id and user_id=actor) or not exists(select 1 from academy2_access.memberships where headquarters_id=invitation.headquarters_id and user_id=invitation.invited_by and active and role='owner') then raise exception 'academy2_staff_unavailable';end if;
 if invitation.status=p_response then return jsonb_build_object('id',invitation.id,'status',invitation.status);end if;
 if invitation.status<>'pending' then raise exception 'academy2_staff_unavailable';end if;
 if p_response='accepted' then
  if exists(select 1 from academy2_access.memberships where headquarters_id=invitation.headquarters_id and user_id=actor) then raise exception 'academy2_staff_membership_exists';end if;
  insert into academy2_access.memberships(headquarters_id,user_id,role,active) values(invitation.headquarters_id,actor,invitation.role,true);
 end if;
 update academy2_access.staff_invitations set status=p_response,responded_at=now() where id=invitation.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(invitation.headquarters_id,actor,'staff.'||p_response,invitation.id);
 return jsonb_build_object('id',invitation.id,'status',p_response);
end $$;

create function public.academy2_staff_invite(p_headquarters_id uuid,p_channel text,p_target text,p_role text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.staff_invite(p_headquarters_id,p_channel,p_target,p_role)$$;
create function public.academy2_staff_respond(p_invitation_id uuid,p_response text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.staff_respond(p_invitation_id,p_response)$$;
revoke all on function academy2_access.staff_invite(uuid,text,text,text),academy2_access.staff_respond(uuid,text),public.academy2_staff_invite(uuid,text,text,text),public.academy2_staff_respond(uuid,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.staff_invite(uuid,text,text,text),academy2_access.staff_respond(uuid,text),public.academy2_staff_invite(uuid,text,text,text) ,public.academy2_staff_respond(uuid,text) to authenticated;
