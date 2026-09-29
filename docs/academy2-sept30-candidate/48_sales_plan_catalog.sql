-- Production candidate; review and isolated validation required before approval.
-- Read-only catalog publication projection. No publication, contract or billing mutation.
create or replace function academy2_access.sales_plan_catalog(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(academy2_access.sales_plan_draft(p_hq,d.id)||jsonb_build_object('publication',jsonb_build_object(
 'state',case when pub.plan_id is null then 'not_published' when o.id is null then 'unknown' when o.status='archived' then 'archived' when dto.value->>'status'='published' then 'published' else 'unavailable' end,
 'offering_id',o.id,'public_path',case when dto.value->>'status'='published' then '/academy/o/'||o.id::text else null end,
 'published_at',pub.published_at,'plan_revision',pub.plan_revision,'page_revision',pub.page_revision,
 'has_unpublished_changes',case when pub.plan_id is null then false else pub.plan_revision<>d.revision or pub.page_revision is distinct from coalesce(page.revision,0) end
 )) order by d.updated_at desc,d.id),'[]'::jsonb) into result
 from academy2_access.sales_plan_drafts d
 left join academy2_access.plan_publications pub on pub.plan_id=d.id and pub.headquarters_id=p_hq
 left join public.academy_offerings o on o.id=pub.offering_id and o.headquarters_id=p_hq
 left join academy2_access.sales_pages page on page.plan_id=d.id and page.headquarters_id=p_hq
 left join lateral(select public.academy_get_public_offering(o.id) value) dto on o.id is not null
 where d.headquarters_id=p_hq;
 return result;
end $$;
revoke all on function academy2_access.sales_plan_catalog(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.sales_plan_catalog(uuid) to authenticated;
create or replace function public.academy2_sales_plan_catalog(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.sales_plan_catalog(p_headquarters_id)$$;
revoke all on function public.academy2_sales_plan_catalog(uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_sales_plan_catalog(uuid) to authenticated;
notify pgrst,'reload schema';
