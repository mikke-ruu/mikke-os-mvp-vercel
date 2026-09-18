-- Runs with the existing disposable fixture, migrations and base regression suites.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
insert into public.academy_offerings(id,headquarters_id,title,course_ids,price,status,completion_mode)
values(test.uid(801),test.uid(100),'HQ completion',array[test.uid(101)],100,'published','hq'),
      (test.uid(802),test.uid(100),'Learner completion',array[test.uid(101)],100,'published','learner');
select set_config('request.jwt.claim.sub',test.uid(4)::text,true);
select public.academy_submit_offering_application(test.uid(801),test.uid(811),'Learner','l@example.invalid','bank',100);
select public.academy_submit_offering_application(test.uid(802),test.uid(812),'Learner','l@example.invalid','bank',100);
select test.ok((select purchase_snapshot->>'completion_mode'='hq' from public.academy_offering_applications where offering_id=test.uid(801)),'all HQ completion snapshotted');
select test.ok((select purchase_snapshot->>'completion_mode'='learner' from public.academy_offering_applications where offering_id=test.uid(802)),'all learner completion snapshotted');
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
update public.academy_offerings set completion_mode='learner' where id=test.uid(801);
update public.academy_offerings set completion_mode='hq' where id=test.uid(802);
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=test.uid(801)));
select public.academy_confirm_offering_payment((select id from public.academy_offering_applications where offering_id=test.uid(802)));
select set_config('request.jwt.claim.sub',test.uid(4)::text,true);
select test.denied($q$select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=test.uid(801)))$q$);
select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=test.uid(802)));
select set_config('request.jwt.claim.sub',test.uid(1)::text,true);
select public.academy_complete_offering_course((select id from public.academy_offering_applications where offering_id=test.uid(801)));
select test.ok((select bool_and(completed_at is not null) from public.academy_offering_applications where offering_id in(test.uid(801),test.uid(802))),'both approved completion paths');
reset role;
