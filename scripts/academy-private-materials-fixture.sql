-- Disposable Postgres fixture only. Never run on a connected project.
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin bypassrls;end if;
end$$;
create schema auth;
create schema private;
create schema storage;
create schema test;
create function test.uid(n int) returns uuid language sql immutable as $$select lpad(n::text,32,'0')::uuid$$;
create table auth.users(id uuid primary key);
insert into auth.users select test.uid(n) from generate_series(1,8)n;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.academy_headquarters(id uuid primary key, mode text not null default 'paid');
create table public.academy_courses(id uuid primary key,headquarters_id uuid references public.academy_headquarters);
create table public.academy_learner_pages(id uuid primary key,headquarters_id uuid,course_id uuid,is_published boolean);
create table public.academy_materials(id uuid primary key default gen_random_uuid(),headquarters_id uuid,course_id uuid,user_id uuid,kind text,url text not null,title text,requires_active boolean,is_published boolean);
create table public.academy_course_access_grants(course_id uuid,learner_user_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
create table public.academy_instructors(course_id uuid,user_id uuid,registration_status text,is_certified boolean,is_active boolean,status text,renewal_due date);
create table test.editors(hq uuid,usr uuid,role_name text);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
-- Deliberately broad existing policy: restrictive guard must still deny the new bucket.
create policy broad_existing on storage.objects for all to authenticated using(true) with check(true);
grant usage on schema auth,private,storage,test to authenticated,anon,service_role;
grant select on storage.buckets to service_role;
grant all on storage.objects to authenticated,service_role;
grant select on test.editors to authenticated;
create function private.academy_headquarters_access_mode(h uuid) returns text language sql stable security definer set search_path='' as $$select mode from public.academy_headquarters where id=h$$;
create function private.academy_can_edit_courses(h uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from test.editors where hq=h and usr=(select auth.uid()) and role_name in ('owner','administrator','course_editor'))$$;
create function private.academy_has_course_content_access(p_course_id uuid,p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select p_user_id=(select auth.uid()) and exists(select 1 from public.academy_course_access_grants g where g.course_id=p_course_id and g.learner_user_id=p_user_id and g.status='active' and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now()));
$$;
create function private.academy_is_registered_course_instructor(p_course_id uuid,p_user_id uuid,p_require_active boolean default false) returns boolean language sql stable security definer set search_path='' as $$
select p_user_id=(select auth.uid()) and exists(select 1 from public.academy_instructors i where i.course_id=p_course_id and i.user_id=p_user_id and i.registration_status='registered' and i.is_certified and (not p_require_active or (i.is_active and i.status='active')));
$$;
create function private.academy_guard_trial_live_operation() returns trigger language plpgsql security definer set search_path='' as $$begin
if coalesce(private.academy_headquarters_access_mode(new.headquarters_id),'blocked')<>'paid' then raise exception 'academy_trial_live_feature_unavailable';end if;return new;end;$$;
insert into public.academy_headquarters values(test.uid(100),'paid'),(test.uid(200),'paid');
insert into public.academy_courses values(test.uid(101),test.uid(100)),(test.uid(201),test.uid(200));
insert into test.editors values(test.uid(100),test.uid(1),'owner'),(test.uid(100),test.uid(2),'administrator'),(test.uid(100),test.uid(3),'course_editor'),(test.uid(200),test.uid(8),'owner');
insert into public.academy_learner_pages values(test.uid(102),test.uid(100),test.uid(101),true);
insert into public.academy_materials values(test.uid(103),test.uid(100),test.uid(101),test.uid(1),'pdf','https://example.invalid/existing.pdf','Existing',true,true);
insert into public.academy_course_access_grants values(test.uid(101),test.uid(4),'active',now()-interval '1 day',now()+interval '1 day');
insert into public.academy_instructors values(test.uid(101),test.uid(5),'registered',true,true,'active',current_date-1);
grant select on public.academy_courses,public.academy_learner_pages,public.academy_materials to authenticated;
create function private.academy_headquarters_role(h uuid,u uuid) returns text language sql stable security definer set search_path='' as $$select role_name from test.editors where hq=h and usr=u$$;
alter table public.academy_materials enable row level security;
grant insert on public.academy_materials to authenticated;
create policy material_editors_select on public.academy_materials for select to authenticated using(private.academy_can_edit_courses(headquarters_id));
create policy material_editors_insert on public.academy_materials for insert to authenticated with check(
 private.academy_can_edit_courses(headquarters_id) and user_id=(select auth.uid())
 and exists(select 1 from public.academy_courses c where c.id=course_id and c.headquarters_id=academy_materials.headquarters_id)
 and (not is_published or private.academy_headquarters_role(headquarters_id,(select auth.uid()))='owner')
);
create trigger material_trial_guard before insert on public.academy_materials for each row execute function private.academy_guard_trial_live_operation();
