-- Instructor additions reference HQ offerings; they never copy or replace HQ content.
create table public.academy_instructor_offering_pages (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  offering_id uuid not null references public.academy_offerings(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  profile jsonb not null default '{}' check(jsonb_typeof(profile)='object'),
  lp_blocks jsonb not null default '[]' check(jsonb_typeof(lp_blocks)='array'),
  status text not null default 'draft' check(status in('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offering_id,owner_user_id)
);
create index academy_instructor_offering_pages_hq_idx on public.academy_instructor_offering_pages(headquarters_id);
create table public.academy_instructor_offering_application_links (
  application_id uuid primary key references public.academy_offering_applications(id) on delete restrict,
  page_id uuid not null references public.academy_instructor_offering_pages(id) on delete restrict,
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  learner_user_id uuid not null references auth.users(id) on delete restrict,
  instructor_snapshot jsonb not null check(jsonb_typeof(instructor_snapshot)='object'),
  created_at timestamptz not null default now()
);
alter table public.academy_instructor_offering_pages enable row level security;
alter table public.academy_instructor_offering_application_links enable row level security;
revoke all on public.academy_instructor_offering_pages,public.academy_instructor_offering_application_links from public,anon,authenticated;
grant select on public.academy_instructor_offering_pages,public.academy_instructor_offering_application_links to authenticated;
grant all on public.academy_instructor_offering_pages,public.academy_instructor_offering_application_links to service_role;
create policy instructor_offering_page_read on public.academy_instructor_offering_pages for select to authenticated using(owner_user_id=(select auth.uid()) or private.academy_can_manage_headquarters(headquarters_id));
create policy instructor_offering_link_read on public.academy_instructor_offering_application_links for select to authenticated using(owner_user_id=(select auth.uid()) or learner_user_id=(select auth.uid()) or private.academy_can_manage_headquarters(headquarters_id));

-- A private, transaction-scoped handoff cannot be forged through a client GUC.
create table private.academy_instructor_application_context (
  transaction_id bigint not null,
  actor_id uuid not null,
  offering_id uuid not null,
  page_id uuid not null,
  primary key(transaction_id,actor_id,offering_id)
);
alter table private.academy_instructor_application_context enable row level security;
revoke all on private.academy_instructor_application_context from public,anon,authenticated,service_role;
create function private.academy_guard_instructor_application_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.academy_offering_applications a join public.academy_instructor_offering_application_links l on l.application_id=a.id where a.offering_id=new.offering_id and a.learner_user_id=new.learner_user_id and not exists(select 1 from private.academy_instructor_application_context ctx where ctx.transaction_id=txid_current() and ctx.actor_id=new.learner_user_id and ctx.actor_id=auth.uid() and ctx.offering_id=new.offering_id and ctx.page_id=l.page_id)) then
    raise exception 'instructor_application_continue_original_page';
  end if;
  return new;
end; $$;
revoke all on function private.academy_guard_instructor_application_source() from public,anon,authenticated,service_role;
create trigger academy_instructor_application_source before insert on public.academy_offering_applications for each row execute function private.academy_guard_instructor_application_source();

create function private.academy_instructor_can_offer(p_offering_id uuid,p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select p_user_id is not null and exists(
    select 1 from public.academy_offerings o where o.id=p_offering_id and o.status='published' and cardinality(o.course_ids)>0
    and public.academy_is_publicly_available(o.headquarters_id)
    and not exists(select 1 from unnest(o.course_ids) as required(required_course_id) where not exists(
      select 1 from public.academy_instructors i join public.academy_courses c on c.id=i.course_id and c.headquarters_id=i.headquarters_id
      where i.user_id=p_user_id and i.headquarters_id=o.headquarters_id and i.course_id=required.required_course_id and c.is_published
      and i.registration_status='registered' and i.is_certified and i.is_active and i.status='active'
      and (i.renewal_due is null or i.renewal_due>=(now() at time zone 'Asia/Tokyo')::date)
    ))
  );
$$;
revoke all on function private.academy_instructor_can_offer(uuid,uuid) from public,anon,authenticated,service_role;

create function public.academy_list_eligible_instructor_offerings() returns setof public.academy_offerings language sql stable security definer set search_path='' as $$
  select o.* from public.academy_offerings o where auth.uid() is not null and private.academy_instructor_can_offer(o.id,auth.uid()) order by o.created_at desc;
$$;
revoke all on function public.academy_list_eligible_instructor_offerings() from public,anon,authenticated;
grant execute on function public.academy_list_eligible_instructor_offerings() to authenticated;

create function public.academy_save_instructor_offering_page(p_id uuid,p_offering_id uuid,p_profile jsonb,p_lp_blocks jsonb,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_page public.academy_instructor_offering_pages; v_off public.academy_offerings;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'instructor_sign_in_required' using errcode='42501'; end if;
  if p_status is null or p_status not in('draft','published','archived') or p_profile is null or jsonb_typeof(p_profile)<>'object' or p_lp_blocks is null or jsonb_typeof(p_lp_blocks)<>'array' then raise exception 'instructor_page_invalid'; end if;
  if octet_length(p_lp_blocks::text)>2000000 or octet_length(p_profile::text)>20000 or exists(select 1 from jsonb_object_keys(p_profile) k where k not in('display_name','bio','image_url','contact_email','application_note')) or exists(select 1 from jsonb_each(p_profile) e where jsonb_typeof(e.value)<>'string') then raise exception 'instructor_profile_invalid'; end if;
  if length(coalesce(p_profile->>'display_name',''))>200 or length(coalesce(p_profile->>'contact_email',''))>320 or (coalesce(p_profile->>'image_url','')<>'' and p_profile->>'image_url' !~ '^https?://') then raise exception 'instructor_profile_invalid'; end if;
  if p_id is not null then
    select * into v_page from public.academy_instructor_offering_pages where id=p_id for update;
    if not found or v_page.owner_user_id<>v_actor or v_page.offering_id is distinct from p_offering_id then raise exception 'instructor_page_forbidden' using errcode='42501'; end if;
    -- An expired/withdrawn instructor can always stop their own listing, not rewrite it.
    if p_status='archived' then update public.academy_instructor_offering_pages set status='archived',updated_at=clock_timestamp() where id=p_id returning * into v_page; return to_jsonb(v_page); end if;
  end if;
  select * into v_off from public.academy_offerings where id=p_offering_id for share;
  perform i.id from public.academy_instructors i where i.user_id=v_actor and i.headquarters_id=v_off.headquarters_id and i.course_id=any(v_off.course_ids) order by i.id for share;
  if not private.academy_instructor_can_offer(p_offering_id,v_actor) then raise exception 'instructor_not_qualified' using errcode='42501'; end if;
  if p_status='published' and nullif(btrim(p_profile->>'display_name'),'') is null then raise exception 'instructor_display_name_required'; end if;
  if p_id is null then
    insert into public.academy_instructor_offering_pages(headquarters_id,offering_id,owner_user_id,profile,lp_blocks,status) values(v_off.headquarters_id,v_off.id,v_actor,p_profile,p_lp_blocks,p_status) returning * into v_page;
  else
    update public.academy_instructor_offering_pages set profile=p_profile,lp_blocks=p_lp_blocks,status=p_status,updated_at=clock_timestamp() where id=p_id returning * into v_page;
  end if;
  return to_jsonb(v_page);
end; $$;
revoke all on function public.academy_save_instructor_offering_page(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.academy_save_instructor_offering_page(uuid,uuid,jsonb,jsonb,text) to authenticated;

create function public.academy_get_public_instructor_offering(p_page_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('page',jsonb_build_object('id',p.id,'profile',p.profile,'lp_blocks',p.lp_blocks),'offering',public.academy_get_public_offering(p.offering_id))
  from public.academy_instructor_offering_pages p where p.id=p_page_id and p.status='published' and private.academy_instructor_can_offer(p.offering_id,p.owner_user_id)
  and public.academy_get_public_offering(p.offering_id) is not null;
$$;
revoke all on function public.academy_get_public_instructor_offering(uuid) from public,anon,authenticated;
grant execute on function public.academy_get_public_instructor_offering(uuid) to anon,authenticated;

create function public.academy_submit_instructor_offering_application(p_page_id uuid,p_request_token uuid,p_applicant_name text,p_applicant_email text,p_payment_method text,p_expected_price numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_page public.academy_instructor_offering_pages; v_existing uuid[]; v_result jsonb; v_app public.academy_offering_applications; v_link public.academy_instructor_offering_application_links; v_certifications jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'instructor_application_sign_in_required' using errcode='42501'; end if;
  select * into v_page from public.academy_instructor_offering_pages where id=p_page_id for share;
  if not found then raise exception 'instructor_page_not_available'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_page.offering_id::text,0));
  perform o.id from public.academy_offerings o where o.id=v_page.offering_id for share;
  -- Keep the original attribution across retries and later stages. Never attach an old direct application.
  if exists(select 1 from public.academy_offering_applications a left join public.academy_instructor_offering_application_links l on l.application_id=a.id where a.offering_id=v_page.offering_id and a.learner_user_id=v_actor and (l.application_id is null or l.page_id<>p_page_id)) then raise exception 'instructor_application_source_conflict'; end if;
  select coalesce(array_agg(id),'{}') into v_existing from public.academy_offering_applications where learner_user_id=v_actor;
  perform i.id from public.academy_instructors i join public.academy_offerings o on o.id=v_page.offering_id where i.user_id=v_page.owner_user_id and i.headquarters_id=o.headquarters_id and i.course_id=any(o.course_ids) order by i.id for share of i;
  if v_page.status<>'published' or not private.academy_instructor_can_offer(v_page.offering_id,v_page.owner_user_id) then raise exception 'instructor_page_not_available'; end if;
  insert into private.academy_instructor_application_context(transaction_id,actor_id,offering_id,page_id) values(txid_current(),v_actor,v_page.offering_id,v_page.id);
  v_result:=public.academy_submit_offering_application(v_page.offering_id,p_request_token,p_applicant_name,p_applicant_email,p_payment_method,p_expected_price);
  delete from private.academy_instructor_application_context where transaction_id=txid_current() and actor_id=v_actor and offering_id=v_page.offering_id;
  select * into v_app from public.academy_offering_applications where id=(v_result->>'id')::uuid;
  if not found or v_app.learner_user_id<>v_actor or v_app.offering_id<>v_page.offering_id or v_app.headquarters_id<>v_page.headquarters_id then raise exception 'instructor_application_mismatch'; end if;
  select * into v_link from public.academy_instructor_offering_application_links where application_id=v_app.id;
  if found then
    if v_link.page_id<>p_page_id then raise exception 'instructor_application_source_conflict'; end if;
    return v_result||jsonb_build_object('instructor_snapshot',v_link.instructor_snapshot);
  end if;
  if v_app.id=any(v_existing) then raise exception 'instructor_application_source_conflict'; end if;
  select jsonb_agg(jsonb_build_object('id',i.id,'course_id',i.course_id,'instructor_number',i.instructor_number) order by i.course_id,i.id) into v_certifications from public.academy_instructors i where i.user_id=v_page.owner_user_id and i.headquarters_id=v_page.headquarters_id and i.course_id=any(v_app.course_ids) and i.registration_status='registered' and i.is_certified and i.is_active and i.status='active' and (i.renewal_due is null or i.renewal_due>=(now() at time zone 'Asia/Tokyo')::date);
  insert into public.academy_instructor_offering_application_links(application_id,page_id,headquarters_id,owner_user_id,learner_user_id,instructor_snapshot) values(v_app.id,v_page.id,v_page.headquarters_id,v_page.owner_user_id,v_actor,jsonb_build_object('page_id',v_page.id,'owner_user_id',v_page.owner_user_id,'profile',v_page.profile,'certifications',v_certifications)) returning * into v_link;
  return v_result||jsonb_build_object('instructor_snapshot',v_link.instructor_snapshot);
end; $$;
revoke all on function public.academy_submit_instructor_offering_application(uuid,uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.academy_submit_instructor_offering_application(uuid,uuid,text,text,text,numeric) to authenticated;

create function private.academy_is_offering_application_instructor(p_application_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.academy_instructor_offering_application_links where application_id=p_application_id and owner_user_id=auth.uid());
$$;
revoke all on function private.academy_is_offering_application_instructor(uuid) from public,anon,authenticated;
grant execute on function private.academy_is_offering_application_instructor(uuid) to authenticated;
create policy offering_application_assigned_instructor_read on public.academy_offering_applications for select to authenticated using(private.academy_is_offering_application_instructor(id));

create function private.academy_instructor_application_link_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'instructor_application_snapshot_immutable'; end; $$;
revoke all on function private.academy_instructor_application_link_immutable() from public,anon,authenticated,service_role;
create trigger academy_instructor_application_link_immutable before update or delete on public.academy_instructor_offering_application_links for each row execute function private.academy_instructor_application_link_immutable();
