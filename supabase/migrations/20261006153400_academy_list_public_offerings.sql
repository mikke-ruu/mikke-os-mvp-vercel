-- Return only published offerings for an active, publicly available HQ.
-- The caller never receives payment settings, draft content or manager rows.
create or replace function public.academy_list_public_offerings(p_headquarters_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'headquarters_id', o.headquarters_id,
    'title', o.title,
    'kind', o.kind,
    'course_ids', o.course_ids,
    'price', o.price,
    'currency', o.currency,
    'purchase_mode', o.purchase_mode,
    'status', o.status
  ) order by o.created_at asc), '[]'::jsonb)
  from public.academy_offerings o
  join public.academy_headquarters h on h.id = o.headquarters_id
  where o.headquarters_id = p_headquarters_id
    and h.is_active = true
    and public.academy_is_publicly_available(h.id)
    and o.status = 'published'
    and o.title is not null and btrim(o.title) <> ''
    and o.currency = 'JPY'
    and o.purchase_mode in ('all', 'staged')
    and o.price >= 0 and o.price = trunc(o.price)
    and coalesce(array_length(o.course_ids, 1), 0) > 0
    and not exists (
      select 1 from unnest(o.course_ids) course_id
      left join public.academy_courses c
        on c.id = course_id and c.headquarters_id = h.id
      where c.id is null or c.is_published is distinct from true
    );
$function$;

revoke all on function public.academy_list_public_offerings(uuid) from public;
grant execute on function public.academy_list_public_offerings(uuid) to anon, authenticated;
