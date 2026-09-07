-- Media Free foundation. Intentionally unapplied until legal, replay, Auth E2E,
-- and production approval gates are complete.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.mikke_media_assets add column if not exists content_sha256 text
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

create table public.media_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  author_name text not null check (char_length(btrim(author_name)) between 1 and 120),
  default_locale text not null default 'ja-JP' check (default_locale ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'),
  publishing_policy text not null default 'direct_owner' check (publishing_policy in ('direct_owner','managed_brand')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.media_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.media_sites(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug),
  unique (site_id, id)
);

create table public.media_articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.media_sites(id) on delete cascade,
  category_id uuid,
  locale text not null default 'ja-JP' check (locale ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'),
  translation_group_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 100),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  cover_image_url text not null default '' check (char_length(cover_image_url) <= 2048),
  cover_image_asset_id uuid references public.mikke_media_assets(id) on delete restrict,
  draft_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(draft_blocks) = 'array'),
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, locale, slug),
  foreign key (site_id, category_id) references public.media_categories(site_id, id)
);

create table public.media_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.media_articles(id) on delete cascade,
  site_id uuid not null references public.media_sites(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  locale text not null check (locale ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'),
  title text not null, slug text not null, excerpt text not null default '',
  category_name text not null default '', cover_image_url text not null default '',
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  block_schema_version integer not null default 1 check (block_schema_version = 1),
  revision_hash text not null check (revision_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(),
  unique (article_id, version_number), unique (article_id, id)
);

create table public.media_article_version_assets (
  version_id uuid not null references public.media_article_versions(id) on delete restrict,
  asset_id uuid not null references public.mikke_media_assets(id) on delete restrict,
  storage_path text not null, mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  rights_confirmed_at timestamptz not null,
  primary key (version_id, asset_id)
);

create table public.media_published_slugs (
  site_id uuid not null references public.media_sites(id) on delete cascade,
  locale text not null, slug text not null,
  article_id uuid not null references public.media_articles(id) on delete cascade,
  reserved_at timestamptz not null default now(),
  primary key (site_id, locale, slug), unique (site_id, locale, article_id)
);

create table public.media_terms_acceptances (
  owner_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (char_length(btrim(terms_version)) between 1 and 120),
  accepted_at timestamptz not null default now(),
  primary key (owner_id, terms_version)
);

create table public.media_article_publication_attestations (
  version_id uuid primary key references public.media_article_versions(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  terms_version text not null,
  rights_confirmed boolean not null check (rights_confirmed),
  privacy_confirmed boolean not null check (privacy_confirmed),
  affiliate_free_confirmed boolean not null check (affiliate_free_confirmed),
  attested_at timestamptz not null default now(),
  foreign key (owner_id, terms_version) references public.media_terms_acceptances(owner_id, terms_version)
);

create table public.media_publication_outbox (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.media_sites(id) on delete cascade,
  article_id uuid not null references public.media_articles(id) on delete cascade,
  version_id uuid not null references public.media_article_versions(id) on delete restrict,
  event_type text not null check (event_type in ('published','unpublished')),
  revision_hash text check (revision_hash is null or revision_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now(), consumed_at timestamptz
);

alter table public.media_articles add constraint media_articles_current_version_fk
  foreign key (id, current_published_version_id)
  references public.media_article_versions(article_id, id);

create index media_sites_owner_id_idx on public.media_sites(owner_id);
create index media_categories_site_id_idx on public.media_categories(site_id);
create index media_articles_site_id_idx on public.media_articles(site_id);
create index media_articles_category_id_idx on public.media_articles(category_id);
create index media_article_versions_site_id_idx on public.media_article_versions(site_id);
create index media_article_versions_article_id_idx on public.media_article_versions(article_id);
create index media_publication_outbox_unconsumed_idx on public.media_publication_outbox(occurred_at) where consumed_at is null;

create or replace function private.media_is_human_user()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

create or replace function private.media_safe_url(p_url text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(char_length(p_url) <= 2048 and (p_url = '' or p_url = '/'
    or p_url ~ '^/[^/\\[:space:]][^\\[:space:]]*$'
    or p_url ~ '^https?://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^\\[:space:]]*)?$'),false);
$$;

-- Deployment-owned origin; missing configuration disables image publication.
-- This function does not change bucket visibility or accept an author-supplied origin.
create or replace function private.media_asset_url_matches(p_url text,p_asset_id uuid,p_owner_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mikke_media_assets a
    where a.id=p_asset_id and a.owner_id=p_owner_id and a.status='active'
      and a.content_sha256 is not null and a.mime_type='image/webp'
      and current_setting('app.settings.media_public_storage_origin',true) ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
      and a.storage_path ~ ('^' || p_owner_id::text || '/images/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9-]+[.]webp$')
      and p_url=current_setting('app.settings.media_public_storage_origin',true)
        || '/storage/v1/object/public/mikke-media/' || a.storage_path);
$$;

create or replace function private.media_blocks_are_safe(p_blocks jsonb, p_owner_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_block jsonb; v_asset_id uuid; v_type text; v_key text; v_allowed text[]; v_required text[];
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_blocks) > 200 then return false; end if;
  for v_block in select value from jsonb_array_elements(p_blocks) loop
    if jsonb_typeof(v_block) is distinct from 'object' then return false; end if;
    if jsonb_typeof(v_block->'id') is distinct from 'string'
      or char_length(v_block->>'id') not between 1 and 80
      or jsonb_typeof(v_block->'type') is distinct from 'string' then return false; end if;
    v_type := v_block->>'type';
    case v_type
      when 'paragraph' then v_allowed:=array['id','type','text']; v_required:=v_allowed;
      when 'heading' then v_allowed:=array['id','type','text','level']; v_required:=v_allowed;
      when 'image' then v_allowed:=array['id','type','imageUrl','imageAssetId','alt','caption']; v_required:=array['id','type','imageUrl','imageAssetId','alt'];
      when 'quote' then v_allowed:=array['id','type','text','attribution']; v_required:=array['id','type','text'];
      when 'list' then v_allowed:=array['id','type','items']; v_required:=v_allowed;
      when 'divider' then v_allowed:=array['id','type']; v_required:=v_allowed;
      when 'link' then v_allowed:=array['id','type','url','title']; v_required:=array['id','type','url'];
      else return false;
    end case;
    if not (v_block ?& v_required) or exists (select 1 from jsonb_object_keys(v_block) k where not (k=any(v_allowed))) then return false; end if;
    foreach v_key in array array['text','alt','caption','attribution','url','imageUrl','imageAssetId','title'] loop
      if v_block ? v_key and jsonb_typeof(v_block->v_key) is distinct from 'string' then return false; end if;
    end loop;
    if char_length(coalesce(v_block ->> 'text','')) > (case when v_type='heading' then 500 else 20000 end)
      or char_length(coalesce(v_block ->> 'title','')) > 500
      or char_length(coalesce(v_block ->> 'alt','')) > 500
      or char_length(coalesce(v_block ->> 'caption','')) > 1000
      or char_length(coalesce(v_block ->> 'attribution','')) > 500
      or not private.media_safe_url(coalesce(v_block ->> 'url',''))
      or not private.media_safe_url(coalesce(v_block ->> 'imageUrl','')) then return false;
    end if;
    if v_type='heading' and (jsonb_typeof(v_block->'level') is distinct from 'number'
      or v_block->'level' not in ('2'::jsonb,'3'::jsonb)) then return false; end if;
    if v_type='list' then
      if jsonb_typeof(v_block->'items') is distinct from 'array' then return false; end if;
      if jsonb_array_length(v_block->'items') > 100 or exists (
        select 1 from jsonb_array_elements(v_block->'items') e
        where jsonb_typeof(e) is distinct from 'string' or char_length(e #>> '{}') > 2000
      ) then return false; end if;
    end if;
    if v_block ->> 'type' = 'image' then
      begin v_asset_id := (v_block ->> 'imageAssetId')::uuid; exception when others then return false; end;
      if not private.media_asset_url_matches(v_block->>'imageUrl',v_asset_id,p_owner_id)
      then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

-- Only presentation fields leave the immutable internal snapshot.
create or replace function private.media_public_blocks(p_blocks jsonb)
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k.key,k.value),'{}'::jsonb)
    from jsonb_each(b.value) k where k.key=any(case b.value->>'type'
      when 'paragraph' then array['id','type','text']
      when 'heading' then array['id','type','text','level']
      when 'image' then array['id','type','imageUrl','alt','caption']
      when 'quote' then array['id','type','text','attribution']
      when 'list' then array['id','type','items']
      when 'divider' then array['id','type']
      when 'link' then array['id','type','url','title']
      else array[]::text[] end)) order by b.ordinality),'[]'::jsonb)
  from jsonb_array_elements(p_blocks) with ordinality b(value,ordinality);
$$;

create or replace function private.media_reject_version_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception 'MEDIA_PUBLISHED_VERSION_IMMUTABLE'; end;
$$;
create trigger media_article_versions_immutable before update or delete on public.media_article_versions
for each row execute function private.media_reject_version_mutation();

create or replace function private.media_reject_published_site_slug_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug and exists (
    select 1 from public.media_publication_outbox o
    where o.site_id = old.id and o.event_type = 'published'
  ) then
    raise exception 'MEDIA_PUBLISHED_SITE_SLUG_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger media_sites_published_slug_immutable before update of slug on public.media_sites
for each row execute function private.media_reject_published_site_slug_change();

revoke execute on function private.media_is_human_user(), private.media_safe_url(text),
  private.media_blocks_are_safe(jsonb,uuid), private.media_asset_url_matches(text,uuid,uuid),
  private.media_public_blocks(jsonb), private.media_reject_version_mutation(),
  private.media_reject_published_site_slug_change()
  from public,anon,authenticated;
grant execute on function private.media_is_human_user() to authenticated;

alter table public.media_sites enable row level security;
alter table public.media_categories enable row level security;
alter table public.media_articles enable row level security;
alter table public.media_article_versions enable row level security;
alter table public.media_article_version_assets enable row level security;
alter table public.media_published_slugs enable row level security;
alter table public.media_terms_acceptances enable row level security;
alter table public.media_article_publication_attestations enable row level security;
alter table public.media_publication_outbox enable row level security;

revoke all on table public.media_sites, public.media_categories, public.media_articles,
  public.media_article_versions, public.media_article_version_assets, public.media_published_slugs,
  public.media_terms_acceptances, public.media_article_publication_attestations,
  public.media_publication_outbox from anon, authenticated;
grant select on public.media_sites, public.media_categories, public.media_articles, public.media_article_versions to authenticated;
grant update (name,slug,description,author_name,default_locale,updated_at) on public.media_sites to authenticated;
grant delete on public.media_sites to authenticated;
grant insert, update, delete on public.media_categories to authenticated;
grant insert (site_id,category_id,locale,translation_group_id,title,slug,excerpt,cover_image_url,cover_image_asset_id,draft_blocks) on public.media_articles to authenticated;
grant update (category_id,locale,translation_group_id,title,slug,excerpt,cover_image_url,cover_image_asset_id,draft_blocks,updated_at) on public.media_articles to authenticated;
grant delete on public.media_articles to authenticated;

create policy "media owners select sites" on public.media_sites for select to authenticated
using (private.media_is_human_user() and (select auth.uid()) = owner_id);
create policy "media owners update sites" on public.media_sites for update to authenticated
using (private.media_is_human_user() and (select auth.uid()) = owner_id)
with check (private.media_is_human_user() and (select auth.uid()) = owner_id);
create policy "media owners delete sites" on public.media_sites for delete to authenticated
using (private.media_is_human_user() and (select auth.uid()) = owner_id);
create policy "media owners manage categories" on public.media_categories for all to authenticated
using (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())))
with check (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners select articles" on public.media_articles for select to authenticated
using (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners insert articles" on public.media_articles for insert to authenticated
with check (private.media_is_human_user() and status = 'draft' and current_published_version_id is null
  and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners update articles" on public.media_articles for update to authenticated
using (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())))
with check (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners delete articles" on public.media_articles for delete to authenticated
using (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners select versions" on public.media_article_versions for select to authenticated
using (private.media_is_human_user() and exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create or replace function public.media_create_site(
  p_name text, p_slug text, p_description text, p_author_name text, p_default_locale text default 'ja-JP'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_site uuid;
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media-free:' || v_owner::text,0));
  if exists (select 1 from public.media_sites s where s.owner_id=v_owner and s.publishing_policy='direct_owner') then
    raise exception 'MEDIA_FREE_SITE_LIMIT_REACHED';
  end if;
  insert into public.media_sites(owner_id,name,slug,description,author_name,default_locale,publishing_policy)
  values (v_owner,btrim(p_name),lower(btrim(p_slug)),coalesce(p_description,''),btrim(p_author_name),
    coalesce(nullif(btrim(p_default_locale),''),'ja-JP'),'direct_owner')
  returning id into v_site;
  insert into public.mikke_app_entitlements(user_id,app_key,status,source,starts_at,ends_at,note,updated_at)
  values (v_owner,'media','active','media_create',now(),null,'Media creation completed',now())
  on conflict (user_id,app_key) do update set
    status='active',source='media_create',
    starts_at=coalesce(public.mikke_app_entitlements.starts_at,excluded.starts_at),
    ends_at=null,note=excluded.note,updated_at=now();
  return v_site;
end;
$$;

create or replace function public.media_publish_article(
  p_article_id uuid, p_terms_version text, p_rights_confirmed boolean,
  p_privacy_confirmed boolean, p_affiliate_free_confirmed boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid()); v_article public.media_articles%rowtype;
  v_site public.media_sites%rowtype; v_version uuid; v_number integer;
  v_category text := ''; v_hash text; v_asset uuid;
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_terms_version,''))) not between 1 and 120
    or not coalesce(p_rights_confirmed,false) or not coalesce(p_privacy_confirmed,false)
    or not coalesce(p_affiliate_free_confirmed,false)
  then raise exception 'MEDIA_PUBLICATION_ATTESTATION_REQUIRED'; end if;
  select s.* into v_site from public.media_sites s
    where s.id = (select a.site_id from public.media_articles a where a.id = p_article_id) for update;
  if not found or v_site.owner_id <> v_owner then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  if v_site.publishing_policy <> 'direct_owner' then raise exception 'MEDIA_MANAGED_BRAND_APPROVAL_REQUIRED'; end if;
  select a.* into v_article from public.media_articles a where a.id = p_article_id and a.site_id = v_site.id for update;
  if not found then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  if not private.media_blocks_are_safe(v_article.draft_blocks,v_owner) then raise exception 'MEDIA_UNSAFE_BLOCKS'; end if;
  if v_article.cover_image_url <> '' and v_article.cover_image_asset_id is null then raise exception 'MEDIA_COVER_ASSET_REQUIRED'; end if;
  if v_article.cover_image_asset_id is not null and not exists (
    select 1 from public.mikke_media_assets a where a.id = v_article.cover_image_asset_id
      and a.owner_id = v_owner and a.status = 'active' and a.content_sha256 is not null
      and private.media_asset_url_matches(v_article.cover_image_url,a.id,v_owner))
  then raise exception 'MEDIA_COVER_ASSET_NOT_AVAILABLE'; end if;
  insert into public.media_published_slugs(site_id,locale,slug,article_id)
    values (v_article.site_id,v_article.locale,v_article.slug,v_article.id)
    on conflict (site_id,locale,article_id) do update set slug = excluded.slug
      where public.media_published_slugs.slug = excluded.slug;
  if not found then raise exception 'MEDIA_PUBLISHED_SLUG_IMMUTABLE'; end if;
  if v_article.category_id is not null then
    select c.name into v_category from public.media_categories c where c.id = v_article.category_id and c.site_id = v_article.site_id;
  end if;
  select coalesce(max(version_number),0)+1 into v_number from public.media_article_versions where article_id = v_article.id;
  v_hash := encode(sha256(convert_to(jsonb_build_object('article',v_article.id,'version',v_number,
    'locale',v_article.locale,'title',v_article.title,'slug',v_article.slug,'excerpt',v_article.excerpt,
    'category',coalesce(v_category,''),'cover',v_article.cover_image_url,'blocks',v_article.draft_blocks)::text,'UTF8')),'hex');
  insert into public.media_article_versions(article_id,site_id,version_number,locale,title,slug,excerpt,category_name,cover_image_url,blocks,revision_hash)
    values (v_article.id,v_article.site_id,v_number,v_article.locale,v_article.title,v_article.slug,v_article.excerpt,
      coalesce(v_category,''),v_article.cover_image_url,v_article.draft_blocks,v_hash) returning id into v_version;
  for v_asset in select distinct asset_id from (
    select v_article.cover_image_asset_id asset_id union all
    select (b ->> 'imageAssetId')::uuid from jsonb_array_elements(v_article.draft_blocks) b where b ->> 'type' = 'image'
  ) q where asset_id is not null loop
    insert into public.media_article_version_assets(version_id,asset_id,storage_path,mime_type,byte_size,content_sha256,rights_confirmed_at)
      select v_version,a.id,a.storage_path,a.mime_type,a.byte_size,a.content_sha256,now()
      from public.mikke_media_assets a where a.id = v_asset and a.owner_id = v_owner
        and a.status = 'active' and a.content_sha256 is not null;
    if not found then raise exception 'MEDIA_ASSET_NOT_AVAILABLE'; end if;
  end loop;
  insert into public.media_terms_acceptances(owner_id,terms_version) values (v_owner,btrim(p_terms_version)) on conflict do nothing;
  insert into public.media_article_publication_attestations(version_id,owner_id,terms_version,rights_confirmed,privacy_confirmed,affiliate_free_confirmed)
    values (v_version,v_owner,btrim(p_terms_version),true,true,true);
  update public.media_articles set status='published',current_published_version_id=v_version,updated_at=now() where id=v_article.id;
  update public.media_sites set is_published=true,updated_at=now() where id=v_article.site_id;
  insert into public.media_publication_outbox(site_id,article_id,version_id,event_type,revision_hash)
    values (v_article.site_id,v_article.id,v_version,'published',v_hash);
  return v_version;
end;
$$;

create or replace function public.media_unpublish_article(p_article_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_site uuid; v_version uuid;
begin
  if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
  select a.site_id,a.current_published_version_id into v_site,v_version
    from public.media_articles a join public.media_sites s on s.id=a.site_id
    where a.id=p_article_id and s.owner_id=v_owner for update of s,a;
  if not found then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  update public.media_articles set status='unpublished',current_published_version_id=null,updated_at=now() where id=p_article_id;
  update public.media_sites s set is_published=exists (
    select 1 from public.media_articles a where a.site_id=v_site and a.status='published' and a.current_published_version_id is not null
  ),updated_at=now() where s.id=v_site;
  if v_version is not null then insert into public.media_publication_outbox(site_id,article_id,version_id,event_type)
    values (v_site,p_article_id,v_version,'unpublished'); end if;
end;
$$;

create or replace function public.media_public_site(p_slug text,p_locale text default null)
returns table (name text,slug text,description text,author_name text,locale text,categories jsonb)
language sql stable security definer set search_path = '' as $$
  select s.name,s.slug,s.description,s.author_name,coalesce(p_locale,s.default_locale),
    coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'slug',c.slug) order by c.sort_order,c.name)
      from public.media_categories c where c.site_id=s.id),'[]'::jsonb)
  from public.media_sites s where s.slug=p_slug and s.is_published=true;
$$;
create or replace function public.media_public_articles(p_site_slug text,p_locale text,p_limit integer default 50)
returns table (title text,slug text,excerpt text,category_name text,cover_image_url text,blocks jsonb,
  locale text,version_number integer,revision_hash text,published_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.title,v.slug,v.excerpt,v.category_name,v.cover_image_url,private.media_public_blocks(v.blocks),v.locale,v.version_number,
    v.revision_hash,v.published_at,v.published_at
  from public.media_sites s join public.media_articles a on a.site_id=s.id
    join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
  where s.slug=p_site_slug and s.is_published=true and a.status='published' and v.locale=coalesce(p_locale,s.default_locale)
  order by v.published_at desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;
create or replace function public.media_public_article(p_site_slug text,p_locale text,p_article_slug text)
returns table (title text,slug text,excerpt text,category_name text,cover_image_url text,blocks jsonb,
  locale text,version_number integer,revision_hash text,published_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.title,v.slug,v.excerpt,v.category_name,v.cover_image_url,private.media_public_blocks(v.blocks),v.locale,v.version_number,
    v.revision_hash,v.published_at,v.published_at
  from public.media_sites s join public.media_articles a on a.site_id=s.id
    join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
  where s.slug=p_site_slug and v.slug=p_article_slug and s.is_published=true and a.status='published'
    and v.locale=coalesce(p_locale,s.default_locale) limit 1;
$$;

revoke execute on function public.media_create_site(text,text,text,text,text),
  public.media_publish_article(uuid,text,boolean,boolean,boolean),
  public.media_unpublish_article(uuid),public.media_public_site(text,text),
  public.media_public_articles(text,text,integer),public.media_public_article(text,text,text)
  from public,anon,authenticated;
grant execute on function public.media_create_site(text,text,text,text,text),
  public.media_publish_article(uuid,text,boolean,boolean,boolean),
  public.media_unpublish_article(uuid) to authenticated;
grant execute on function public.media_public_site(text,text),public.media_public_articles(text,text,integer),
  public.media_public_article(text,text,text) to anon,authenticated;
