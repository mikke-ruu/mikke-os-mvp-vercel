-- MIGRATION CANDIDATE: requires target/ACL review before production.
-- Candidate only. Existing invitation rows, memberships and app permissions are preserved.
create table public.mikke_invitation_mail_delivery(
 delivery_key text primary key check(delivery_key ~ '^[0-9a-f]{64}$'),
 app_key text not null check(app_key in('academy','team-works')),
 invitation_id uuid not null,fingerprint text not null,
 status text not null default 'sending' check(status in('sending','sent','unknown')),
 provider_id text,created_at timestamptz not null default now(),sent_at timestamptz
);
alter table public.mikke_invitation_mail_delivery enable row level security;
revoke all on public.mikke_invitation_mail_delivery from public,anon,authenticated,service_role;
grant select,insert,update on public.mikke_invitation_mail_delivery to service_role;

-- Internal read-only bridge. Never infer "no old sends" from a REST schema-cache error.
create function public.mikke_invitation_previous_delivery(p_delivery_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_delivery_key is null or p_delivery_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_delivery_key';end if;
 if to_regclass('public.team_works_invitation_mail_delivery') is null then return null;end if;
 execute 'select jsonb_build_object(''status'',status) from public.team_works_invitation_mail_delivery where delivery_key=$1' into result using p_delivery_key;
 return result;
end $$;
revoke all on function public.mikke_invitation_previous_delivery(text) from public,anon,authenticated,service_role;
grant execute on function public.mikke_invitation_previous_delivery(text) to service_role;

create table academy2_access.email_invitation_acceptances(
 invitation_id uuid primary key references academy2_access.staff_invitations(id) on delete restrict,
 user_id uuid not null references auth.users(id),accepted_at timestamptz not null default now()
);
alter table academy2_access.email_invitation_acceptances enable row level security;
revoke all on academy2_access.email_invitation_acceptances from public,anon,authenticated,service_role;

create function academy2_access.email_invitation_manager(p_hq uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from academy2_access.memberships m
 join academy2_access.tenants t on t.headquarters_id=m.headquarters_id and t.runtime_enabled
 join public.academy_headquarters h on h.id=m.headquarters_id
 where m.headquarters_id=p_hq and m.user_id=p_user and m.active
 and (m.role='owner' or (m.role='administrator' and h.owner_user_id=p_user)));
$$;
revoke all on function academy2_access.email_invitation_manager(uuid,uuid) from public,anon,authenticated,service_role;

create function public.academy2_can_email_invite_staff(p_headquarters_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select academy2_access.email_invitation_manager(p_headquarters_id,auth.uid());
$$;
create function public.academy2_email_staff_invitation_list(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not academy2_access.email_invitation_manager(p_headquarters_id,auth.uid()) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',recipient_email,'role',role,'status',status,'expires_at',expires_at) order by created_at desc),'[]') from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and channel='email');
end $$;
create function public.academy2_create_email_staff_invitation(p_headquarters_id uuid,p_email text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();v_email text:=lower(btrim(p_email));invitation academy2_access.staff_invitations%rowtype;
begin
 if not academy2_access.email_invitation_manager(p_headquarters_id,actor) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'academy2_email_unverified';end if;
 if v_email is null or length(v_email)>320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in('administrator','learning_operator','course_editor','headquarters_teacher','external_teacher') then raise exception 'academy2_invalid_invitation';end if;
 -- Serialize creation by HQ/v_email. Neither expiry nor retry silently replaces an old invite.
 perform pg_advisory_xact_lock(hashtextextended(p_headquarters_id::text||'/'||v_email,771));
 perform 1 from academy2_access.tenants where headquarters_id=p_headquarters_id and runtime_enabled for share;
 if not found then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if exists(select 1 from academy2_access.memberships m join auth.users u on u.id=m.user_id where m.headquarters_id=p_headquarters_id and lower(btrim(u.email))=v_email) then raise exception 'academy2_staff_membership_exists';end if;
 if exists(select 1 from auth.users u where u.id=actor and lower(btrim(u.email))=v_email) then raise exception 'academy2_staff_self_invitation';end if;
 select * into invitation from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and channel='email' and recipient_email=v_email and status='pending' for update;
 if found then
  if invitation.role<>p_role or invitation.expires_at<=now() then raise exception 'academy2_staff_pending_conflict';end if;
  return jsonb_build_object('id',invitation.id,'status',invitation.status);
 end if;
 insert into academy2_access.staff_invitations(headquarters_id,invited_by,recipient_email,role,channel,delivery_status)
 values(p_headquarters_id,actor,v_email,p_role,'email','queued') returning * into invitation;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_headquarters_id,actor,'staff.email_invited',invitation.id);
 return jsonb_build_object('id',invitation.id,'status',invitation.status);
end $$;
create function public.academy2_cancel_email_staff_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invitation academy2_access.staff_invitations%rowtype;
begin
 select * into invitation from academy2_access.staff_invitations where id=p_invitation_id and channel='email' for update;
 if invitation.id is null or not academy2_access.email_invitation_manager(invitation.headquarters_id,auth.uid()) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if invitation.status='cancelled' then return;end if;
 if invitation.status<>'pending' then raise exception 'academy2_staff_invitation_not_pending';end if;
 update academy2_access.staff_invitations set status='cancelled',responded_at=now() where id=invitation.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(invitation.headquarters_id,auth.uid(),'staff.email_cancelled',invitation.id);
end $$;
create function public.academy2_email_invitation_context(p_invitation_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare invitation academy2_access.staff_invitations%rowtype;actor uuid:=auth.uid();v_email text;confirmed timestamptz;manager boolean;person_active boolean;running boolean;title text;
begin
 if actor is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select lower(btrim(u.email)),u.email_confirmed_at into v_email,confirmed from auth.users u where u.id=actor;
 if confirmed is null or v_email is null or v_email='' then return jsonb_build_object('opaque','email_unverified');end if;
 select * into invitation from academy2_access.staff_invitations where id=p_invitation_id and channel='email';
 if invitation.id is null then return jsonb_build_object('opaque','unavailable');end if;
 manager:=academy2_access.email_invitation_manager(invitation.headquarters_id,actor);
 if not manager and invitation.recipient_email<>v_email then return jsonb_build_object('opaque','mismatch');end if;
 select t.runtime_enabled,h.name into running,title from academy2_access.tenants t join public.academy_headquarters h on h.id=t.headquarters_id where t.headquarters_id=invitation.headquarters_id;
 person_active:=exists(select 1 from academy2_access.email_invitation_acceptances a join academy2_access.memberships m on m.headquarters_id=invitation.headquarters_id and m.user_id=a.user_id and m.active and m.role=invitation.role where a.invitation_id=invitation.id and a.user_id=actor);
 return jsonb_build_object('id',invitation.id,'email',invitation.recipient_email,'title',title,'sender',title,'role',invitation.role,'roleLabel',case invitation.role when 'administrator' then '本部運営担当' when 'learning_operator' then '受講運営担当' when 'course_editor' then '講座編集担当' when 'headquarters_teacher' then '本部講師' when 'external_teacher' then '外部講師' end,'status',invitation.status,'expiresAt',invitation.expires_at,'active',coalesce(running,false) and academy2_access.email_invitation_manager(invitation.headquarters_id,invitation.invited_by),'recipientActive',person_active,'canManage',manager,'destination','/academy/h/'||invitation.headquarters_id::text||'/manage');
end $$;
create function public.academy2_respond_email_staff_invitation(p_invitation_id uuid,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation academy2_access.staff_invitations%rowtype;actor uuid:=auth.uid();v_email text;confirmed timestamptz;
begin
 if actor is null or p_response is null or p_response not in('accepted','declined') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select lower(btrim(u.email)),u.email_confirmed_at into v_email,confirmed from auth.users u where u.id=actor;
 if confirmed is null then raise exception 'academy2_email_unverified' using errcode='42501';end if;
 select * into invitation from academy2_access.staff_invitations where id=p_invitation_id and channel='email' and recipient_email=v_email for update;
 if invitation.id is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 perform 1 from academy2_access.tenants where headquarters_id=invitation.headquarters_id and runtime_enabled for share;
 if not found or not academy2_access.email_invitation_manager(invitation.headquarters_id,invitation.invited_by) then raise exception 'academy2_staff_unavailable';end if;
 if invitation.status='accepted' and p_response='accepted' and exists(select 1 from academy2_access.email_invitation_acceptances where invitation_id=invitation.id and user_id=actor) then return jsonb_build_object('id',invitation.id,'status','accepted');end if;
 if invitation.status<>'pending' or invitation.expires_at<=now() or not exists(select 1 from public.profiles where user_id=actor) then raise exception 'academy2_staff_unavailable';end if;
 if p_response='accepted' then
  -- Serialize v_email acceptances by HQ/user; the membership primary key also protects other channels.
  perform pg_advisory_xact_lock(hashtextextended(invitation.headquarters_id::text||'/'||actor::text,772));
  if exists(select 1 from academy2_access.memberships where headquarters_id=invitation.headquarters_id and user_id=actor) then raise exception 'academy2_staff_membership_exists';end if;
  insert into academy2_access.memberships(headquarters_id,user_id,role,active) values(invitation.headquarters_id,actor,invitation.role,true);
  insert into academy2_access.email_invitation_acceptances(invitation_id,user_id) values(invitation.id,actor);
 end if;
 update academy2_access.staff_invitations set status=p_response,responded_at=now() where id=invitation.id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(invitation.headquarters_id,actor,'staff.email_'||p_response,invitation.id);
 return jsonb_build_object('id',invitation.id,'status',p_response);
end $$;
revoke all on function public.academy2_can_email_invite_staff(uuid),public.academy2_email_staff_invitation_list(uuid),public.academy2_create_email_staff_invitation(uuid,text,text),public.academy2_cancel_email_staff_invitation(uuid),public.academy2_email_invitation_context(uuid),public.academy2_respond_email_staff_invitation(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.academy2_can_email_invite_staff(uuid),public.academy2_email_staff_invitation_list(uuid),public.academy2_create_email_staff_invitation(uuid,text,text),public.academy2_cancel_email_staff_invitation(uuid),public.academy2_email_invitation_context(uuid),public.academy2_respond_email_staff_invitation(uuid,text) to authenticated;
