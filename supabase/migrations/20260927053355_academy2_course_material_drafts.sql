-- CANDIDATE ONLY. Preserve legacy/public materials; new drafts never change learner access.
create table academy2_access.course_material_drafts (
 course_id uuid primary key references public.academy_courses(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 revision integer not null check(revision>0),blocks jsonb not null check(jsonb_typeof(blocks)='array'),
 legacy_snapshot jsonb not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table academy2_access.course_material_revisions (
 course_id uuid not null references academy2_access.course_material_drafts(course_id) on delete restrict,
 revision integer not null,blocks jsonb not null,saved_by uuid not null references auth.users(id),saved_at timestamptz not null default now(),primary key(course_id,revision)
);
alter table academy2_access.course_material_drafts enable row level security;
alter table academy2_access.course_material_revisions enable row level security;
revoke all on academy2_access.course_material_drafts,academy2_access.course_material_revisions from public,anon,authenticated,service_role;
create function academy2_access.course_materials(p_hq uuid,p_course uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.academy_courses;d academy2_access.course_material_drafts;l public.academy_learner_pages;
begin
 if not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into c from public.academy_courses where id=p_course and headquarters_id=p_hq;
 if c.id is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.course_material_drafts where course_id=c.id and headquarters_id=p_hq;
 select * into l from public.academy_learner_pages where course_id=c.id and headquarters_id=p_hq;
 return jsonb_build_object('courseId',c.id,'headquartersId',p_hq,'revision',coalesce(d.revision,0),'blocks',coalesce(d.blocks,l.blocks,'[]'::jsonb),'curriculum',coalesce(c.feature_settings#>'{marketing,curriculum}','[]'::jsonb),'source',case when d.course_id is not null then 'academy2_draft' when l.id is not null then 'legacy' else 'empty' end,'legacyUpdatedAt',l.updated_at,'deliveryChanged',false);
end$$;
revoke all on function academy2_access.course_materials(uuid,uuid) from public,anon,service_role;
grant execute on function academy2_access.course_materials(uuid,uuid) to authenticated;
create function academy2_access.save_course_materials(p_hq uuid,p_course uuid,p_expected integer,p_blocks jsonb,p_legacy_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.academy_courses;d academy2_access.course_material_drafts;l public.academy_learner_pages;n integer;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_expected<0 or jsonb_typeof(p_blocks) is distinct from 'array' or octet_length(p_blocks::text)>2000000 then raise exception 'academy2_invalid_materials' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_blocks) b where jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'type') is distinct from 'string') then raise exception 'academy2_invalid_materials' using errcode='22023';end if;
 select * into c from public.academy_courses where id=p_course and headquarters_id=p_hq for share;
 if c.id is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('course-materials:'||p_course::text,0));
 select * into d from academy2_access.course_material_drafts where course_id=c.id for update;
 if d.course_id is not null and d.headquarters_id<>p_hq then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if coalesce(d.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into l from public.academy_learner_pages where course_id=c.id and headquarters_id=p_hq for share;
 if d.course_id is null and l.updated_at is distinct from p_legacy_updated_at then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 n:=p_expected+1;
 if d.course_id is null then
 insert into academy2_access.course_material_drafts(course_id,headquarters_id,revision,blocks,legacy_snapshot,updated_by) values(c.id,p_hq,n,p_blocks,coalesce(to_jsonb(l),'null'::jsonb),auth.uid());
 else
 update academy2_access.course_material_drafts set revision=n,blocks=p_blocks,updated_by=auth.uid(),updated_at=now() where course_id=c.id;
 end if;
 insert into academy2_access.course_material_revisions(course_id,revision,blocks,saved_by) values(c.id,n,p_blocks,auth.uid());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.materials.draft.saved',c.id);
 return academy2_access.course_materials(p_hq,c.id);
end$$;
revoke all on function academy2_access.save_course_materials(uuid,uuid,integer,jsonb,timestamptz) from public,anon,service_role;
grant execute on function academy2_access.save_course_materials(uuid,uuid,integer,jsonb,timestamptz) to authenticated;
create function public.academy2_course_materials(p_headquarters_id uuid,p_course_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.course_materials(p_headquarters_id,p_course_id)$$;
create function public.academy2_save_course_materials(p_headquarters_id uuid,p_course_id uuid,p_expected_revision integer,p_blocks jsonb,p_legacy_updated_at timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_course_materials(p_headquarters_id,p_course_id,p_expected_revision,p_blocks,p_legacy_updated_at)$$;
revoke all on function public.academy2_course_materials(uuid,uuid),public.academy2_save_course_materials(uuid,uuid,integer,jsonb,timestamptz) from public,anon,service_role;
grant execute on function public.academy2_course_materials(uuid,uuid),public.academy2_save_course_materials(uuid,uuid,integer,jsonb,timestamptz) to authenticated;
