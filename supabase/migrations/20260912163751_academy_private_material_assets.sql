-- Local candidate only. Existing material values and access policies are preserved.
-- Existing URL rows keep their delivery mode and values. File-only rows have no fake URL.
alter table public.academy_materials add column delivery_mode text not null default 'external_url';
alter table public.academy_materials alter column url drop not null;
alter table public.academy_materials add constraint academy_material_delivery_check check (
  (delivery_mode='external_url' and url is not null)
  or (delivery_mode='private_file' and kind='pdf' and
    (url is null or (url='about:blank#retained-record' and not is_published)))
);

create table public.academy_private_material_assets (
  id uuid primary key,
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  audience text not null check (audience in ('learner','instructor')),
  learner_page_id uuid references public.academy_learner_pages(id) on delete restrict,
  instructor_material_id uuid references public.academy_materials(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  original_name text not null check (length(original_name) between 1 and 160),
  byte_size integer not null check (byte_size between 1 and 3145728),
  state text not null default 'pending' check (state in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  check ((audience='learner' and learner_page_id is not null and instructor_material_id is null)
    or (audience='instructor' and instructor_material_id is not null and learner_page_id is null))
);
create index on public.academy_private_material_assets(headquarters_id);
create index on public.academy_private_material_assets(course_id);
create index on public.academy_private_material_assets(learner_page_id);
create index on public.academy_private_material_assets(instructor_material_id);
create index on public.academy_private_material_assets(created_by,created_at);
alter table public.academy_private_material_assets enable row level security;
revoke all on public.academy_private_material_assets from public,anon,authenticated;
grant select,insert on public.academy_private_material_assets to authenticated;
grant select,insert,update on public.academy_private_material_assets to service_role;

-- Private definer lookup avoids parent RLS recursion. Caller identity is mandatory.
create function private.academy_private_asset_parent_allowed(
  p_audience text,p_parent_id uuid,p_hq uuid,p_course uuid,p_write boolean
) returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
    and (not p_write or coalesce(private.academy_headquarters_access_mode(p_hq),'blocked')='paid')
    and (
      (p_audience='learner' and exists (
        select 1 from public.academy_learner_pages p
        where p.id=p_parent_id and p.headquarters_id=p_hq and p.course_id=p_course
          and (private.academy_can_edit_courses(p_hq) or
            (not p_write and p.is_published and
              private.academy_has_course_content_access(p_course,(select auth.uid()))))
      )) or
      (p_audience='instructor' and exists (
        select 1 from public.academy_materials m
        where m.id=p_parent_id and m.headquarters_id=p_hq and m.course_id=p_course
          and (private.academy_can_edit_courses(p_hq) or
            (not p_write and m.is_published and
              private.academy_is_registered_course_instructor(p_course,(select auth.uid()),m.requires_active)))
      ))
    );
$$;
revoke all on function private.academy_private_asset_parent_allowed(text,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function private.academy_private_asset_parent_allowed(text,uuid,uuid,uuid,boolean) to authenticated;

create policy academy_private_asset_read on public.academy_private_material_assets
for select to authenticated using (
  (state='ready' or private.academy_can_edit_courses(headquarters_id))
  and private.academy_private_asset_parent_allowed(audience,coalesce(learner_page_id,instructor_material_id),headquarters_id,course_id,false)
);
create policy academy_private_asset_prepare on public.academy_private_material_assets
for insert to authenticated with check (
  created_by=(select auth.uid()) and state='pending'
  and private.academy_private_asset_parent_allowed(audience,coalesce(learner_page_id,instructor_material_id),headquarters_id,course_id,true)
);

-- Caller-scoped recheck before/after transfer. Never uses service-role for authorization.
create function public.academy_private_asset_writable(p_asset_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (select 1 from public.academy_private_material_assets a where a.id=p_asset_id
    and a.created_by=(select auth.uid()) and a.state='pending'
    and private.academy_private_asset_parent_allowed(a.audience,coalesce(a.learner_page_id,a.instructor_material_id),a.headquarters_id,a.course_id,true));
$$;
revoke all on function public.academy_private_asset_writable(uuid) from public,anon;
grant execute on function public.academy_private_asset_writable(uuid) to authenticated;

-- Preserve existing trial/contract gate on metadata writes as well as API preflight.
create trigger academy_private_asset_live_guard before insert or update on public.academy_private_material_assets
for each row execute function private.academy_guard_trial_live_operation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('academy-private-materials','academy-private-materials',false,3145728,array['application/pdf']);
-- No client Storage operation, including sign/list/download/upload, is allowed.
-- Restrictive guard prevents an unrelated broad permissive policy from exposing this bucket.
create policy academy_private_materials_server_only on storage.objects as restrictive
for all to anon,authenticated
using (bucket_id <> 'academy-private-materials')
with check (bucket_id <> 'academy-private-materials');

create function public.academy_private_materials_ready()
returns text language sql stable security invoker set search_path='' as $$
  select 'private-pdf-v1' where exists (
    select 1 from storage.buckets where id='academy-private-materials' and public=false
      and file_size_limit=3145728 and allowed_mime_types=array['application/pdf']::text[]
  ) and exists (
    select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects'
      and policyname='academy_private_materials_server_only' and permissive='RESTRICTIVE'
  );
$$;
revoke all on function public.academy_private_materials_ready() from public,anon,authenticated;
grant execute on function public.academy_private_materials_ready() to service_role;
