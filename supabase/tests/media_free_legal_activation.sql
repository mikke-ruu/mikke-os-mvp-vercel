begin;
set local search_path=public,pg_catalog;

do $$
declare legal jsonb;
begin
  select to_jsonb(l) into legal from private.media_legal_revisions l where l.is_active;
  if legal->>'terms_version'<>'media-free-terms-2026-09-09-v1'
    or legal->>'document_sha256'<>'bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5'
    or (select count(*) from jsonb_object_keys(legal->'documents'))<>4 then raise exception 'MEDIA_LEGAL_BUNDLE_INVALID'; end if;
end $$;

insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a9090000-0000-4000-8000-000000000001','media-legal@example.invalid','{}','{}',now(),now());
set local request.jwt.claim.sub='a9090000-0000-4000-8000-000000000001';
set local request.jwt.claim.role='authenticated';
set local request.jwt.claims='{"sub":"a9090000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}';
set local role authenticated;

do $$ begin
  perform public.media_create_site('No consent','no-consent','','Owner','ja-JP');
  raise exception 'MEDIA_CREATE_WITHOUT_CONSENT';
exception when others then
  if sqlerrm<>'MEDIA_TERMS_ACCEPTANCE_REQUIRED' then raise; end if;
end $$;

do $$
declare terms jsonb;
begin
  select public.media_current_terms() into terms;
  if terms is null or (terms->>'accepted')::boolean or (select count(*) from jsonb_object_keys(terms->'documents'))<>4
    then raise exception 'MEDIA_CURRENT_TERMS_INVALID'; end if;
end $$;

select public.media_accept_terms(
  'media-free-terms-2026-09-09-v1',
  'bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5',true
);

do $$
declare terms jsonb; site_id uuid;
begin
  select public.media_current_terms() into terms;
  if not (terms->>'accepted')::boolean then raise exception 'MEDIA_ACCEPTANCE_NOT_RECORDED'; end if;
  site_id:=public.media_create_site('Legal Media','legal-media','','Owner','ja-JP');
  if site_id is null then raise exception 'MEDIA_CREATE_AFTER_CONSENT_FAILED'; end if;
end $$;

reset role;
select 'media_free_legal_activation_test_ok';
rollback;
