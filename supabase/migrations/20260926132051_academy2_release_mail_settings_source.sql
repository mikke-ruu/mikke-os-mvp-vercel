-- Release dependency extraction from 20260923105401: canonical storage only.
-- Apply before 20260926040703 according to the explicit release manifest.
-- No legacy RPC replacement, queue, trigger, worker, settings seed or billing change.
-- Existing canonical storage is inspected, never altered or re-permissioned.
do $migration$
declare source_oid oid:=to_regclass('public.academy_offering_mail_settings'); item record;
begin
 if source_oid is null then
  create table public.academy_offering_mail_settings (
   headquarters_id uuid primary key references public.academy_headquarters(id) on delete restrict,
   version integer not null check(version>0),
   bodies jsonb not null check(jsonb_typeof(bodies)='object'),
   updated_at timestamptz not null default now(),
   updated_by uuid not null references auth.users(id) on delete restrict
  );
  alter table public.academy_offering_mail_settings enable row level security;
  revoke all on public.academy_offering_mail_settings from public,anon,authenticated;
  grant select on public.academy_offering_mail_settings to service_role;
 else
  if not exists(select 1 from pg_class where oid=source_oid and relkind='r' and relrowsecurity) then
   raise exception 'academy2_existing_mail_source_requires_review';
  end if;
  for item in select * from(values
   ('headquarters_id','uuid'::regtype),('version','integer'::regtype),('bodies','jsonb'::regtype),
   ('updated_at','timestamptz'::regtype),('updated_by','uuid'::regtype)
  ) x(column_name,type_oid) loop
   if not exists(select 1 from pg_attribute where attrelid=source_oid and attname=item.column_name and atttypid=item.type_oid and attnotnull and not attisdropped) then
    raise exception 'academy2_existing_mail_source_columns_require_review';
   end if;
  end loop;
  if exists(select 1 from pg_policy where polrelid=source_oid)
   or exists(select 1 from pg_trigger where tgrelid=source_oid and not tgisinternal)
   or has_table_privilege('anon',source_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or has_table_privilege('authenticated',source_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or has_any_column_privilege('anon',source_oid,'SELECT,INSERT,UPDATE,REFERENCES')
   or has_any_column_privilege('authenticated',source_oid,'SELECT,INSERT,UPDATE,REFERENCES')
   or not has_table_privilege('service_role',source_oid,'SELECT') then
   raise exception 'academy2_existing_mail_source_acl_requires_review';
  end if;
  if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='headquarters_id' where c.conrelid=source_oid and c.contype='p' and c.conkey=array[a.attnum]) then
   raise exception 'academy2_existing_mail_source_key_requires_review';
  end if;
  if (select count(*) from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and c.conkey=array[a.attnum]
   where c.conrelid=source_oid and c.contype='f' and c.convalidated and c.confdeltype='r'
   and ((a.attname='headquarters_id' and c.confrelid='public.academy_headquarters'::regclass)
     or (a.attname='updated_by' and c.confrelid='auth.users'::regclass)))<>2 then
   raise exception 'academy2_existing_mail_source_references_require_review';
  end if;
  if not exists(select 1 from pg_constraint where conrelid=source_oid and contype='c' and convalidated
    and regexp_replace(pg_get_expr(conbin,conrelid),'[[:space:]()]','','g')='version>0')
   or not exists(select 1 from pg_constraint where conrelid=source_oid and contype='c' and convalidated
    and regexp_replace(pg_get_expr(conbin,conrelid),'[[:space:]()]','','g')='jsonb_typeofbodies=''object''::text') then
   raise exception 'academy2_existing_mail_source_constraints_require_review';
  end if;
 end if;
end $migration$;
