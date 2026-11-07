-- Draft migration; not applied to production. Per-person, per-project basis.
alter table public.team_works_project_partner_settings add column calculation_basis text not null default 'scheduled' check(calculation_basis in ('scheduled','actual'));
-- Preserve scheduled duration and the configured rate at completion. Historic
-- classes are deliberately imported without a guessed historic rate.
create table public.team_works_partner_lesson_history (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 project_id uuid not null references public.team_works_projects(id),
 organization_member_id uuid not null references public.team_works_organization_members(id),
 session_date date not null,
 start_time time not null,
 duration_min integer not null check(duration_min>0),
 participation_role text not null check(participation_role in ('primary','training')),
 hourly_wage integer check(hourly_wage>=0),
 calculation_basis text not null default 'scheduled' check(calculation_basis in ('scheduled','actual')),
 actual_minutes integer check(actual_minutes between 0 and 1440),
 amount_yen numeric generated always as (round(hourly_wage::numeric * (case when calculation_basis='actual' then actual_minutes else duration_min end) / 60)) stored,
 created_at timestamptz not null default now(),
 unique(session_id,organization_member_id)
);
alter table public.team_works_partner_lesson_history enable row level security;
revoke all on public.team_works_partner_lesson_history from public,anon,authenticated;
grant select on public.team_works_partner_lesson_history to authenticated;
grant update(hourly_wage,actual_minutes) on public.team_works_partner_lesson_history to authenticated;
grant all on public.team_works_partner_lesson_history to service_role;
create policy history_read on public.team_works_partner_lesson_history for select to authenticated using (
 private.team_works_is_project_staff(project_id) or exists (
 select 1 from public.team_works_organization_members m where m.id=organization_member_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='worker'));
create policy history_rate_update on public.team_works_partner_lesson_history for update to authenticated
 using(private.team_works_is_project_staff(project_id)) with check(private.team_works_is_project_staff(project_id));
create index team_works_partner_history_month on public.team_works_partner_lesson_history(organization_member_id,session_date);

create function private.team_works_capture_partner_lesson() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='cancelled' or not(new.status='completed' or new.partner_presence_status='ended') then return new; end if;
 if tg_op='UPDATE' and (old.status='completed' or old.partner_presence_status='ended') then return new; end if;
 insert into public.team_works_partner_lesson_history(session_id,project_id,organization_member_id,session_date,start_time,duration_min,participation_role,hourly_wage,calculation_basis)
 select new.id,new.project_id,v.member_id,new.session_date,new.start_time,new.duration_min,v.kind,
 case when v.kind='primary' and new.session_date >= (now() at time zone 'Asia/Tokyo')::date then ps.hourly_wage else null end,coalesce(ps.calculation_basis,'scheduled')
 from (values(new.partner_member_id,'primary'),(new.training_partner_member_id,'training')) v(member_id,kind)
 left join public.team_works_project_partner_settings ps on ps.project_id=new.project_id and ps.organization_member_id=v.member_id
 where v.member_id is not null
 on conflict(session_id,organization_member_id) do nothing;
 return new;
end; $$;
revoke all on function private.team_works_capture_partner_lesson() from public,anon,authenticated;
create trigger capture_partner_lesson after insert or update on public.team_works_op_sessions for each row execute function private.team_works_capture_partner_lesson();
insert into public.team_works_partner_lesson_history(session_id,project_id,organization_member_id,session_date,start_time,duration_min,participation_role)
 select s.id,s.project_id,v.member_id,s.session_date,s.start_time,s.duration_min,v.kind
 from public.team_works_op_sessions s
 cross join lateral(values(s.partner_member_id,'primary'),(s.training_partner_member_id,'training')) v(member_id,kind)
 where v.member_id is not null and s.status<>'cancelled' and (s.status='completed' or s.partner_presence_status='ended')
 on conflict(session_id,organization_member_id) do nothing;

-- This endpoint returns only the staff-selected partner or the caller's own
-- memberships; no roster, customer contacts, or other partners' rates.
create function private.team_works_partner_history(target_partner uuid,month_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); member_ids uuid[]; result jsonb; partner_name text;
begin
 if uid is null then raise exception 'not authenticated'; end if;
 if month_start is null or month_start<>date_trunc('month',month_start)::date then raise exception 'invalid month'; end if;
 if target_partner is not null then
  if not exists(select 1 from public.team_works_partners d where d.id=target_partner and private.team_works_is_org_staff(d.organization_id)) then raise exception 'not permitted'; end if;
  select display_name into partner_name from public.team_works_partners where id=target_partner;
  select array_agg(m.id) into member_ids from public.team_works_partners d join auth.users u on lower(u.email)=lower(d.email)
   join public.team_works_organization_members m on m.user_id=u.id and m.organization_id=d.organization_id and m.role='worker' where d.id=target_partner;
 else
  select array_agg(m.id) into member_ids from public.team_works_organization_members m where m.user_id=uid and m.role='worker' and m.status='active';
 end if;
 member_ids:=coalesce(member_ids,'{}'::uuid[]);
 select jsonb_build_object('partnerName',partner_name,'rates',coalesce((
  select jsonb_agg(jsonb_build_object('projectId',p.id,'projectTitle',p.title,'memberId',m.id,'memberName',m.display_name,'hourlyWage',ps.hourly_wage,'calculationBasis',coalesce(ps.calculation_basis,'scheduled'),'status',coalesce(ps.status,'active'))) from public.team_works_project_members pm
  join public.team_works_projects p on p.id=pm.project_id and p.style='operations'
  join public.team_works_organization_members m on m.id=pm.organization_member_id
  left join public.team_works_project_partner_settings ps on ps.project_id=p.id and ps.organization_member_id=m.id
  where m.id=any(member_ids) and pm.project_role='worker'), '[]'::jsonb),
 'lessons',coalesce((select jsonb_agg(x.data order by x.lesson_day desc,x.start_at desc) from (
 select h.session_date as lesson_day,h.start_time start_at,jsonb_build_object('id',h.id,'sessionId',h.session_id,'projectId',h.project_id,'projectTitle',p.title,'memberId',h.organization_member_id,'date',h.session_date,'startTime',h.start_time,'minutes',h.duration_min,'role',h.participation_role,'status',case when s.id is null or s.status='cancelled' then 'cancelled' when s.id is not null and s.status<>'completed' and s.partner_presence_status<>'ended' then 'unconfirmed' else 'completed' end,'hourlyWage',h.hourly_wage,'calculationBasis',h.calculation_basis,'actualMinutes',h.actual_minutes,'amount',h.amount_yen) data
 from public.team_works_partner_lesson_history h join public.team_works_projects p on p.id=h.project_id left join public.team_works_op_sessions s on s.id=h.session_id
 where h.organization_member_id=any(member_ids) and h.session_date>=month_start and h.session_date<(month_start+interval '1 month')
 union all
 select s.session_date,s.start_time,jsonb_build_object('id',null,'sessionId',s.id,'projectId',s.project_id,'projectTitle',p.title,'memberId',v.member_id,'date',s.session_date,'startTime',s.start_time,'minutes',s.duration_min,'role',v.kind,'status',case when s.status='cancelled' then 'cancelled' else 'unconfirmed' end,'hourlyWage',null,'calculationBasis','scheduled','actualMinutes',null,'amount',null)
 from public.team_works_op_sessions s join public.team_works_projects p on p.id=s.project_id and p.style='operations'
 cross join lateral(values(s.partner_member_id,'primary'),(s.training_partner_member_id,'training')) v(member_id,kind)
 where v.member_id=any(member_ids) and s.session_date>=month_start and s.session_date<(month_start+interval '1 month')
 and (s.session_date+s.start_time+make_interval(mins=>s.duration_min)) at time zone 'Asia/Tokyo' <= now()
 and not exists(select 1 from public.team_works_partner_lesson_history h where h.session_id=s.id and h.organization_member_id=v.member_id)
 ) x),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function private.team_works_partner_history(uuid,date) from public,anon;
grant execute on function private.team_works_partner_history(uuid,date) to authenticated;
create function public.team_works_partner_history(target_partner uuid,month_start date)
returns jsonb language sql security invoker set search_path='' as $$ select private.team_works_partner_history(target_partner,month_start); $$;
revoke all on function public.team_works_partner_history(uuid,date) from public,anon;
grant execute on function public.team_works_partner_history(uuid,date) to authenticated;
notify pgrst,'reload schema';
