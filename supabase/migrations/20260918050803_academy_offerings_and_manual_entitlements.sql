-- Additive offering sales. Existing course/application/billing APIs remain intact.
-- Authenticated learners only. No email-based identity claims and no Stripe writes.
create table public.academy_offerings (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  title text not null default '',
  kind text not null default '単品講座' check (kind in ('ワークショップ','単品講座','コース','認定講座','全講座','月額レッスン')),
  course_ids uuid[] not null default '{}',
  price numeric not null default 0 check (price >= 0 and price <= 99999999 and price = trunc(price)),
  payment_methods text[] not null default '{bank}' check (cardinality(payment_methods) > 0 and payment_methods <@ array['bank','onsite']::text[]),
  currency text not null default 'JPY' check (currency = 'JPY'),
  purchase_mode text not null default 'all' check (purchase_mode in ('all','staged')),
  stage_prices jsonb not null default '{}' check (jsonb_typeof(stage_prices) = 'object'),
  lp_blocks jsonb not null default '[]' check (jsonb_typeof(lp_blocks) = 'array'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index academy_offerings_hq_idx on public.academy_offerings(headquarters_id,created_at);
create table public.academy_offering_applications (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.academy_offerings(id) on delete restrict,
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  learner_user_id uuid not null references auth.users(id) on delete restrict,
  request_token uuid not null,
  applicant_name text not null,
  applicant_email text not null,
  offering_title text not null,
  course_ids uuid[] not null,
  course_snapshot jsonb not null check (jsonb_typeof(course_snapshot)='array'),
  price numeric not null check (price>=0 and price=trunc(price)),
  currency text not null check(currency='JPY'),
  payment_method text not null check(payment_method in ('bank','onsite')),
  status text not null default 'pending' check(status in ('pending','paid')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(learner_user_id,request_token),
  unique(offering_id,learner_user_id),
  check ((status='pending' and paid_at is null and paid_by is null) or (status='paid' and paid_at is not null and paid_by is not null))
);
create index academy_offering_applications_hq_idx on public.academy_offering_applications(headquarters_id,created_at);
create index academy_offering_applications_learner_idx on public.academy_offering_applications(learner_user_id,created_at);
create table public.academy_offering_application_grants (
  application_id uuid not null references public.academy_offering_applications(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  access_grant_id uuid not null unique references public.academy_course_access_grants(id) on delete restrict,
  primary key(application_id,course_id)
);
alter table public.academy_offerings enable row level security;
alter table public.academy_offering_applications enable row level security;
alter table public.academy_offering_application_grants enable row level security;
revoke all on public.academy_offerings,public.academy_offering_applications,public.academy_offering_application_grants from public,anon,authenticated;
grant select,insert,update on public.academy_offerings to authenticated;
grant select on public.academy_offering_applications,public.academy_offering_application_grants to authenticated;
grant all on public.academy_offerings,public.academy_offering_applications,public.academy_offering_application_grants to service_role;
create policy offering_manager_select on public.academy_offerings for select to authenticated using(private.academy_can_manage_headquarters(headquarters_id));
create policy offering_manager_insert on public.academy_offerings for insert to authenticated with check(created_by=(select auth.uid()) and private.academy_can_manage_headquarters(headquarters_id));
create policy offering_manager_update on public.academy_offerings for update to authenticated using(private.academy_can_manage_headquarters(headquarters_id)) with check(private.academy_can_manage_headquarters(headquarters_id));
create policy offering_application_read on public.academy_offering_applications for select to authenticated using(learner_user_id=(select auth.uid()) or private.academy_can_manage_headquarters(headquarters_id));
create policy offering_grant_read on public.academy_offering_application_grants for select to authenticated using(exists(select 1 from public.academy_offering_applications a where a.id=application_id and (a.learner_user_id=(select auth.uid()) or private.academy_can_manage_headquarters(a.headquarters_id))));

create function private.academy_guard_offering() returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_actor uuid:=auth.uid();
begin
  if v_actor is null or not private.academy_can_manage_headquarters(new.headquarters_id) then raise exception 'offering_forbidden' using errcode='42501'; end if;
  if coalesce(private.academy_headquarters_access_mode(new.headquarters_id),'blocked') not in ('paid','trial_active') then raise exception 'offering_headquarters_read_only'; end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.headquarters_id is distinct from old.headquarters_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then raise exception 'offering_identity_immutable'; end if;
  if tg_op='INSERT' and new.created_by is distinct from v_actor then raise exception 'offering_invalid_creator'; end if;
  if cardinality(new.course_ids)>100 or cardinality(new.course_ids)<>(select count(distinct x) from unnest(new.course_ids) x) then raise exception 'offering_invalid_course_ids'; end if;
  select count(*) into v_count from public.academy_courses c where c.id=any(new.course_ids) and c.headquarters_id=new.headquarters_id;
  if v_count<>cardinality(new.course_ids) then raise exception 'offering_course_scope_mismatch'; end if;
  if length(new.title)>300 or octet_length(new.lp_blocks::text)>2000000 then raise exception 'offering_payload_too_large'; end if;
  if new.status='published' then
    if nullif(btrim(new.title),'') is null or cardinality(new.course_ids)=0 then raise exception 'offering_incomplete'; end if;
    if new.purchase_mode<>'all' or new.kind='月額レッスン' then raise exception 'offering_purchase_mode_not_ready'; end if;
    if not public.academy_is_publicly_available(new.headquarters_id) then raise exception 'offering_headquarters_not_public'; end if;
    -- Publishing offerings cannot activate a plan or start a first-publication trial.
    if exists(select 1 from public.academy_courses c where c.id=any(new.course_ids) and not c.is_published) then raise exception 'offering_course_not_ready'; end if;
  end if;
  new.updated_at:=clock_timestamp(); return new;
end; $$;
revoke all on function private.academy_guard_offering() from public,anon,authenticated,service_role;
create trigger academy_offering_guard before insert or update on public.academy_offerings for each row execute function private.academy_guard_offering();

create function private.academy_guard_offering_application() returns trigger language plpgsql set search_path='' as $$
begin
  if (to_jsonb(new)-array['status','paid_at','paid_by']) is distinct from (to_jsonb(old)-array['status','paid_at','paid_by']) then raise exception 'offering_application_snapshot_immutable'; end if;
  if old.status='paid' and new is distinct from old then raise exception 'offering_payment_immutable'; end if;
  return new;
end; $$;
revoke all on function private.academy_guard_offering_application() from public,anon,authenticated,service_role;
create trigger academy_offering_application_guard before update on public.academy_offering_applications for each row execute function private.academy_guard_offering_application();

-- Only this explicit allowlist is public; never expose lesson content or access settings.
create function public.academy_get_public_offering(p_offering_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',o.id,'headquarters_id',o.headquarters_id,'title',o.title,'kind',o.kind,'course_ids',o.course_ids,'price',o.price,'currency',o.currency,'payment_methods',o.payment_methods,'purchase_mode',o.purchase_mode,'stage_prices',o.stage_prices,'lp_blocks',o.lp_blocks,'status',o.status,'updated_at',o.updated_at,'courses',(
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'subtitle',c.subtitle,'main_image_url',c.main_image_url,'description',c.description,'can_do_after',c.can_do_after,'duration_text',c.duration_text,'kit_contents',c.kit_contents,'requires_kit',c.requires_kit,'price',c.price,'marketing',jsonb_build_object('category',c.feature_settings->'marketing'->'category','images',c.feature_settings->'marketing'->'images','curriculum',c.feature_settings->'marketing'->'curriculum','imageSide',c.feature_settings->'marketing'->'imageSide')) order by array_position(o.course_ids,c.id)),'[]'::jsonb)
    from public.academy_courses c where c.id=any(o.course_ids) and c.headquarters_id=o.headquarters_id and c.is_published
  )) from public.academy_offerings o where o.id=p_offering_id and o.status='published' and public.academy_is_publicly_available(o.headquarters_id)
  and not exists(select 1 from unnest(o.course_ids) x where not exists(select 1 from public.academy_courses c where c.id=x and c.headquarters_id=o.headquarters_id and c.is_published));
$$;
revoke all on function public.academy_get_public_offering(uuid) from public,anon,authenticated;
grant execute on function public.academy_get_public_offering(uuid) to anon,authenticated;

create function public.academy_submit_offering_application(p_offering_id uuid,p_request_token uuid,p_applicant_name text,p_applicant_email text,p_payment_method text,p_expected_price numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_off public.academy_offerings; v_app public.academy_offering_applications; v_snapshot jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'offering_sign_in_required' using errcode='42501'; end if;
  if p_request_token is null or nullif(btrim(p_applicant_name),'') is null or p_applicant_email is null or length(p_applicant_name)>200 or length(p_applicant_email)>320 or p_applicant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'offering_invalid_application'; end if;
  -- Serializes two tabs and retries without exposing another user's request token.
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_offering_id::text,0));
  select * into v_app from public.academy_offering_applications where learner_user_id=v_actor and request_token=p_request_token;
  if found then
    if v_app.offering_id<>p_offering_id then raise exception 'offering_request_token_conflict'; end if;
    return to_jsonb(v_app);
  end if;
  select * into v_app from public.academy_offering_applications where learner_user_id=v_actor and offering_id=p_offering_id;
  if found then return to_jsonb(v_app); end if;
  select * into v_off from public.academy_offerings where id=p_offering_id for share;
  if not found or v_off.status<>'published' or not public.academy_is_publicly_available(v_off.headquarters_id) then raise exception 'offering_not_available'; end if;
  if v_off.purchase_mode<>'all' or v_off.kind='月額レッスン' then raise exception 'offering_purchase_mode_not_ready'; end if;
  if p_expected_price is null or p_expected_price is distinct from v_off.price then raise exception 'offering_price_changed'; end if;
  if p_payment_method is null or not p_payment_method=any(v_off.payment_methods) then raise exception 'offering_payment_method_invalid'; end if;
  -- Lock the course rows so snapshot and publication validation are atomic.
  perform c.id from public.academy_courses c where c.id=any(v_off.course_ids) order by c.id for share;
  select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'main_image_url',c.main_image_url,'learner_access_mode',c.learner_access_mode,'learner_access_days',c.learner_access_days,'learner_access_fixed_end_at',c.learner_access_fixed_end_at) order by array_position(v_off.course_ids,c.id)) into v_snapshot from public.academy_courses c where c.id=any(v_off.course_ids) and c.headquarters_id=v_off.headquarters_id and c.is_published;
  if coalesce(jsonb_array_length(v_snapshot),0)<>cardinality(v_off.course_ids) then raise exception 'offering_course_not_available'; end if;
  if exists(select 1 from jsonb_array_elements(v_snapshot) c where
    (c->>'learner_access_mode' in ('days_after_payment','days_after_enrollment','days_after_completion') and (c->>'learner_access_days' is null or (c->>'learner_access_days')::integer<=0))
    or (c->>'learner_access_mode'='fixed_end' and (c->>'learner_access_fixed_end_at' is null or (c->>'learner_access_fixed_end_at')::timestamptz<=clock_timestamp()))) then raise exception 'offering_access_window_invalid'; end if;
  insert into public.academy_offering_applications(offering_id,headquarters_id,learner_user_id,request_token,applicant_name,applicant_email,offering_title,course_ids,course_snapshot,price,currency,payment_method)
  values(v_off.id,v_off.headquarters_id,v_actor,p_request_token,btrim(p_applicant_name),btrim(p_applicant_email),v_off.title,v_off.course_ids,v_snapshot,v_off.price,v_off.currency,p_payment_method) returning * into v_app;
  return to_jsonb(v_app);
end; $$;
revoke all on function public.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) to authenticated;

create function public.academy_confirm_offering_payment(p_application_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_app public.academy_offering_applications; v_course jsonb; v_course_id uuid; v_grant uuid; v_end timestamptz; v_now timestamptz:=now();
begin
  if v_actor is null then raise exception 'offering_sign_in_required' using errcode='42501'; end if;
  select * into v_app from public.academy_offering_applications where id=p_application_id for update;
  if not found or not private.academy_can_manage_headquarters(v_app.headquarters_id) then raise exception 'offering_forbidden' using errcode='42501'; end if;
  if v_app.status='paid' then return to_jsonb(v_app); end if;
  if coalesce(private.academy_headquarters_access_mode(v_app.headquarters_id),'blocked')<>'paid' then raise exception 'offering_headquarters_read_only'; end if;
  for v_course in select value from jsonb_array_elements(v_app.course_snapshot) loop
    v_course_id:=(v_course->>'id')::uuid;
    if not exists(select 1 from public.academy_courses c where c.id=v_course_id and c.headquarters_id=v_app.headquarters_id) then raise exception 'offering_course_scope_mismatch'; end if;
    case v_course->>'learner_access_mode'
      when 'unlimited' then v_end:=null;
      when 'days_after_payment' then
        if v_course->>'learner_access_days' is null or (v_course->>'learner_access_days')::integer<=0 then raise exception 'offering_access_window_invalid'; end if;
        v_end:=v_now+((v_course->>'learner_access_days')::integer*interval '1 day');
      when 'days_after_enrollment' then
        if v_course->>'learner_access_days' is null or (v_course->>'learner_access_days')::integer<=0 then raise exception 'offering_access_window_invalid'; end if;
        v_end:=v_app.created_at+((v_course->>'learner_access_days')::integer*interval '1 day');
      when 'days_after_completion' then
        if v_course->>'learner_access_days' is null or (v_course->>'learner_access_days')::integer<=0 then raise exception 'offering_access_window_invalid'; end if;
        continue;
      when 'fixed_end' then v_end:=(v_course->>'learner_access_fixed_end_at')::timestamptz;
      else raise exception 'offering_access_mode_not_supported';
    end case;
    if v_end is not null and v_end<=v_now then raise exception 'offering_access_window_expired'; end if;
    insert into public.academy_course_access_grants(headquarters_id,course_id,application_id,learner_user_id,source,status,starts_at,ends_at,created_by_user_id)
    values(v_app.headquarters_id,v_course_id,null,v_app.learner_user_id,'manual','active',v_now,v_end,v_actor) returning id into v_grant;
    insert into public.academy_offering_application_grants(application_id,course_id,access_grant_id) values(v_app.id,v_course_id,v_grant);
  end loop;
  update public.academy_offering_applications set status='paid',paid_at=v_now,paid_by=v_actor where id=v_app.id returning * into v_app;
  return to_jsonb(v_app);
end; $$;
revoke all on function public.academy_confirm_offering_payment(uuid) from public,anon,authenticated;
grant execute on function public.academy_confirm_offering_payment(uuid) to authenticated;

-- Learners can read only the course metadata they purchased; the existing content
-- policies still require an unexpired access grant to read lesson bodies.
create policy offering_learner_course_read on public.academy_courses for select to authenticated using(exists(select 1 from public.academy_offering_applications a where a.learner_user_id=(select auth.uid()) and a.status='paid' and academy_courses.id=any(a.course_ids)));

-- Preserve existing roles and capabilities, adding learner discovery for the new
-- application ledger. Pending applicants can see their status but gain no content.
create or replace function public.academy_list_my_contexts()
returns table (
  academy_id uuid,
  academy_name text,
  academy_handle text,
  roles text[],
  portals text[],
  capabilities text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as user_id
  ), instructor_access as (
    select
      instructor.headquarters_id,
      true as has_instructor,
      bool_or(instructor.is_active = true and instructor.status = 'active') as can_operate
    from public.academy_instructors instructor
    cross join actor
    where instructor.user_id = actor.user_id
      and instructor.registration_status = 'registered'
      and instructor.is_certified = true
    group by instructor.headquarters_id
  ), learner_access as (
    select distinct application.headquarters_id
    from public.academy_applications application
    cross join actor
    where application.user_id = actor.user_id
      and application.status in (
        'paid',
        'kit_pending',
        'kit_preparing',
        'kit_shipped',
        'scheduled',
        'completed',
        'cert_pending',
        'certified',
        'instructor_added'
      )
    union

    select application.headquarters_id
    from public.academy_offering_applications application
    cross join actor
    where application.learner_user_id = actor.user_id
  ), context_roles as (
    select headquarters.id as academy_id, 'owner'::text as role
    from public.academy_headquarters headquarters
    cross join actor
    where headquarters.owner_user_id = actor.user_id

    union

    select member.headquarters_id, member.role
    from public.academy_headquarters_members member
    join public.profiles profile on profile.id = member.member_profile_id
    cross join actor
    where profile.user_id = actor.user_id
      and member.status = 'active'

    union

    select instructor_access.headquarters_id, 'instructor'::text
    from instructor_access

    union

    select learner_access.headquarters_id, 'learner'::text
    from learner_access
  ), grouped as (
    select
      context_roles.academy_id,
      array_agg(context_roles.role order by context_roles.role) as roles,
      bool_or(context_roles.role = 'owner') as is_owner,
      bool_or(context_roles.role = 'administrator') as is_administrator,
      bool_or(context_roles.role = 'course_editor') as is_course_editor,
      bool_or(context_roles.role = 'instructor') as is_instructor,
      bool_or(context_roles.role = 'learner') as is_learner
    from context_roles
    group by context_roles.academy_id
  )
  select
    headquarters.id,
    headquarters.name,
    headquarters.handle,
    grouped.roles,
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'manage' end,
      case when grouped.is_instructor or grouped.is_learner then 'teach' end
    ], null),
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:headquarters:view' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:headquarters:manage' end,
      case when grouped.is_owner then 'academy:members:manage' end,
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:courses:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:instructors:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:applications:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:settings:manage' end,
      case when grouped.is_learner then 'academy:learner_portal:view' end,
      case when grouped.is_instructor then 'academy:instructor_portal:view' end,
      case when grouped.is_instructor then 'academy:instructor_materials:view' end,
      case when coalesce(instructor_access.can_operate, false) then 'academy:instructor:operate' end
    ], null)
  from grouped
  join public.academy_headquarters headquarters on headquarters.id = grouped.academy_id
  left join instructor_access on instructor_access.headquarters_id = grouped.academy_id
  order by headquarters.created_at, headquarters.id;
$$;

revoke all on function public.academy_list_my_contexts() from public, anon;
grant execute on function public.academy_list_my_contexts() to authenticated;
