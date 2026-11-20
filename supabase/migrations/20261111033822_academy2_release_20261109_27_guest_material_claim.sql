-- Additive guest account binding. Never convert or duplicate a purchase.
begin;
create table academy2_access.guest_application_claims(
 application_id uuid primary key references academy2_access.guest_applications(id),
 user_id uuid references auth.users(id) on delete set null,
 verified_email text not null,claimed_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.guest_application_claims enable row level security;
revoke all on academy2_access.guest_application_claims from public,anon,authenticated,service_role;
create index guest_application_claims_user on academy2_access.guest_application_claims(user_id);
create table academy2_access.guest_material_receipt_tokens(
 application_id uuid primary key references academy2_access.guest_applications(id),
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.guest_material_receipt_tokens enable row level security;
revoke all on academy2_access.guest_material_receipt_tokens from public,anon,authenticated,service_role;

create function academy2_access.guard_guest_claim_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.user_id is null and old.user_id is not null
 and new.application_id=old.application_id and new.verified_email=old.verified_email and new.claimed_at=old.claimed_at
 and not exists(select 1 from auth.users where id=old.user_id) then return new;end if;
 raise exception 'guest_claim_immutable' using errcode='42501';
end$$;
create trigger guest_claim_immutable before update on academy2_access.guest_application_claims for each row execute function academy2_access.guard_guest_claim_identity();

create function academy2_access.verified_guest_actor() returns uuid
language sql stable security definer set search_path='' as $$
 select u.id from auth.users u join auth.sessions s on s.user_id=u.id and s.id::text=(auth.jwt()->>'session_id')
 where u.id=auth.uid() and u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null
 and u.deleted_at is null and not coalesce(u.is_anonymous,false) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now())
 and exists(select 1 from auth.refresh_tokens r where r.session_id=s.id and r.revoked=false);
$$;
create function academy2_access.guest_receipt_token_matches(p_application uuid,p_token text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(p_token ~ '^[a-f0-9]{64}$' and exists(select 1 from academy2_access.guest_material_receipt_tokens
 where application_id=p_application and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')),false);
$$;
create function academy2_access.prepare_guest_material_token(p_application uuid,p_session text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;enabled boolean;
begin
 if auth.role() is distinct from 'service_role' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'guest_server_only' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=p_application and session_hash=p_session for update;
 if a.id is null then raise exception 'guest_application_unavailable' using errcode='42501';end if;
 select coalesce(r.configuration#>>'{materials,enabled}'='true',false) into enabled from academy2_access.sales_plan_draft_revisions r where r.draft_id=a.plan_id and r.revision=a.plan_revision;
 if enabled is distinct from true then return jsonb_build_object('enabled',false,'prepared',false);end if;
 insert into academy2_access.guest_material_receipt_tokens(application_id,token_hash) values(a.id,p_hash) on conflict do nothing;
 return jsonb_build_object('enabled',true,'prepared',exists(select 1 from academy2_access.guest_material_receipt_tokens where application_id=a.id and token_hash=p_hash));
end$$;
create function academy2_access.guest_material_receipt_path(p_application uuid) returns text
language sql stable security definer set search_path='' as $$
 select '/academy/guest-materials?application='||p_application::text||'#receive='||x.token
 from academy2_access.guest_receipt_deliveries d
 cross join lateral(select substring(d.message->>'text' from '/academy/guest-materials[?]application='||p_application::text||'#receive=([a-f0-9]{64})') token) x
 where d.application_id=p_application and academy2_access.guest_receipt_token_matches(p_application,x.token);
$$;

create function academy2_access.guest_material_state(p_application uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare a academy2_access.guest_applications;conf jsonb;
begin
 select * into a from academy2_access.guest_applications where id=p_application;
 if a.id is null or not exists(select 1 from academy2_access.tenants where headquarters_id=a.headquarters_id and runtime_enabled)
 or academy_owner_optin_private.service_available(a.headquarters_id) is distinct from true then return 'unavailable';end if;
 select r.configuration into conf from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts p on p.id=r.draft_id and p.headquarters_id=a.headquarters_id where r.draft_id=a.plan_id and r.revision=a.plan_revision;
 if conf#>>'{materials,enabled}' is distinct from 'true' then return 'unavailable';end if;
 if a.paid_at is null then return 'awaiting_payment';end if;
 if conf#>>'{materials,starts}'='after_attendance' and conf->>'study_style'='instructor' and a.completed_at is null then return 'awaiting_completion';end if;
 if (conf#>>'{materials,starts}'='from_start' or (conf->>'study_style'='instructor' and conf#>>'{materials,starts}'='after_attendance' and a.completed_at is not null)) is distinct from true then return 'unavailable';end if;
 if not academy2_access.material_access_period_open(a.paid_at,a.completed_at,conf,now()) then return 'expired';end if;
 if not exists(select 1 from academy2_access.plan_material_publications m where m.plan_id=a.plan_id and m.plan_revision=a.plan_revision and m.headquarters_id=a.headquarters_id) then return 'unavailable';end if;
 return 'available';
end$$;
create function academy2_access.my_guest_applications(p_application uuid default null,p_before_at timestamptz default null,p_before_id uuid default null,p_receipt_token text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=academy2_access.verified_guest_actor();actor_email text;result jsonb;
begin
 if actor is null then raise exception 'guest_verified_account_required' using errcode='42501';end if;
 if (p_before_at is null) is distinct from (p_before_id is null) then raise exception 'guest_invalid_cursor' using errcode='22023';end if;
 select lower(btrim(u.email)) into actor_email from auth.users u where u.id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('applicationId',r.id,'planName',r.title,'appliedAt',r.created_at,'claimed',r.claimed,'state',academy2_access.guest_material_state(r.id)) order by r.created_at desc,r.id desc),'[]'::jsonb) into result
 from (select a.id,a.created_at,a.snapshot#>>'{intake,offering,title}' title,c.application_id is not null claimed
 from academy2_access.guest_applications a join academy2_access.sales_plan_draft_revisions v on v.draft_id=a.plan_id and v.revision=a.plan_revision
 left join academy2_access.guest_application_claims c on c.application_id=a.id
 where (c.user_id=actor or (c.application_id is null and lower(btrim(a.email))=actor_email and p_application=a.id and academy2_access.guest_receipt_token_matches(a.id,p_receipt_token)))
 and v.configuration#>>'{materials,enabled}'='true' and (p_application is null or a.id=p_application)
 and (p_before_at is null or (a.created_at,a.id)<(p_before_at,p_before_id)) order by a.created_at desc,a.id desc limit 25) r;
 return result;
end$$;
create function academy2_access.claim_guest_application(p_application uuid,p_receipt_token text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=academy2_access.verified_guest_actor();actor_email text;a academy2_access.guest_applications;c academy2_access.guest_application_claims;
begin
 if actor is null then raise exception 'guest_verified_account_required' using errcode='42501';end if;
 select lower(btrim(u.email)) into actor_email from auth.users u where u.id=actor;
 select * into a from academy2_access.guest_applications where id=p_application for update;
 select * into c from academy2_access.guest_application_claims where application_id=p_application;
 if a.id is null or (c.application_id is not null and c.user_id is distinct from actor)
 or (c.application_id is null and (lower(btrim(a.email)) is distinct from actor_email or not academy2_access.guest_receipt_token_matches(a.id,p_receipt_token))) then raise exception 'guest_application_unavailable' using errcode='42501';end if;
 if c.application_id is null then insert into academy2_access.guest_application_claims(application_id,user_id,verified_email) values(a.id,actor,actor_email);end if;
 return academy2_access.my_guest_applications(p_application);
end$$;
create function academy2_access.my_guest_materials(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=academy2_access.verified_guest_actor();a academy2_access.guest_applications;result jsonb;
begin
 if actor is null or not exists(select 1 from academy2_access.guest_application_claims where application_id=p_application and user_id=actor)
 or academy2_access.guest_material_state(p_application)<>'available' then raise exception 'guest_material_unavailable' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=p_application;
 select jsonb_agg(jsonb_build_object('courseId',m.course_id,'courseName',m.course_name,'materialRevision',m.material_revision,'blocks',m.blocks) order by m.position) into result
 from academy2_access.plan_material_publications m where m.plan_id=a.plan_id and m.plan_revision=a.plan_revision and m.headquarters_id=a.headquarters_id;
 if result is null then raise exception 'guest_material_unavailable' using errcode='42501';end if;
 return jsonb_build_object('applicationId',a.id,'planName',a.snapshot#>>'{intake,offering,title}','courses',result);
end$$;

create function public.academy2_prepare_guest_material_token(p_application_id uuid,p_session text,p_token_hash text) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.prepare_guest_material_token(p_application_id,p_session,p_token_hash)$$;
create function public.academy2_my_guest_applications(p_application_id uuid default null,p_before_at timestamptz default null,p_before_id uuid default null,p_receipt_token text default null) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.my_guest_applications(p_application_id,p_before_at,p_before_id,p_receipt_token)$$;
create function public.academy2_claim_guest_application(p_application_id uuid,p_receipt_token text default null) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.claim_guest_application(p_application_id,p_receipt_token)$$;
create function public.academy2_my_guest_materials(p_application_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.my_guest_materials(p_application_id)$$;
revoke all on function academy2_access.guard_guest_claim_identity(),academy2_access.verified_guest_actor(),academy2_access.guest_material_state(uuid),academy2_access.guest_receipt_token_matches(uuid,text),academy2_access.guest_material_receipt_path(uuid),academy2_access.prepare_guest_material_token(uuid,text,text),
 academy2_access.my_guest_applications(uuid,timestamptz,uuid,text),academy2_access.claim_guest_application(uuid,text),academy2_access.my_guest_materials(uuid),
 public.academy2_prepare_guest_material_token(uuid,text,text),public.academy2_my_guest_applications(uuid,timestamptz,uuid,text),public.academy2_claim_guest_application(uuid,text),public.academy2_my_guest_materials(uuid)
 from public,anon,authenticated,service_role;
grant execute on function academy2_access.prepare_guest_material_token(uuid,text,text),public.academy2_prepare_guest_material_token(uuid,text,text) to service_role;
grant execute on function academy2_access.my_guest_applications(uuid,timestamptz,uuid,text),academy2_access.claim_guest_application(uuid,text),academy2_access.my_guest_materials(uuid),
 public.academy2_my_guest_applications(uuid,timestamptz,uuid,text),public.academy2_claim_guest_application(uuid,text),public.academy2_my_guest_materials(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
