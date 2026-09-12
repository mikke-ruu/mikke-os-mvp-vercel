\set ON_ERROR_STOP on
\i /tmp/academy-private-materials-fixture.sql
\i /tmp/20260912163751_academy_private_material_assets.sql

create function test.count_assets(expected int) returns void language plpgsql security invoker as $$declare actual int;begin
select count(*) into actual from public.academy_private_material_assets;
if actual<>expected then raise exception 'asset count %, expected %',actual,expected;end if;end;$$;
create function test.prepare(n int,a text default 'learner') returns void language sql security invoker as $$
insert into public.academy_private_material_assets(id,headquarters_id,course_id,audience,learner_page_id,instructor_material_id,created_by,original_name,byte_size)
values(test.uid(n),test.uid(100),test.uid(101),a,case when a='learner' then test.uid(102) end,case when a='instructor' then test.uid(103) end,auth.uid(),'test.pdf',100);
$$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
select test.prepare(301),test.prepare(302,'instructor');
select test.count_assets(2);
do $$begin if not public.academy_private_asset_writable(test.uid(301)) then raise exception 'owner writable missing';end if;end$$;
-- Direct ready/update/delete is forbidden; no bypass through Data API.
do $$begin
  begin update public.academy_private_material_assets set state='ready';raise exception 'update leaked';exception when insufficient_privilege then null;end;
  begin delete from public.academy_private_material_assets;raise exception 'delete leaked';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.academy_private_material_assets set state='ready';
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(4)::text,true);
select test.count_assets(1);
do $$begin
  begin perform test.prepare(303);raise exception 'learner upload leaked';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',test.uid(5)::text,true);
select test.count_assets(1); -- renewal_due yesterday must NOT introduce new expiry.
select set_config('request.jwt.claim.sub',test.uid(8)::text,true);
select test.count_assets(0); -- unrelated HQ owner
select set_config('request.jwt.claim.sub',test.uid(6)::text,true);
select test.count_assets(0); -- unrelated signed-in user
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
select test.count_assets(0);
select set_config('request.jwt.claims','{}',true);
-- Admin/editor can prepare, but cannot change another upload or scope.
select set_config('request.jwt.claim.sub',test.uid(2)::text,true);
select test.prepare(304);
select set_config('request.jwt.claim.sub',test.uid(3)::text,true);
select test.prepare(305);
insert into public.academy_materials(headquarters_id,course_id,user_id,kind,title,url,delivery_mode,requires_active,is_published)
values(test.uid(100),test.uid(101),auth.uid(),'pdf','Private draft',null,'private_file',true,false);
do $$begin
 begin insert into public.academy_materials(headquarters_id,course_id,user_id,kind,title,url,delivery_mode,requires_active,is_published)
 values(test.uid(100),test.uid(101),auth.uid(),'pdf','Cannot publish',null,'private_file',true,true);
 raise exception 'editor published';exception when insufficient_privilege then null;end;
end$$;
do $$begin if public.academy_private_asset_writable(test.uid(304)) then raise exception 'other uploader writable';end if;end$$;
do $$begin
  begin insert into public.academy_private_material_assets(id,headquarters_id,course_id,audience,learner_page_id,created_by,original_name,byte_size,state)
    values(test.uid(306),test.uid(200),test.uid(101),'learner',test.uid(102),auth.uid(),'bad.pdf',10,'pending');raise exception 'scope leaked';exception when insufficient_privilege then null;end;
  begin insert into public.academy_private_material_assets(id,headquarters_id,course_id,audience,learner_page_id,created_by,original_name,byte_size,state)
    values(test.uid(307),test.uid(100),test.uid(101),'learner',test.uid(102),auth.uid(),'bad.pdf',10,'ready');raise exception 'ready insert leaked';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Expiry exact boundary, future grant and revoked grant all deny.
update public.academy_course_access_grants set ends_at=now();
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(4)::text,true);
select test.count_assets(0);
reset role;
update public.academy_course_access_grants set starts_at=now()+interval '1 day',ends_at=null;
set local role authenticated;select test.count_assets(0);reset role;
update public.academy_course_access_grants set starts_at=now()-interval '1 day',status='revoked';
set local role authenticated;select test.count_assets(0);reset role;
update public.academy_course_access_grants set status='active';
update public.academy_learner_pages set is_published=false;
set local role authenticated;select test.count_assets(0);reset role;
update public.academy_learner_pages set is_published=true;
set local role authenticated;select test.count_assets(1);reset role;
-- Instructor publication / registration / certification / active gates.
update public.academy_instructors set is_active=false,status='inactive';
set local role authenticated;select set_config('request.jwt.claim.sub',test.uid(5)::text,true);select test.count_assets(0);reset role;
update public.academy_materials set requires_active=false;
set local role authenticated;select test.count_assets(1);reset role;
update public.academy_instructors set registration_status='withdrawn';
set local role authenticated;select test.count_assets(0);reset role;
update public.academy_instructors set registration_status='registered',is_certified=false;
set local role authenticated;select test.count_assets(0);reset role;
update public.academy_instructors set is_certified=true;
update public.academy_materials set is_published=false;
set local role authenticated;select test.count_assets(0);reset role;
-- Private-only parent constraint and legacy compatibility.
do $$begin
 if not exists(select 1 from public.academy_materials where id=test.uid(103) and url='https://example.invalid/existing.pdf' and delivery_mode='external_url')then raise exception 'legacy modified';end if;
 begin insert into public.academy_materials(headquarters_id,url,delivery_mode,kind)values(test.uid(100),null,'external_url','pdf');raise exception 'empty external url accepted';exception when check_violation then null;end;
end$$;
insert into public.academy_materials(headquarters_id,url,delivery_mode,kind,is_published)values(test.uid(100),null,'private_file','pdf',false);
update public.academy_materials set url='about:blank#retained-record',is_published=false where delivery_mode='private_file';
-- Unrelated broad Storage policy cannot expose new bucket, even to editors.
insert into storage.objects(bucket_id,name)values('academy-private-materials','private.pdf'),('other-bucket','other.pdf');
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
do $$begin
 if exists(select 1 from storage.objects where bucket_id='academy-private-materials')then raise exception 'storage read leaked';end if;
 if not exists(select 1 from storage.objects where bucket_id='other-bucket')then raise exception 'unrelated storage changed';end if;
 begin insert into storage.objects(bucket_id,name)values('academy-private-materials','evil.pdf');raise exception 'storage insert leaked';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 begin perform count(*) from public.academy_private_material_assets;raise exception 'anon leaked';exception when insufficient_privilege then null;end;
 begin perform public.academy_private_materials_ready();raise exception 'readiness leaked';exception when insufficient_privilege then null;end;
end$$;
set local role service_role;
do $$begin if public.academy_private_materials_ready() is distinct from 'private-pdf-v1' then raise exception 'not ready';end if;end$$;
reset role;
-- Contract stop gates writes, but does not invent a new learner entitlement expiry.
update public.academy_headquarters set mode='blocked' where id=test.uid(100);
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
select test.count_assets(4);
do $$begin
 begin perform test.prepare(309);raise exception 'blocked contract upload';exception when others then if sqlerrm='blocked contract upload' then raise;end if;end;
end$$;
reset role;
-- Existing retention unpublishes the parent; the learner then cannot fetch attachments.
update public.academy_learner_pages set is_published=false;
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(4)::text,true);
select test.count_assets(0);
reset role;
rollback;
select 'academy private material DB tests passed' result;
