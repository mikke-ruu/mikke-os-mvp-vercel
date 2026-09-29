begin;
do $$ begin
 if current_database()<>'academy2_sept30_preservation_20260929' then raise exception 'wrong isolated DB'; end if;
 if exists(select 1 from auth.users where id='ac209986-0000-4000-8000-000000000001') then raise exception 'fixture already exists'; end if;
end $$;
set local session_replication_role=replica;
insert into auth.users(id,email) values
 ('ac209986-0000-4000-8000-000000000001','legacy-learner@example.invalid'),
 ('ac209986-0000-4000-8000-000000000002','legacy-instructor@example.invalid'),
 ('ac209986-0000-4000-8000-000000000003','legacy-unrelated@example.invalid');
insert into public.profiles(id,user_id,display_name,handle,member_number) values
 ('ac209986-0000-4000-8000-000000000101','ac209986-0000-4000-8000-000000000001','Legacy Learner','legacy-compat-learner',90000001),
 ('ac209986-0000-4000-8000-000000000102','ac209986-0000-4000-8000-000000000002','Legacy Instructor','legacy-compat-instructor',90000002);
insert into public.academy_instructors(id,headquarters_id,course_id,profile_id,user_id,is_certified,is_active,status,registration_status)
values('ac209986-0000-4000-8000-000000000202','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','ac209986-0000-4000-8000-000000000102','ac209986-0000-4000-8000-000000000002',true,true,'active','registered');
insert into public.academy_classes(id,headquarters_id,course_id,instructor_id,title,format,status,schedule_mode)
values('ac209986-0000-4000-8000-000000000201','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','ac209986-0000-4000-8000-000000000202','Legacy Class','online','planned','arranged_after_application');
insert into public.academy_applications(id,headquarters_id,course_id,class_id,instructor_id,user_id,intake_source,applicant_name,status,payment_status)
values('ac209986-0000-4000-8000-000000000203','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','ac209986-0000-4000-8000-000000000201','ac209986-0000-4000-8000-000000000202','ac209986-0000-4000-8000-000000000001','honbu','Legacy Learner','paid','paid');
insert into public.academy_materials(id,headquarters_id,course_id,user_id,kind,title,url,is_published)
values('ac209986-0000-4000-8000-000000000204','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','ac209985-0000-4000-8000-000000000001','link','Legacy Material','https://example.invalid/material',true);
insert into public.academy_course_access_grants(id,headquarters_id,course_id,learner_user_id,source,starts_at)
values('ac209986-0000-4000-8000-000000000205','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','ac209986-0000-4000-8000-000000000001','legacy',now()-interval '1 day');
insert into public.academy_enrollments(id,class_id,learner_profile_id,status)
values('ac209986-0000-4000-8000-000000000206','ac209986-0000-4000-8000-000000000201','ac209986-0000-4000-8000-000000000101','active');
insert into public.academy_programs(id,headquarters_id,course_id,title,status)
values('ac209986-0000-4000-8000-000000000207','ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000021','Legacy Program','published');
insert into public.academy_program_versions(id,program_id,version_number,title,content_snapshot,published_at)
values('ac209986-0000-4000-8000-000000000208','ac209986-0000-4000-8000-000000000207',1,'Legacy Version','{"legacy":true}'::jsonb,now());
insert into public.academy_program_assignments(id,headquarters_id,program_id,learner_profile_id,status,program_version_id)
values('ac209986-0000-4000-8000-000000000209','ac209985-0000-4000-8000-000000000011','ac209986-0000-4000-8000-000000000207','ac209986-0000-4000-8000-000000000101','active','ac209986-0000-4000-8000-000000000208');
insert into public.academy_kit_orders(id,headquarters_id,instructor_id,items,title)
values('ac209986-0000-4000-8000-000000000210','ac209985-0000-4000-8000-000000000011','ac209986-0000-4000-8000-000000000202','[]','Legacy Kit');
insert into academy2_access.tenants(headquarters_id,runtime_enabled) values('ac209985-0000-4000-8000-000000000011',false);
insert into academy2_access.memberships(headquarters_id,user_id,role,active)
values('ac209985-0000-4000-8000-000000000011','ac209985-0000-4000-8000-000000000001','owner',true);
set local session_replication_role=origin;

set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011' and 'teach'=any(portals))<>1 then raise exception 'learner before context'; end if;
 if (select count(*) from public.academy_applications where id='ac209986-0000-4000-8000-000000000203')<>1 then raise exception 'learner before application'; end if;
 if (select count(*) from public.academy_courses where id='ac209985-0000-4000-8000-000000000021')<>1 then raise exception 'learner before course'; end if;
 if (select count(*) from public.academy_program_versions where id='ac209986-0000-4000-8000-000000000208')<>1 then raise exception 'learner before version'; end if;
 raise notice 'learner before: program %, version %, material %',
  (select count(*) from public.academy_programs where id='ac209986-0000-4000-8000-000000000207'),
  (select count(*) from public.academy_program_versions where id='ac209986-0000-4000-8000-000000000208'),
  (select count(*) from public.academy_materials where id='ac209986-0000-4000-8000-000000000204');
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011' and 'teach'=any(portals))<>1 then raise exception 'teacher before context'; end if;
 if (select count(*) from public.academy_instructors where id='ac209986-0000-4000-8000-000000000202')<>1 then raise exception 'teacher before profile'; end if;
end $$;
reset role;

update academy2_access.tenants set runtime_enabled=true where headquarters_id='ac209985-0000-4000-8000-000000000011';
set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
 if exists(select 1 from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011') then raise exception 'expected old context to disappear'; end if;
 if exists(select 1 from public.academy_applications where id='ac209986-0000-4000-8000-000000000203') then raise exception 'expected old application to disappear'; end if;
end $$;
reset role;

-- COMPAT_MIGRATION

set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ declare c record; changed integer; begin
 select * into c from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011';
 if c.academy_id is null or c.portals<>array['teach']::text[] or c.roles<>array['learner']::text[] then raise exception 'learner context lost'; end if;
 if (select count(*) from public.academy_applications where id='ac209986-0000-4000-8000-000000000203')<>1 then raise exception 'learner application lost'; end if;
 if (select count(*) from public.academy_courses where id='ac209985-0000-4000-8000-000000000021')<>1 then raise exception 'learner course lost'; end if;
 if (select count(*) from public.academy_headquarters where id='ac209985-0000-4000-8000-000000000011')<>1 then raise exception 'learner HQ lost'; end if;
 if (select count(*) from public.academy_enrollments where id='ac209986-0000-4000-8000-000000000206')<>1 then raise exception 'learner schedule lost'; end if;
 if (select count(*) from public.academy_programs where id='ac209986-0000-4000-8000-000000000207')<>1 then raise exception 'learner program lost'; end if;
 if (select count(*) from public.academy_program_versions where id='ac209986-0000-4000-8000-000000000208')<>1 then raise exception 'learner version lost'; end if;
 begin
  update public.academy_applications set status='received' where id='ac209986-0000-4000-8000-000000000203';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'old application write revived'; end if;
 exception when insufficient_privilege then null;
 end;
 raise notice 'learner after: program %, version %, material %',
  (select count(*) from public.academy_programs where id='ac209986-0000-4000-8000-000000000207'),
  (select count(*) from public.academy_program_versions where id='ac209986-0000-4000-8000-000000000208'),
  (select count(*) from public.academy_materials where id='ac209986-0000-4000-8000-000000000204');
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ declare c record; changed integer; begin
 select * into c from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011';
 if c.academy_id is null or c.portals<>array['teach']::text[] or c.roles<>array['instructor']::text[] then raise exception 'teacher context lost'; end if;
 if (select count(*) from public.academy_instructors where id='ac209986-0000-4000-8000-000000000202')<>1 then raise exception 'teacher profile lost'; end if;
 if (select count(*) from public.academy_applications where id='ac209986-0000-4000-8000-000000000203')<>1 then raise exception 'teacher application lost'; end if;
 if (select count(*) from public.academy_classes where id='ac209986-0000-4000-8000-000000000201')<>1 then raise exception 'teacher event lost'; end if;
 if (select count(*) from public.academy_materials where id='ac209986-0000-4000-8000-000000000204')<>1 then raise exception 'teacher material lost'; end if;
 if (select count(*) from public.academy_kit_orders where id='ac209986-0000-4000-8000-000000000210')<>1 then raise exception 'teacher kit lost'; end if;
 begin
  update public.academy_instructors set is_listed=true where id='ac209986-0000-4000-8000-000000000202';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'old instructor write revived'; end if;
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='ac209986-0000-4000-8000-000000000003';
set local request.jwt.claims='{"sub":"ac209986-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin
 if exists(select 1 from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011') then raise exception 'unrelated context leak'; end if;
 if exists(select 1 from public.academy_applications where id='ac209986-0000-4000-8000-000000000203') then raise exception 'unrelated application leak'; end if;
 if exists(select 1 from public.academy_instructors where id='ac209986-0000-4000-8000-000000000202') then raise exception 'unrelated instructor leak'; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claim.sub='ac209985-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ac209985-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.academy2_my_headquarters() where id='ac209985-0000-4000-8000-000000000011')<>1 then raise exception 'v2 owner lost'; end if;
 if exists(select 1 from public.academy_list_my_contexts() where academy_id='ac209985-0000-4000-8000-000000000011') then raise exception 'legacy manage revived'; end if;
end $$;
reset role;

do $$ begin
 if (select content_snapshot from public.academy_program_versions where id='ac209986-0000-4000-8000-000000000208')<>'{"legacy":true}'::jsonb then raise exception 'version changed'; end if;
 if (select count(*) from public.academy_program_assignments where id='ac209986-0000-4000-8000-000000000209')<>1 then raise exception 'assignment changed'; end if;
 if (select count(*) from public.academy_applications where id='ac209986-0000-4000-8000-000000000203')<>1 then raise exception 'application changed'; end if;
end $$;
rollback;
