-- Production candidate; review and isolated validation required before approval.
-- LOCAL CANDIDATE: read-only aggregate. Parent runs isolated tests before migration generation.
-- No enrollment, backfill, billing, publishing or legacy record changes.
create or replace function academy2_access.headquarters_home(p_hq uuid,p_month date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text:=academy2_access.my_role(p_hq); h public.academy_headquarters;
 m date:=coalesce(p_month,date_trunc('month',now() at time zone 'Asia/Tokyo')::date);
 apps jsonb:=null; events jsonb:=null; monthly jsonb:=null; notices jsonb:='[]'; upcoming jsonb:='[]';
 finance boolean; operations boolean; access_state text; result jsonb; instructor_count bigint;
begin
 if auth.uid() is null or r is null or r not in('owner','administrator','learning_operator','course_editor') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if m<>date_trunc('month',m)::date or m<'2000-01-01'::date or m>'2200-01-01'::date then raise exception 'academy2_invalid_month' using errcode='22023';end if;
 select * into h from public.academy_headquarters where id=p_hq;
 if h.id is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 finance:=academy2_access.can(p_hq,'finance.read');operations:=academy2_access.can(p_hq,'applications.read');
 if operations then apps:=academy2_access.hq_applications(p_hq);events:=academy2_access.events(p_hq);end if;
 if r in('owner','administrator','learning_operator') then
  select count(distinct coalesce(i.user_id,i.profile_id,i.id)) into instructor_count from public.academy_instructors i where i.headquarters_id=p_hq and i.registration_status='registered';
 end if;
 select a.status into access_state from public.academy_headquarters_access_states a where a.headquarters_id=p_hq;
 if r in('owner','administrator') and access_state in('past_due','expired','cancelled') then notices:=notices||jsonb_build_array(jsonb_build_object('id','access','title','Academyの利用状態をご確認ください','detail',case when access_state='past_due' then '利用料金の支払い確認が必要です。' else '利用期間または契約の確認が必要です。' end,'path','/academy/settings'));end if;
 if r in('owner','administrator') and exists(select 1 from academy2_access.payment_provider_connections p where p.headquarters_id=p_hq) and not academy2_access.payment_provider_ready(p_hq) then notices:=notices||jsonb_build_array(jsonb_build_object('id','payment','title','カード決済の接続をご確認ください','detail','登録済みの接続が現在の利用条件を満たしていません。','path','/academy/settings'));end if;
 if operations then
  select coalesce(jsonb_agg(jsonb_build_object('id',a->>'applicationId','title',case when a->>'nextAction' in('record_shipping','ship_kit','set_shipping_destination') then 'キット発送' else '認定確認' end,'detail',a->>'applicantName','path','/academy/applications/'||(a->>'applicationId'))),'[]') into upcoming from (select value a from jsonb_array_elements(apps) where value->>'nextAction' in('record_shipping','ship_kit','set_shipping_destination','confirm_certification','review_outcome') limit 3) q;
 end if;
 if r in('owner','administrator','learning_operator') then
  select upcoming||coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title','講師登録の更新確認','detail',coalesce(i.business_name,'講師')||'・期限 '||i.renewal_due::text,'path','/academy/instructors/'||i.id::text)),'[]') into upcoming from (select * from public.academy_instructors where headquarters_id=p_hq and registration_status='registered' and renewal_due is not null and renewal_due<=(now() at time zone 'Asia/Tokyo')::date+14 order by renewal_due,id limit 3) i;
 end if;
 if finance or operations then
  with months as (select generate_series(m::timestamp-interval '5 months',m::timestamp,interval '1 month')::date AS month_start),
  scoped as (select a.*,e.application_id is not null as headquarters_sale from public.academy_offering_applications a left join academy2_access.operation_enrollments e on e.application_id=a.id and e.headquarters_id=p_hq where a.headquarters_id=p_hq and (e.application_id is not null or exists(select 1 from academy2_access.opening_license_origins o join academy2_access.instructor_workflows w on w.application_id=o.application_id where o.application_id=a.id and o.headquarters_id=p_hq)))
  select jsonb_agg(jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'salesYen',case when finance then (select coalesce(sum(a.price),0) from scoped a where a.headquarters_sale and a.status='paid' and (a.paid_at at time zone 'Asia/Tokyo')>=month_start and (a.paid_at at time zone 'Asia/Tokyo')<month_start+interval '1 month') else null end,'applications',case when operations then (select count(*) from scoped a where (a.created_at at time zone 'Asia/Tokyo')>=month_start and (a.created_at at time zone 'Asia/Tokyo')<month_start+interval '1 month') else null end) order by month_start) into monthly from months;
 end if;
 result:=jsonb_build_object('headquartersId',p_hq,'observedAt',now(),'month',to_char(m,'YYYY-MM'),'name',h.name,'heroImageUrl',h.hero_image_url,'logoUrl',h.logo_url,'publicHomepagePath',case when h.is_active then '/academy/site/'||h.handle else null end,'accessStatus',access_state,'instructorCount',instructor_count,
 'publishedPageCount',(select count(*) from public.academy_offerings o where o.headquarters_id=p_hq and o.status='published' and h.is_active),
 'setup',jsonb_build_object('course',exists(select 1 from public.academy_courses where headquarters_id=p_hq),'plan',exists(select 1 from academy2_access.sales_plan_drafts where headquarters_id=p_hq),'page',coalesce(h.front_blocks::jsonb,'[]'::jsonb) not in('[]'::jsonb,'{}'::jsonb,'null'::jsonb),'published',exists(select 1 from public.academy_offerings o where o.headquarters_id=p_hq and o.status='published' and h.is_active)),
 'permissions',jsonb_build_object('operations',operations,'finance',finance,'editCourses',academy2_access.can(p_hq,'courses.edit'),'editPages',academy2_access.can(p_hq,'pages.edit')),
 'notices',notices,'applications',apps,'events',events,'monthly',monthly,'upcoming',upcoming);
 return result;
end $$;
revoke all on function academy2_access.headquarters_home(uuid,date) from public,anon,authenticated,service_role;
grant execute on function academy2_access.headquarters_home(uuid,date) to authenticated;
create or replace function public.academy2_headquarters_home(p_headquarters_id uuid,p_month date default null) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.headquarters_home(p_headquarters_id,p_month)$$;
revoke all on function public.academy2_headquarters_home(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.academy2_headquarters_home(uuid,date) to authenticated;
notify pgrst,'reload schema';



