-- Additive opt-in page drafts only. No public/legacy page, billing or access mutation.
create table academy2_access.sales_pages (
 plan_id uuid primary key references academy2_access.sales_plan_drafts(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 revision integer not null check(revision>0),
 plan_revision integer not null,
 blocks jsonb not null check(jsonb_typeof(blocks)='array'),
 saved_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
create table academy2_access.sales_page_revisions (
 plan_id uuid not null references academy2_access.sales_pages(plan_id) on delete restrict,
 revision integer not null,
 plan_revision integer not null,
 blocks jsonb not null,
 saved_by uuid not null references auth.users(id) on delete restrict,
 saved_at timestamptz not null default now(),
 primary key(plan_id,revision),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
alter table academy2_access.sales_pages enable row level security;
alter table academy2_access.sales_page_revisions enable row level security;
revoke all on academy2_access.sales_pages,academy2_access.sales_page_revisions from public,anon,authenticated,service_role;

-- Validate common builder structure and references without copying learner content.
create function academy2_access.sales_page_blocks_valid(p_blocks jsonb,p_courses jsonb,p_depth integer default 0)
returns boolean language plpgsql immutable set search_path='' as $$
declare b jsonb; ref jsonb;
begin
 if p_blocks is null or jsonb_typeof(p_blocks)<>'array' or p_depth>8 then return false;end if;
 if jsonb_array_length(p_blocks)>200 then return false;end if;
 if exists(select 1 from jsonb_array_elements(p_blocks) x group by x->>'id' having count(*)>1) then return false;end if;
 for b in select value from jsonb_array_elements(p_blocks) loop
  if jsonb_typeof(b)<>'object' or jsonb_typeof(b->'id') is distinct from 'string' or length(b->>'id') not between 1 and 120
   or coalesce(b->>'type','') not in ('paragraph','heading','image','quote','list','divider','link','video','links','image-text','gallery','cta') then return false;end if;
  if b ? 'lp' then
   if jsonb_typeof(b->'lp')<>'object' then return false;end if;
   if b->'lp' ? 'reference' then
    ref:=b#>'{lp,reference}';
    if jsonb_typeof(ref)<>'object' or ref->>'kind' is distinct from 'academy-course' or not coalesce(p_courses ? (ref->>'id'),false) then return false;end if;
   end if;
   if b->'lp' ? 'children' and not academy2_access.sales_page_blocks_valid(b#>'{lp,children}',p_courses,p_depth+1) then return false;end if;
  end if;
 end loop;
 return true;
end $$;
revoke all on function academy2_access.sales_page_blocks_valid(jsonb,jsonb,integer) from public,anon,authenticated,service_role;

create function academy2_access.sales_page(p_hq uuid,p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; p academy2_access.sales_pages; blocks jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'pages.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq;
 if not found then raise exception 'academy2_page_unavailable' using errcode='42501';end if;
 select * into p from academy2_access.sales_pages where plan_id=p_plan and headquarters_id=p_hq;
 if p.plan_id is null then
  select coalesce(jsonb_agg(jsonb_build_object('id','course-'||c.value,'type','paragraph','lp',jsonb_build_object('reference',jsonb_build_object('kind','academy-course','id',c.value,'imageSide','left'),'desktop',jsonb_build_object('padding',24),'mobile',jsonb_build_object('padding',16))) order by c.ordinality),'[]') into blocks from jsonb_array_elements_text(d.configuration->'course_ids') with ordinality c(value,ordinality);
  if d.configuration->>'show_course_introductions'='false' then blocks:='[]';end if;
  return jsonb_build_object('plan_id',d.id,'headquarters_id',p_hq,'revision',0,'plan_revision',d.revision,'current_plan_revision',d.revision,'blocks',blocks,'updated_at',null,'needs_rebase',false,'published',false);
 end if;
 return jsonb_build_object('plan_id',p.plan_id,'headquarters_id',p.headquarters_id,'revision',p.revision,'plan_revision',p.plan_revision,'current_plan_revision',d.revision,'blocks',p.blocks,'updated_at',p.updated_at,'needs_rebase',p.plan_revision<>d.revision,'published',false);
end $$;
revoke all on function academy2_access.sales_page(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.sales_page(uuid,uuid) to authenticated;
create function public.academy2_sales_page(p_headquarters_id uuid,p_plan_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.sales_page(p_headquarters_id,p_plan_id)$$;
revoke all on function public.academy2_sales_page(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_sales_page(uuid,uuid) to authenticated;

create function academy2_access.save_sales_page(p_hq uuid,p_plan uuid,p_expected integer,p_expected_plan integer,p_blocks jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; p academy2_access.sales_pages; n integer;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'pages.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_expected<0 or p_expected_plan is null or p_expected_plan<1 or p_blocks is null or octet_length(p_blocks::text)>500000 then raise exception 'academy2_invalid_page' using errcode='22023';end if;
 -- Match draft writer's lock key; publication must take the same plan lock.
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq for share;
 if not found then raise exception 'academy2_page_unavailable' using errcode='42501';end if;
 if d.revision<>p_expected_plan then raise exception 'academy2_plan_revision_changed' using errcode='PT409';end if;
 if not academy2_access.sales_page_blocks_valid(p_blocks,d.configuration->'course_ids') then raise exception 'academy2_invalid_page_blocks' using errcode='22023';end if;
 select * into p from academy2_access.sales_pages where plan_id=p_plan for update;
 if p.plan_id is not null and p.headquarters_id<>p_hq then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p.plan_id is not null and p.revision=p_expected+1 and p.blocks=p_blocks and p.plan_revision=p_expected_plan then return academy2_access.sales_page(p_hq,p_plan);end if;
 if coalesce(p.revision,0)<>p_expected then raise exception 'academy2_page_revision_changed' using errcode='PT409';end if;
 n:=p_expected+1;
 insert into academy2_access.sales_pages(plan_id,headquarters_id,revision,plan_revision,blocks,saved_by) values(p_plan,p_hq,n,p_expected_plan,p_blocks,auth.uid())
 on conflict(plan_id) do update set revision=excluded.revision,plan_revision=excluded.plan_revision,blocks=excluded.blocks,saved_by=excluded.saved_by,updated_at=now();
 insert into academy2_access.sales_page_revisions(plan_id,revision,plan_revision,blocks,saved_by) values(p_plan,n,p_expected_plan,p_blocks,auth.uid());
 return academy2_access.sales_page(p_hq,p_plan);
end $$;
revoke all on function academy2_access.save_sales_page(uuid,uuid,integer,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.save_sales_page(uuid,uuid,integer,integer,jsonb) to authenticated;
create function public.academy2_save_sales_page(p_headquarters_id uuid,p_plan_id uuid,p_expected_revision integer,p_expected_plan_revision integer,p_blocks jsonb) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.save_sales_page(p_headquarters_id,p_plan_id,p_expected_revision,p_expected_plan_revision,p_blocks)$$;
revoke all on function public.academy2_save_sales_page(uuid,uuid,integer,integer,jsonb) from public,anon,service_role;
grant execute on function public.academy2_save_sales_page(uuid,uuid,integer,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
