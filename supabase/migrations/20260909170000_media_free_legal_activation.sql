-- Activate the approved Media Free legal bundle. This migration deliberately
-- keeps publication fail closed unless the complete approved bundle is accepted.

alter table private.media_legal_revisions
  drop constraint if exists media_legal_revisions_document_url_check;
alter table private.media_legal_revisions
  add constraint media_legal_revisions_document_url_check
  check (document_url ~ '^/legal/media/[a-z0-9/-]+$'),
  add column documents jsonb not null default '{}'::jsonb
  check (jsonb_typeof(documents)='object');

alter table public.media_terms_acceptances
  add column legal_documents jsonb not null default '{}'::jsonb
  check (jsonb_typeof(legal_documents)='object');
alter table public.media_article_publication_attestations
  add column legal_documents jsonb not null default '{}'::jsonb
  check (jsonb_typeof(legal_documents)='object');

create or replace function public.media_current_terms() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'termsVersion',l.terms_version,
    'documentSha256',l.document_sha256,
    'documentUrl',l.document_url,
    'documents',l.documents,
    'accepted',exists(
      select 1 from public.media_terms_acceptances t
      where t.owner_id=auth.uid() and t.terms_version=l.terms_version
        and t.document_sha256=l.document_sha256 and t.legal_documents=l.documents
    )
  )
  from private.media_legal_revisions l
  where l.is_active and private.media_is_human_user();
$$;

create or replace function public.media_accept_terms(
  p_terms_version text,p_document_sha256 text,p_confirmed boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_legal private.media_legal_revisions%rowtype;
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  if p_confirmed is distinct from true then raise exception 'MEDIA_TERMS_EXPLICIT_CONSENT_REQUIRED'; end if;
  select * into v_legal from private.media_legal_revisions
    where terms_version=p_terms_version and document_sha256=p_document_sha256 and is_active for share;
  if not found then raise exception 'MEDIA_TERMS_NOT_ACTIVE'; end if;
  insert into public.media_terms_acceptances(owner_id,terms_version,document_sha256,legal_documents)
    values(auth.uid(),v_legal.terms_version,v_legal.document_sha256,v_legal.documents)
    on conflict(owner_id,terms_version) do update set
      document_sha256=excluded.document_sha256,
      legal_documents=excluded.legal_documents,
      accepted_at=now();
end $$;

create or replace function public.media_create_site(
  p_name text,p_slug text,p_description text,p_author_name text,p_default_locale text default 'ja-JP'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid()); v_site uuid;
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  if not exists(
    select 1 from private.media_legal_revisions l
    join public.media_terms_acceptances t
      on t.owner_id=v_owner and t.terms_version=l.terms_version
      and t.document_sha256=l.document_sha256 and t.legal_documents=l.documents
    where l.is_active
  ) then raise exception 'MEDIA_TERMS_ACCEPTANCE_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media-free:'||v_owner::text,0));
  if exists(select 1 from public.media_sites s where s.owner_id=v_owner and s.publishing_policy='direct_owner')
    then raise exception 'MEDIA_FREE_SITE_LIMIT_REACHED'; end if;
  insert into public.media_sites(owner_id,name,slug,description,author_name,default_locale,publishing_policy)
  values(v_owner,btrim(p_name),lower(btrim(p_slug)),coalesce(p_description,''),btrim(p_author_name),
    coalesce(nullif(btrim(p_default_locale),''),'ja-JP'),'direct_owner') returning id into v_site;
  insert into public.mikke_app_entitlements(user_id,app_key,status,source,starts_at,ends_at,note,updated_at)
  values(v_owner,'media','active','media_create',now(),null,'Media creation completed',now())
  on conflict(user_id,app_key) do update set status='active',source='media_create',
    starts_at=coalesce(public.mikke_app_entitlements.starts_at,excluded.starts_at),
    ends_at=null,note=excluded.note,updated_at=now();
  return v_site;
end $$;

create or replace function public.media_publish_article_reviewed(
  p_article_id uuid,p_expected_revision text,p_terms_version text,
  p_rights_confirmed boolean,p_privacy_confirmed boolean,p_affiliate_free_confirmed boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare reviewed jsonb; v_version_id uuid; v_documents jsonb;
begin
  reviewed:=private.media_review_payload(p_article_id);
  if p_expected_revision is null or length(p_expected_revision)<>64 or p_expected_revision !~ '^[a-f0-9]+$'
    or reviewed->>'expectedRevision'<>p_expected_revision then raise exception 'MEDIA_REVIEW_REVISION_CHANGED'; end if;
  select l.documents into v_documents
  from private.media_legal_revisions l join public.media_terms_acceptances t
    on t.terms_version=l.terms_version and t.document_sha256=l.document_sha256
      and t.legal_documents=l.documents
  where l.terms_version=p_terms_version and l.is_active and t.owner_id=auth.uid() for share of l,t;
  if not found then raise exception 'MEDIA_TERMS_ACCEPTANCE_REQUIRED'; end if;
  if p_rights_confirmed is distinct from true or p_privacy_confirmed is distinct from true
    or p_affiliate_free_confirmed is distinct from true then raise exception 'MEDIA_PUBLICATION_ATTESTATION_REQUIRED'; end if;
  v_version_id:=public.media_publish_article(p_article_id,p_terms_version,true,true,true);
  update public.media_article_publication_attestations
    set legal_documents=v_documents where version_id=v_version_id;
  insert into private.media_reviewed_publications(version_id,expected_revision)
    values(v_version_id,p_expected_revision);
  insert into private.media_public_image_tokens(token,version_id,asset_id,content_sha256)
    select replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      v_version_id,a.asset_id,a.content_sha256
    from public.media_article_version_assets a where a.version_id=v_version_id;
  return v_version_id;
end $$;

update private.media_legal_revisions set is_active=false where is_active;
insert into private.media_legal_revisions(
  terms_version,document_sha256,document_url,is_active,documents
) values (
  'media-free-terms-2026-09-09-v1',
  'bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5',
  '/legal/media/free/terms/2026-09-09-v1',
  true,
  '{
    "terms":{"version":"media-free-terms-2026-09-09-v1","sha256":"bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5","url":"/legal/media/free/terms/2026-09-09-v1"},
    "privacy":{"version":"media-free-privacy-2026-09-09-v1","sha256":"eb05bebeca1cf826063eff4d151f5fad3c4525d53887c88eeb725082b11ab200","url":"/legal/media/free/privacy/2026-09-09-v1"},
    "contentPublication":{"version":"media-free-content-rules-2026-09-09-v1","sha256":"202a618a636784ff5cbd21942a20bfa4b2a4b903774fd742e2cb21ad0ce14543","url":"/legal/media/free/content-publication/2026-09-09-v1"},
    "reportData":{"version":"media-free-report-data-2026-09-09-v1","sha256":"4f18253629d3ac9acc89c32080d01526bbd58efe9e3a8d43456d79ae2bb27c0c","url":"/legal/media/free/report-data/2026-09-09-v1"}
  }'::jsonb
);

revoke all on function public.media_current_terms(),public.media_accept_terms(text,text,boolean),
  public.media_create_site(text,text,text,text,text),
  public.media_publish_article_reviewed(uuid,text,text,boolean,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.media_current_terms(),public.media_accept_terms(text,text,boolean),
  public.media_create_site(text,text,text,text,text),
  public.media_publish_article_reviewed(uuid,text,text,boolean,boolean,boolean) to authenticated;
