-- Additive Media Free release boundary. No legal revision is activated here.
-- No public bucket is modified. Apply only after isolated replay and release review.

do $$ begin
  if exists(select 1 from storage.buckets where id='mikke-media-private'
    and (public or file_size_limit is distinct from 3145728
      or allowed_mime_types is distinct from array['image/webp']::text[])) then
    raise exception 'MEDIA_PRIVATE_BUCKET_CONFIGURATION_CONFLICT';
  end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mikke-media-private','mikke-media-private',false,3145728,array['image/webp'])
on conflict(id) do nothing;
-- Restrictive only for the new private bucket; unrelated permissive policies cannot expose it.
create policy media_private_bucket_server_only on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id<>'mikke-media-private') with check(bucket_id<>'mikke-media-private');

alter table public.media_sites add constraint media_sites_reserved_slug check(slug<>'images');
alter table public.media_sites add column moderation_hold boolean not null default false,
  add column deleted_at timestamptz;
alter table public.media_articles add column moderation_hold boolean not null default false,
  add column deleted_at timestamptz;
-- Hard deletion is deliberately closed until hold/retention operation is approved.
revoke delete on public.media_sites,public.media_articles from authenticated;

create table private.media_private_images (
  asset_id uuid primary key references public.mikke_media_assets(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  bucket text not null default 'mikke-media-private' check(bucket='mikke-media-private'),
  storage_object_id uuid not null,
  storage_updated_at timestamptz not null,
  registered_sha256 text not null check(registered_sha256 ~ '^[a-f0-9]{64}$'),
  moderation_hold boolean not null default false,
  deleted_at timestamptz,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_private_images_owner_idx on private.media_private_images(owner_id);

create function private.media_touch_review_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
create trigger media_site_touch_review before update on public.media_sites for each row execute function private.media_touch_review_revision();
create trigger media_article_touch_review before update on public.media_articles for each row execute function private.media_touch_review_revision();
create trigger media_image_touch_review before update on private.media_private_images for each row execute function private.media_touch_review_revision();
revoke all on function private.media_touch_review_revision() from public,anon,authenticated;

create table private.media_public_image_tokens (
  token text primary key check(token ~ '^[a-f0-9]{64}$'),
  version_id uuid not null references public.media_article_versions(id) on delete restrict,
  asset_id uuid not null references private.media_private_images(asset_id) on delete restrict,
  content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(version_id,asset_id)
);
create index media_public_image_tokens_asset_idx on private.media_public_image_tokens(asset_id);

create table private.media_reviewed_publications (
  version_id uuid primary key references public.media_article_versions(id) on delete restrict,
  expected_revision text not null check(expected_revision ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.media_reviewed_publications enable row level security;
revoke all on private.media_reviewed_publications from public,anon,authenticated;

create table private.media_legal_revisions (
  terms_version text primary key check(char_length(terms_version) between 1 and 120),
  document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  document_url text not null check(document_url ~ '^/legal/media/[a-z0-9-]+$'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(terms_version,document_sha256)
);
create unique index media_legal_one_active on private.media_legal_revisions(is_active) where is_active;
alter table public.media_terms_acceptances add column document_sha256 text;
alter table public.media_terms_acceptances add constraint media_terms_document_fk
  foreign key(terms_version,document_sha256) references private.media_legal_revisions(terms_version,document_sha256);
alter table private.media_private_images enable row level security;
alter table private.media_public_image_tokens enable row level security;
alter table private.media_legal_revisions enable row level security;
revoke all on private.media_private_images,private.media_public_image_tokens,private.media_legal_revisions
  from public,anon,authenticated;

create or replace function public.media_register_private_image(
  p_owner_id uuid,p_storage_path text,p_byte_size bigint,p_content_sha256 text,p_original_name text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_asset public.mikke_media_assets%rowtype; v_object storage.objects%rowtype;
  v_limit bigint; v_used bigint;
begin
  if p_owner_id is null or not exists(select 1 from auth.users u where u.id=p_owner_id
    and not coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)) then
    raise exception 'MEDIA_HUMAN_AUTH_REQUIRED';
  end if;
  if p_storage_path is null or p_storage_path !~ ('^'||p_owner_id::text||'/media/[a-f0-9]{64}[.]webp$')
    or p_byte_size is null or p_byte_size not between 1 and 3145728
    or p_content_sha256 is null or p_content_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'MEDIA_INVALID_PRIVATE_IMAGE';
  end if;
  -- Same lock and combined accounting as the existing shared Media reservation RPC.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text,0));
  if not exists(select 1 from public.media_sites s where s.owner_id=p_owner_id
    and s.publishing_policy='direct_owner' and not s.moderation_hold and s.deleted_at is null) then
    raise exception 'MEDIA_SITE_NOT_AVAILABLE';
  end if;
  select * into v_object from storage.objects o where o.bucket_id='mikke-media-private'
    and o.name=p_storage_path for share;
  if not found or v_object.updated_at is null
    or (v_object.metadata->>'size')::bigint is distinct from p_byte_size
    or v_object.metadata->>'mimetype' is distinct from 'image/webp' then
    raise exception 'MEDIA_STORAGE_OBJECT_NOT_VERIFIED';
  end if;
  select * into v_asset from public.mikke_media_assets where storage_path=p_storage_path;
  if found then
    if v_asset.owner_id=p_owner_id and v_asset.status='active' and v_asset.byte_size=p_byte_size
      and v_asset.content_sha256=p_content_sha256 and exists(select 1 from private.media_private_images p
        where p.asset_id=v_asset.id and p.owner_id=p_owner_id and p.registered_sha256=p_content_sha256
          and p.storage_object_id=v_object.id and p.storage_updated_at=v_object.updated_at
          and not p.moderation_hold and p.deleted_at is null) then
      return jsonb_build_object('assetId',v_asset.id);
    end if;
    raise exception 'MEDIA_PRIVATE_IMAGE_IDEMPOTENCY_CONFLICT';
  end if;
  insert into public.mikke_media_accounts(owner_id) values(p_owner_id) on conflict do nothing;
  select max_bytes into v_limit from public.mikke_media_accounts where owner_id=p_owner_id for update;
  select coalesce(sum(byte_size),0) into v_used from public.mikke_media_assets
    where owner_id=p_owner_id and status in('pending','active','trashed');
  if v_used+p_byte_size>v_limit then raise exception 'MIKKE_MEDIA_QUOTA_EXCEEDED'; end if;
  insert into public.mikke_media_assets(owner_id,storage_path,original_name,mime_type,byte_size,source_app,status,content_sha256)
    values(p_owner_id,p_storage_path,left(coalesce(nullif(p_original_name,''),'image.webp'),255),
      'image/webp',p_byte_size,'media-private','active',p_content_sha256) returning * into v_asset;
  insert into private.media_private_images(asset_id,owner_id,storage_object_id,storage_updated_at,registered_sha256)
    values(v_asset.id,p_owner_id,v_object.id,v_object.updated_at,p_content_sha256);
  return jsonb_build_object('assetId',v_asset.id);
end $$;

create or replace function public.media_resolve_owner_image(p_owner_id uuid,p_asset_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('bucket',p.bucket,'storagePath',a.storage_path,'mimeType',a.mime_type,
    'byteSize',a.byte_size,'contentSha256',a.content_sha256)
  from private.media_private_images p join public.mikke_media_assets a on a.id=p.asset_id
    join storage.objects o on o.id=p.storage_object_id and o.bucket_id=p.bucket and o.name=a.storage_path
  where p.asset_id=p_asset_id and p.owner_id=p_owner_id and a.owner_id=p_owner_id and a.status='active'
    and not p.moderation_hold and p.deleted_at is null and a.content_sha256=p.registered_sha256
    and o.updated_at=p.storage_updated_at and a.mime_type='image/webp'
    and (o.metadata->>'size')::bigint=a.byte_size and o.metadata->>'mimetype'='image/webp';
$$;

create or replace function private.media_asset_url_matches(p_url text,p_asset_id uuid,p_owner_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_url='/api/media/assets/'||p_asset_id::text
    and public.media_resolve_owner_image(p_owner_id,p_asset_id) is not null;
$$;

create or replace function public.media_resolve_public_image(p_token text)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.media_resolve_owner_image(p.owner_id,t.asset_id)
  from private.media_public_image_tokens t join private.media_private_images p on p.asset_id=t.asset_id
    join private.media_reviewed_publications reviewed on reviewed.version_id=t.version_id and reviewed.revoked_at is null
    join public.media_article_version_assets binding on binding.version_id=t.version_id and binding.asset_id=t.asset_id
    join public.media_article_versions v on v.id=t.version_id
    join public.media_articles a on a.id=v.article_id and a.current_published_version_id=v.id
    join public.media_sites s on s.id=a.site_id
  where t.token=p_token and length(p_token)=64 and p_token !~ '[^a-f0-9]' and t.revoked_at is null
    and a.status='published' and s.is_published and not a.moderation_hold and a.deleted_at is null
    and not s.moderation_hold and s.deleted_at is null and s.owner_id=p.owner_id
    and t.content_sha256=binding.content_sha256 and t.content_sha256=p.registered_sha256;
$$;

create or replace function private.media_revoke_image_tokens() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='media_sites' then
    if not (new.moderation_hold or new.deleted_at is not null) then return new; end if;
    update private.media_reviewed_publications r set revoked_at=coalesce(r.revoked_at,now())
      from public.media_article_versions v where v.id=r.version_id and v.site_id=new.id;
    update private.media_public_image_tokens t set revoked_at=coalesce(t.revoked_at,now())
      from public.media_article_versions v where v.id=t.version_id and v.site_id=new.id;
  elsif tg_table_name='media_articles' then
    if not (new.moderation_hold or new.deleted_at is not null
      or new.status<>'published' or new.current_published_version_id is distinct from old.current_published_version_id) then return new; end if;
    update private.media_reviewed_publications r set revoked_at=coalesce(r.revoked_at,now())
      from public.media_article_versions v where v.id=r.version_id and v.article_id=new.id;
    update private.media_public_image_tokens t set revoked_at=coalesce(t.revoked_at,now())
      from public.media_article_versions v where v.id=t.version_id and v.article_id=new.id;
  elsif tg_table_name='media_private_images' then
    if not (new.moderation_hold or new.deleted_at is not null) then return new; end if;
    update private.media_public_image_tokens set revoked_at=coalesce(revoked_at,now()) where asset_id=new.asset_id;
  elsif tg_table_name='mikke_media_assets' then
    if not (new.status<>'active' or new.content_sha256 is distinct from old.content_sha256) then return new; end if;
    update private.media_private_images set updated_at=clock_timestamp() where asset_id=new.id;
    update private.media_public_image_tokens set revoked_at=coalesce(revoked_at,now()) where asset_id=new.id;
  end if;
  return new;
end $$;
create trigger media_site_image_revocation after update on public.media_sites for each row execute function private.media_revoke_image_tokens();
create trigger media_article_image_revocation after update on public.media_articles for each row execute function private.media_revoke_image_tokens();
create trigger media_private_image_revocation after update on private.media_private_images for each row execute function private.media_revoke_image_tokens();
create trigger media_asset_image_revocation after update on public.mikke_media_assets for each row execute function private.media_revoke_image_tokens();

create or replace function public.media_current_terms() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('termsVersion',l.terms_version,'documentSha256',l.document_sha256,'documentUrl',l.document_url,
    'accepted',exists(select 1 from public.media_terms_acceptances t where t.owner_id=auth.uid()
      and t.terms_version=l.terms_version and t.document_sha256=l.document_sha256))
    from private.media_legal_revisions l where l.is_active and private.media_is_human_user();
$$;
create or replace function public.media_accept_terms(p_terms_version text,p_document_sha256 text,p_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  if p_confirmed is distinct from true then raise exception 'MEDIA_TERMS_EXPLICIT_CONSENT_REQUIRED'; end if;
  perform 1 from private.media_legal_revisions where terms_version=p_terms_version
    and document_sha256=p_document_sha256 and is_active for share;
  if not found then raise exception 'MEDIA_TERMS_NOT_ACTIVE'; end if;
  insert into public.media_terms_acceptances(owner_id,terms_version,document_sha256)
    values(auth.uid(),p_terms_version,p_document_sha256)
    on conflict(owner_id,terms_version) do update set document_sha256=excluded.document_sha256,accepted_at=now()
      where public.media_terms_acceptances.document_sha256 is null;
end $$;

create or replace function private.media_review_payload(p_article_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.media_sites%rowtype; a public.media_articles%rowtype; category_name text:='';
  snapshot jsonb; bindings jsonb; asset_ids uuid[];
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  select * into s from public.media_sites where id=(select site_id from public.media_articles where id=p_article_id) for update;
  if not found or s.owner_id<>auth.uid() or s.publishing_policy<>'direct_owner'
    or s.moderation_hold or s.deleted_at is not null then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  select * into a from public.media_articles where id=p_article_id and site_id=s.id for update;
  if not found or a.moderation_hold or a.deleted_at is not null then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  if a.category_id is not null then
    select name into category_name from public.media_categories where id=a.category_id and site_id=s.id for share;
    if not found then raise exception 'MEDIA_CATEGORY_NOT_AVAILABLE'; end if;
  end if;
  if not private.media_blocks_are_safe(a.draft_blocks,s.owner_id) then raise exception 'MEDIA_UNSAFE_BLOCKS'; end if;
  if a.cover_image_asset_id is null and a.cover_image_url<>'' then raise exception 'MEDIA_COVER_ASSET_REQUIRED'; end if;
  select array_agg(distinct asset_id) into asset_ids from (
    select a.cover_image_asset_id asset_id union all
    select (b->>'imageAssetId')::uuid from jsonb_array_elements(a.draft_blocks) b where b->>'type'='image'
  ) q where asset_id is not null;
  perform m.id from public.mikke_media_assets m join private.media_private_images p on p.asset_id=m.id
    where m.id=any(coalesce(asset_ids,array[]::uuid[])) order by m.id for share of m,p;
  perform o.id from storage.objects o join private.media_private_images p on p.storage_object_id=o.id
    where p.asset_id=any(coalesce(asset_ids,array[]::uuid[])) order by o.id for share of o;
  if exists(select 1 from unnest(coalesce(asset_ids,array[]::uuid[])) id
    where public.media_resolve_owner_image(s.owner_id,id) is null) then raise exception 'MEDIA_ASSET_NOT_AVAILABLE'; end if;
  if not private.media_blocks_are_safe(a.draft_blocks,s.owner_id) or (a.cover_image_asset_id is not null
    and not private.media_asset_url_matches(a.cover_image_url,a.cover_image_asset_id,s.owner_id)) then
    raise exception 'MEDIA_UNSAFE_ASSET_REFERENCE';
  end if;
  if exists(select 1 from jsonb_array_elements(a.draft_blocks) b where b->>'type'='image'
    and btrim(coalesce(b->>'alt',''))='') then raise exception 'MEDIA_IMAGE_ALT_REQUIRED'; end if;
  snapshot:=jsonb_build_object('title',a.title,'slug',a.slug,'excerpt',a.excerpt,'category',coalesce(category_name,''),
    'coverImageUrl',a.cover_image_url,'blocks',a.draft_blocks,
    'site',jsonb_build_object('name',s.name,'slug',s.slug,'description',s.description,'authorName',s.author_name,'locale',a.locale));
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'digest',m.content_sha256,'bytes',m.byte_size,'mime',m.mime_type,
    'path',m.storage_path,'object',p.storage_object_id,'objectUpdatedAt',p.storage_updated_at,'reviewUpdatedAt',p.updated_at,
    'assetUpdatedAt',m.updated_at) order by m.id),'[]'::jsonb)
    into bindings from public.mikke_media_assets m join private.media_private_images p on p.asset_id=m.id
    where m.id=any(coalesce(asset_ids,array[]::uuid[]));
  return jsonb_build_object('snapshot',snapshot,'expectedRevision',encode(sha256(convert_to(
    jsonb_build_object('article',a.id,'articleUpdatedAt',a.updated_at,'site',s.id,'siteUpdatedAt',s.updated_at,
      'snapshot',snapshot,'assets',bindings)::text,'UTF8')),'hex'));
end $$;
create or replace function public.media_review_article(p_article_id uuid) returns jsonb
language sql volatile security definer set search_path='' as $$ select private.media_review_payload(p_article_id); $$;

create or replace function public.media_publish_article_reviewed(p_article_id uuid,p_expected_revision text,p_terms_version text,
  p_rights_confirmed boolean,p_privacy_confirmed boolean,p_affiliate_free_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare reviewed jsonb; v_version_id uuid;
begin
  reviewed:=private.media_review_payload(p_article_id);
  if p_expected_revision is null or length(p_expected_revision)<>64 or p_expected_revision !~ '^[a-f0-9]+$'
    or reviewed->>'expectedRevision'<>p_expected_revision then raise exception 'MEDIA_REVIEW_REVISION_CHANGED'; end if;
  perform 1 from private.media_legal_revisions l join public.media_terms_acceptances t
    on t.terms_version=l.terms_version and t.document_sha256=l.document_sha256
    where l.terms_version=p_terms_version and l.is_active and t.owner_id=auth.uid() for share of l,t;
  if not found then raise exception 'MEDIA_TERMS_ACCEPTANCE_REQUIRED'; end if;
  if p_rights_confirmed is distinct from true or p_privacy_confirmed is distinct from true
    or p_affiliate_free_confirmed is distinct from true then raise exception 'MEDIA_PUBLICATION_ATTESTATION_REQUIRED'; end if;
  v_version_id:=public.media_publish_article(p_article_id,p_terms_version,true,true,true);
  insert into private.media_reviewed_publications(version_id,expected_revision) values(v_version_id,p_expected_revision);
  -- The foundation function has already switched current version; old token revocation runs first.
  insert into private.media_public_image_tokens(token,version_id,asset_id,content_sha256)
    select replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),v_version_id,a.asset_id,a.content_sha256
    from public.media_article_version_assets a where a.version_id=v_version_id;
  return v_version_id;
end $$;

create or replace function private.media_token_image_url(p_version_id uuid,p_asset_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select '/media/images/'||t.token from private.media_public_image_tokens t
    where t.version_id=p_version_id and t.asset_id=p_asset_id and public.media_resolve_public_image(t.token) is not null;
$$;
create or replace function private.media_token_public_blocks(p_version_id uuid,p_blocks jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(case when b.value->>'type'='image' then
      (private.media_public_blocks(jsonb_build_array(b.value))->0)||jsonb_build_object('imageUrl',
        private.media_token_image_url(p_version_id,(b.value->>'imageAssetId')::uuid))
    else private.media_public_blocks(jsonb_build_array(b.value))->0 end order by b.ordinality),'[]'::jsonb)
  from jsonb_array_elements(p_blocks) with ordinality b(value,ordinality)
  where b.value->>'type'<>'image' or private.media_token_image_url(p_version_id,(b.value->>'imageAssetId')::uuid) is not null;
$$;
create or replace function private.media_token_cover_url(p_version_id uuid,p_cover_url text)
returns text language sql stable security definer set search_path='' as $$
  select coalesce((select private.media_token_image_url(p_version_id,a.asset_id)
    from public.media_article_version_assets a where a.version_id=p_version_id
      and p_cover_url='/api/media/assets/'||a.asset_id::text limit 1),'');
$$;
create or replace function public.media_public_site(p_slug text,p_locale text default null)
returns table(name text,slug text,description text,author_name text,locale text,categories jsonb)
language sql stable security definer set search_path='' as $$
  select s.name,s.slug,s.description,s.author_name,coalesce(p_locale,s.default_locale),
    coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'slug',c.slug) order by c.sort_order,c.name)
      from public.media_categories c where c.site_id=s.id),'[]'::jsonb)
  from public.media_sites s where s.slug=p_slug and s.is_published and not s.moderation_hold and s.deleted_at is null
    and exists(select 1 from public.media_articles a join private.media_reviewed_publications r
      on r.version_id=a.current_published_version_id and r.revoked_at is null
      where a.site_id=s.id and a.status='published' and not a.moderation_hold and a.deleted_at is null);
$$;
create or replace function public.media_public_articles(p_site_slug text,p_locale text,p_limit integer default 50)
returns table(title text,slug text,excerpt text,category_name text,cover_image_url text,blocks jsonb,
  locale text,version_number integer,revision_hash text,published_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select v.title,v.slug,v.excerpt,v.category_name,private.media_token_cover_url(v.id,v.cover_image_url),
    private.media_token_public_blocks(v.id,v.blocks),v.locale,v.version_number,v.revision_hash,v.published_at,v.published_at
  from public.media_sites s join public.media_articles a on a.site_id=s.id
    join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
    join private.media_reviewed_publications reviewed on reviewed.version_id=v.id and reviewed.revoked_at is null
  where s.slug=p_site_slug and s.is_published and a.status='published' and v.locale=coalesce(p_locale,s.default_locale)
    and not s.moderation_hold and s.deleted_at is null and not a.moderation_hold and a.deleted_at is null
  order by v.published_at desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;
create or replace function public.media_public_article(p_site_slug text,p_locale text,p_article_slug text)
returns table(title text,slug text,excerpt text,category_name text,cover_image_url text,blocks jsonb,
  locale text,version_number integer,revision_hash text,published_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select v.title,v.slug,v.excerpt,v.category_name,private.media_token_cover_url(v.id,v.cover_image_url),
    private.media_token_public_blocks(v.id,v.blocks),v.locale,v.version_number,v.revision_hash,v.published_at,v.published_at
  from public.media_sites s join public.media_articles a on a.site_id=s.id
    join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
    join private.media_reviewed_publications reviewed on reviewed.version_id=v.id and reviewed.revoked_at is null
  where s.slug=p_site_slug and v.slug=p_article_slug and s.is_published and a.status='published'
    and v.locale=coalesce(p_locale,s.default_locale) and not s.moderation_hold and s.deleted_at is null
    and not a.moderation_hold and a.deleted_at is null limit 1;
$$;

revoke all on function public.media_register_private_image(uuid,text,bigint,text,text),public.media_resolve_owner_image(uuid,uuid),
  public.media_resolve_public_image(text),public.media_current_terms(),public.media_accept_terms(text,text,boolean),
  public.media_review_article(uuid),public.media_publish_article_reviewed(uuid,text,text,boolean,boolean,boolean),
  private.media_revoke_image_tokens(),private.media_review_payload(uuid),private.media_token_image_url(uuid,uuid),
  private.media_token_public_blocks(uuid,jsonb),private.media_token_cover_url(uuid,text)
  from public,anon,authenticated;
revoke execute on function public.media_publish_article(uuid,text,boolean,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.media_register_private_image(uuid,text,bigint,text,text),
  public.media_resolve_owner_image(uuid,uuid),public.media_resolve_public_image(text) to service_role;
grant execute on function public.media_current_terms(),public.media_accept_terms(text,text,boolean),
  public.media_review_article(uuid),public.media_publish_article_reviewed(uuid,text,text,boolean,boolean,boolean) to authenticated;
