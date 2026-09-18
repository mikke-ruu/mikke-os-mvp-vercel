-- Disposable dependency extension only, run in the same rolled-back test transaction.
alter table public.academy_instructors add column id uuid default gen_random_uuid(),add column course_id uuid,add column renewal_due date,add column instructor_number text;
insert into auth.users values(test.uid(6)),(test.uid(7));
insert into public.academy_instructors(headquarters_id,user_id,registration_status,is_certified,is_active,status,course_id,renewal_due,instructor_number) values
(test.uid(100),test.uid(4),'registered',true,true,'active',test.uid(101),current_date+30,'T-1'),
(test.uid(100),test.uid(4),'registered',true,true,'active',test.uid(102),current_date+30,'T-2'),
(test.uid(200),test.uid(5),'registered',true,true,'active',test.uid(101),current_date+30,'Wrong-HQ');
