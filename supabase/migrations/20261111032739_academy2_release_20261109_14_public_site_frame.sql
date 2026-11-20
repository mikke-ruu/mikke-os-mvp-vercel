-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-public-site-frame.local.sql
-- Local candidate: read-only shared site chrome for direct course/application URLs.
-- No table, publication state, terms, consent, membership, or intake changes.
begin;
create function academy2_access.public_site_frame(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare canonical text; page jsonb; h jsonb;
begin
 select headquarters.handle into canonical from public.academy_headquarters headquarters
 join academy2_access.tenants tenant on tenant.headquarters_id=headquarters.id and tenant.runtime_enabled
 where headquarters.id=p_hq and headquarters.is_active;
 if not found then return null;end if;
 -- Only the existing published projection decides whether anything is public.
 page:=public.academy2_public_homepage(canonical);
 if page->>'mode' is distinct from 'academy2' or page#>>'{headquarters,id}' is distinct from p_hq::text then return null;end if;
 h:=page->'headquarters';
 return jsonb_build_object('id',h->'id','handle',h->'handle','name',h->'name','tagline',h->'tagline',
  'front_message',h->'front_message','logo_url',h->'logo_url','contact_email',h->'contact_email','front_blocks',h->'front_blocks');
end $$;
create function public.academy2_public_site_frame(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.public_site_frame(p_headquarters_id)$$;
revoke all on function academy2_access.public_site_frame(uuid),public.academy2_public_site_frame(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.public_site_frame(uuid),public.academy2_public_site_frame(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
