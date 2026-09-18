-- Run ONLY inside a single BEGIN ... all three migrations ... this file ... ROLLBACK.
-- Never modify a customer row. Every fixture has the isolated 9e180918 namespace.
create schema academy_offering_test;
create function academy_offering_test.uid(n int) returns uuid language sql immutable as $$select ('9e180918-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function academy_offering_test.ok(v boolean,label text) returns void language plpgsql as $$begin if v is not true then raise exception 'ASSERTION: %',label;end if;end$$;
create function academy_offering_test.denied(q text) returns void language plpgsql security invoker as $$begin begin execute q;exception when others then return;end;raise exception 'EXPECTED DENIAL: %',q;end$$;
grant usage on schema academy_offering_test to authenticated,anon;
set local search_path=public,academy_offering_test;
insert into auth.users(id) select academy_offering_test.uid(n) from generate_series(1,4)n;
insert into public.academy_headquarters(id,owner_user_id,name,handle) values
 (academy_offering_test.uid(100),academy_offering_test.uid(1),'Rollback HQ A','rollback_9e180918_a'),
 (academy_offering_test.uid(200),academy_offering_test.uid(2),'Rollback HQ B','rollback_9e180918_b');
insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,pricing_revision,consent_revision)
 values('rollback_9e180918','rollback only','test',600,true,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract','test','test');
insert into academy_publication_private.quote_display_catalog(policy_version,pricing_revision,plan_key,plan_name,discount_description,consent_revision)
 values('rollback_9e180918','test','small','Rollback fixture','No billing action','test');
insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at)
 select academy_offering_test.uid(n+1000),academy_offering_test.uid(n),academy_offering_test.uid(n/100),'rollback_9e180918','test',100,0,now(),now()+interval '1 hour' from unnest(array[100,200])n;
insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,first_published_at,trial_ends_at,phase)
 select academy_offering_test.uid(n),academy_offering_test.uid(n/100),'rollback_9e180918','rollback only','test',academy_offering_test.uid(n+1000),100,0,now(),'rollback only',now(),now()+interval '168 hours','trialing' from unnest(array[100,200])n;
insert into academy_publication_private.publication_permits select txid_current(),academy_offering_test.uid(n) from unnest(array[101,102,201])n;
insert into public.academy_courses(id,headquarters_id,user_id,code,name,is_published,learner_access_mode,learner_access_days)
 values(academy_offering_test.uid(101),academy_offering_test.uid(100),academy_offering_test.uid(1),'test1','Test A',true,'unlimited',null),
 (academy_offering_test.uid(102),academy_offering_test.uid(100),academy_offering_test.uid(1),'test2','Test B',true,'days_after_enrollment',30),
 (academy_offering_test.uid(201),academy_offering_test.uid(200),academy_offering_test.uid(2),'test3','Test C',true,'unlimited',null);
set local role authenticated;
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
insert into public.academy_offerings(id,headquarters_id,title,course_ids,price,status) values(academy_offering_test.uid(301),academy_offering_test.uid(100),'Bundle',array[academy_offering_test.uid(101),academy_offering_test.uid(102)],2400,'published');
select academy_offering_test.denied($q$insert into public.academy_offerings(headquarters_id,title,course_ids) values(academy_offering_test.uid(100),'Wrong HQ',array[academy_offering_test.uid(201)])$q$);
select set_config('request.jwt.claim.sub',academy_offering_test.uid(2)::text,true);
select academy_offering_test.ok(not exists(select 1 from public.academy_offerings where id=academy_offering_test.uid(301)),'cross HQ hidden');
reset role;
set local role anon;
select academy_offering_test.ok(public.academy_get_public_offering(academy_offering_test.uid(301))->>'title'='Bundle','anonymous public projection');
select academy_offering_test.denied('select * from public.academy_offering_applications');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',academy_offering_test.uid(3)::text,true);
select academy_offering_test.denied($q$select public.academy_submit_offering_application(academy_offering_test.uid(301),academy_offering_test.uid(401),'Test','test@example.invalid','bank',1)$q$);
select public.academy_submit_offering_application(academy_offering_test.uid(301),academy_offering_test.uid(401),'Test','test@example.invalid','bank',2400);
select public.academy_submit_offering_application(academy_offering_test.uid(301),academy_offering_test.uid(401),'Test','test@example.invalid','bank',2400);
select academy_offering_test.ok((select count(*)=1 from public.academy_offering_applications where offering_id=academy_offering_test.uid(301)),'duplicate idempotent');
select academy_offering_test.ok(exists(select 1 from public.academy_list_my_contexts() where academy_id=academy_offering_test.uid(100) and 'learner'=any(roles)),'pending learner context');
select academy_offering_test.denied($q$select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(301)))$q$);
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(301)));
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(301)));
select academy_offering_test.ok((select count(*)=2 from public.academy_offering_application_grants),'two bridge grants only');
select set_config('request.jwt.claim.sub',academy_offering_test.uid(3)::text,true);
select academy_offering_test.ok(private.academy_has_course_content_access(academy_offering_test.uid(101),academy_offering_test.uid(3)),'real lesson access helper recognizes new grants');
select set_config('request.jwt.claim.sub',academy_offering_test.uid(4)::text,true);
select academy_offering_test.ok(not private.academy_has_course_content_access(academy_offering_test.uid(101),academy_offering_test.uid(4)),'unrelated learner no lesson access');
select academy_offering_test.ok(not exists(select 1 from public.academy_offering_applications where offering_id=academy_offering_test.uid(301)),'other learner hidden');
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
insert into public.academy_offerings(id,headquarters_id,title,course_ids,price,status,purchase_mode,stage_prices)
 values(academy_offering_test.uid(501),academy_offering_test.uid(100),'Staged',array[academy_offering_test.uid(101),academy_offering_test.uid(102)],2700,'published','staged',jsonb_build_object(academy_offering_test.uid(101)::text,1200,academy_offering_test.uid(102)::text,1500));
select set_config('request.jwt.claim.sub',academy_offering_test.uid(4)::text,true);
select public.academy_submit_offering_application(academy_offering_test.uid(501),academy_offering_test.uid(601),'Test','test@example.invalid','bank',1200);
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(501)));
select set_config('request.jwt.claim.sub',academy_offering_test.uid(4)::text,true);
select academy_offering_test.denied($q$select public.academy_submit_offering_application(academy_offering_test.uid(501),academy_offering_test.uid(602),'Test','test@example.invalid','bank',1500)$q$);
select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(501)));
select public.academy_submit_offering_application(academy_offering_test.uid(501),academy_offering_test.uid(602),'Test','test@example.invalid','bank',1500);
select academy_offering_test.ok((select count(*)=2 from public.academy_offering_applications where offering_id=academy_offering_test.uid(501)),'second stage unlocked after completion');
reset role;
-- The invoking runner MUST execute ROLLBACK, then check all new tables and fixtures absent.
update public.academy_courses set learner_access_mode='days_after_completion',learner_access_days=7 where id=academy_offering_test.uid(101);
set local role authenticated;
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
insert into public.academy_offerings(id,headquarters_id,title,course_ids,price,status) values(academy_offering_test.uid(701),academy_offering_test.uid(100),'Completion access',array[academy_offering_test.uid(101)],100,'published');
select set_config('request.jwt.claim.sub',academy_offering_test.uid(4)::text,true);
select public.academy_submit_offering_application(academy_offering_test.uid(701),academy_offering_test.uid(702),'Test','test@example.invalid','bank',100);
select set_config('request.jwt.claim.sub',academy_offering_test.uid(1)::text,true);
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(701)));
select academy_offering_test.ok(not exists(select 1 from public.academy_offering_application_grants g join public.academy_offering_applications a on a.id=g.application_id where a.offering_id=academy_offering_test.uid(701)),'completion access withheld before completion');
select set_config('request.jwt.claim.sub',academy_offering_test.uid(4)::text,true);
select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(701)));
select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=academy_offering_test.uid(701)));
select academy_offering_test.ok((select count(*)=1 from public.academy_offering_application_grants g join public.academy_offering_applications a on a.id=g.application_id where a.offering_id=academy_offering_test.uid(701)),'completion access grant idempotent');
reset role;
select academy_offering_test.ok((select g.ends_at=a.completed_at+interval '7 days' from public.academy_course_access_grants g join public.academy_offering_application_grants b on b.access_grant_id=g.id join public.academy_offering_applications a on a.id=b.application_id where a.offering_id=academy_offering_test.uid(701)),'completion duration snapshot');
