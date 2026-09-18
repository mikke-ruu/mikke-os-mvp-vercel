begin;
-- Additive content contract. Existing drafts and immutable versions are not rewritten.

create or replace function private.media_content_url(p_url text)
returns boolean language sql immutable set search_path='' as $$
  select p_url is not null and char_length(p_url)<=2048 and p_url !~ '[[:space:]\\]'
    and (p_url='' or p_url ~ '^/[^/]' or p_url='/' or p_url ~ '^https?://[^/@]+([/:?#]|$)')
    and p_url !~ '^https?://[^/]*@';
$$;

create or replace function private.media_block_assets(p_blocks jsonb)
returns table(asset_id uuid,image_url text,alt text,required_alt boolean)
language sql immutable set search_path='' as $$
  select (b->>'imageAssetId')::uuid,b->>'imageUrl',b->>'alt',b->>'type' in ('image','image-text')
    from jsonb_array_elements(p_blocks) b where b->>'type' in ('image','image-text','link','video') and b ? 'imageAssetId'
  union all
  select (i->>'assetId')::uuid,i->>'url',i->>'alt',true
    from jsonb_array_elements(p_blocks) b cross join lateral jsonb_array_elements(case when b->>'type'='gallery' then b->'images' else '[]'::jsonb end) i;
$$;

create or replace function private.media_blocks_are_safe(p_blocks jsonb,p_owner_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare b jsonb; x jsonb; t text; k text; allowed text[]; required text[]; joined text; asset record;
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_blocks)>200 then return false; end if;
  for b in select value from jsonb_array_elements(p_blocks) loop
    if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'id') is distinct from 'string'
      or char_length(b->>'id') not between 1 and 80 or jsonb_typeof(b->'type') is distinct from 'string' then return false; end if;
    t:=b->>'type';
    case t
      when 'paragraph' then allowed:=array['id','type','text','richText','align'];required:=array['id','type','text'];
      when 'heading' then allowed:=array['id','type','text','level','richText','align'];required:=array['id','type','text','level'];
      when 'image' then allowed:=array['id','type','imageUrl','imageAssetId','alt','caption','imageLink'];required:=array['id','type','imageUrl','imageAssetId','alt'];
      when 'quote' then allowed:=array['id','type','text','attribution','richText','align'];required:=array['id','type','text'];
      when 'list' then allowed:=array['id','type','items'];required:=allowed;
      when 'divider' then allowed:=array['id','type'];required:=allowed;
      when 'link','video' then allowed:=array['id','type','url','title','text','imageUrl','imageAssetId'];required:=array['id','type','url'];
      when 'links' then allowed:=array['id','type','title','links'];required:=array['id','type','links'];
      when 'image-text' then allowed:=array['id','type','imageUrl','imageAssetId','alt','imageLink','imageSide','title','text'];required:=array['id','type','imageUrl','imageAssetId','alt','text'];
      when 'gallery' then allowed:=array['id','type','images','columns'];required:=array['id','type','images'];
      when 'cta' then allowed:=array['id','type','title','text','buttonLabel','url'];required:=array['id','type','text','url'];
      else return false;
    end case;
    if not b ?& required or exists(select 1 from jsonb_object_keys(b) key where not key=any(allowed)) then return false; end if;
    foreach k in array array['text','alt','caption','attribution','url','imageUrl','imageAssetId','title','buttonLabel','imageLink'] loop
      if b ? k and jsonb_typeof(b->k) is distinct from 'string' then return false; end if;
    end loop;
    if char_length(coalesce(b->>'text',''))>(case when t='heading' then 500 else 20000 end)
      or char_length(coalesce(b->>'title',''))>500 or char_length(coalesce(b->>'alt',''))>500
      or char_length(coalesce(b->>'caption',''))>1000 or char_length(coalesce(b->>'attribution',''))>500
      or char_length(coalesce(b->>'buttonLabel',''))>120 then return false; end if;
    foreach k in array array['url','imageLink'] loop
      if b ? k and not private.media_content_url(b->>k) then return false; end if;
    end loop;
    if t in ('link','video','cta') and coalesce(b->>'url','')='' then return false; end if;
    if b ? 'align' and (jsonb_typeof(b->'align') is distinct from 'string' or b->>'align' not in ('left','center','right')) then return false; end if;
    if t='heading' and (jsonb_typeof(b->'level') is distinct from 'number' or b->'level' not in ('2'::jsonb,'3'::jsonb)) then return false; end if;
    if b ? 'imageSide' and (jsonb_typeof(b->'imageSide') is distinct from 'string' or b->>'imageSide' not in ('left','right')) then return false; end if;
    if b ? 'columns' and (jsonb_typeof(b->'columns') is distinct from 'number' or b->'columns' not in ('2'::jsonb,'3'::jsonb)) then return false; end if;
    if b ? 'richText' then
      if jsonb_typeof(b->'richText') is distinct from 'array' or jsonb_array_length(b->'richText')>5000 then return false; end if;
      joined:='';
      for x in select value from jsonb_array_elements(b->'richText') loop
        if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'text') is distinct from 'string'
          or char_length(x->>'text')>20000 or exists(select 1 from jsonb_object_keys(x) key where key not in ('text','bold','strike','href')) then return false; end if;
        foreach k in array array['bold','strike'] loop
          if x ? k and jsonb_typeof(x->k) is distinct from 'boolean' then return false; end if;
        end loop;
        if x ? 'href' and (jsonb_typeof(x->'href') is distinct from 'string' or not private.media_content_url(x->>'href')) then return false; end if;
        joined:=joined||(x->>'text');
      end loop;
      if joined is distinct from b->>'text' then return false; end if;
    end if;
    if t='list' then
      if jsonb_typeof(b->'items') is distinct from 'array' or jsonb_array_length(b->'items')>100 then return false; end if;
      if exists(select 1 from jsonb_array_elements(b->'items') entry where jsonb_typeof(entry) is distinct from 'string' or char_length(entry#>>'{}')>2000) then return false; end if;
    end if;
    if t='links' then
      if jsonb_typeof(b->'links') is distinct from 'array' or jsonb_array_length(b->'links')>100 then return false; end if;
      for x in select value from jsonb_array_elements(b->'links') loop
        if jsonb_typeof(x) is distinct from 'object' or not x ?& array['label','url']
          or exists(select 1 from jsonb_object_keys(x) key where key not in ('label','url'))
          or jsonb_typeof(x->'label') is distinct from 'string' or char_length(x->>'label')>500
          or jsonb_typeof(x->'url') is distinct from 'string' or coalesce(x->>'url','')='' or not private.media_content_url(x->>'url') then return false; end if;
      end loop;
    end if;
    if t='gallery' then
      if jsonb_typeof(b->'images') is distinct from 'array' or jsonb_array_length(b->'images')>50 then return false; end if;
      for x in select value from jsonb_array_elements(b->'images') loop
        if jsonb_typeof(x) is distinct from 'object' or not x ?& array['url','assetId','alt']
          or exists(select 1 from jsonb_object_keys(x) key where key not in ('url','assetId','alt','caption','href')) then return false; end if;
        foreach k in array array['url','assetId','alt','caption','href'] loop
          if x ? k and jsonb_typeof(x->k) is distinct from 'string' then return false; end if;
        end loop;
        if char_length(x->>'alt')>500 or char_length(coalesce(x->>'caption',''))>1000
          or (x ? 'href' and not private.media_content_url(x->>'href')) then return false; end if;
      end loop;
    end if;
    if t in ('link','video') and not b ? 'imageAssetId' and coalesce(b->>'imageUrl','')<>'' then
      if not private.media_content_url(b->>'imageUrl') or b->>'imageUrl' !~ '^https://[^/]+\.[^/]+'
        or b->>'imageUrl' ~ '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.)' then return false; end if;
    end if;
  end loop;
  for asset in select * from private.media_block_assets(p_blocks) loop
    if not private.media_asset_url_matches(asset.image_url,asset.asset_id,p_owner_id) then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation or invalid_parameter_value then return false;
end $$;

create or replace function private.media_public_blocks(p_blocks jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k.key,
    case when k.key='images' then (select coalesce(jsonb_agg(i-'assetId'),'[]'::jsonb) from jsonb_array_elements(k.value) i) else k.value end),'{}'::jsonb)
    from jsonb_each(b.value) k where k.key=any(case b.value->>'type'
      when 'paragraph' then array['id','type','text','richText','align']
      when 'heading' then array['id','type','text','level','richText','align']
      when 'image' then array['id','type','imageUrl','alt','caption','imageLink']
      when 'quote' then array['id','type','text','attribution','richText','align']
      when 'list' then array['id','type','items'] when 'divider' then array['id','type']
      when 'link' then array['id','type','url','title','text','imageUrl']
      when 'video' then array['id','type','url','title','text','imageUrl']
      when 'links' then array['id','type','title','links']
      when 'image-text' then array['id','type','imageUrl','alt','imageLink','imageSide','title','text']
      when 'gallery' then array['id','type','images','columns']
      when 'cta' then array['id','type','title','text','buttonLabel','url']
      else array[]::text[] end)) order by b.ordinality),'[]'::jsonb)
  from jsonb_array_elements(p_blocks) with ordinality b(value,ordinality);
$$;

create or replace function private.media_token_public_blocks(p_version_id uuid,p_blocks jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b jsonb; projected jsonb; x jsonb; images jsonb; url text; result jsonb:='[]'::jsonb;
begin
  for b in select value from jsonb_array_elements(p_blocks) loop
    projected:=private.media_public_blocks(jsonb_build_array(b))->0;
    if b ? 'imageAssetId' then
      url:=private.media_token_image_url(p_version_id,(b->>'imageAssetId')::uuid);
      if url is null then
        if b->>'type' in ('image','image-text') then continue; else projected:=projected-'imageUrl'; end if;
      else projected:=projected||jsonb_build_object('imageUrl',url); end if;
    end if;
    if b->>'type'='gallery' then
      images:='[]'::jsonb;
      for x in select value from jsonb_array_elements(b->'images') loop
        url:=private.media_token_image_url(p_version_id,(x->>'assetId')::uuid);
        if url is not null then images:=images||jsonb_build_array((x-'assetId')||jsonb_build_object('url',url)); end if;
      end loop;
      projected:=projected||jsonb_build_object('images',images);
    end if;
    result:=result||jsonb_build_array(projected);
  end loop;
  return result;
end $$;

-- Review and publish replacements are appended below with the existing authority
-- and consent checks intact; only asset traversal is expanded.

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
    select asset_id from private.media_block_assets(a.draft_blocks)
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
  if exists(select 1 from private.media_block_assets(a.draft_blocks) b where b.required_alt
    and btrim(coalesce(b.alt,''))='') then raise exception 'MEDIA_IMAGE_ALT_REQUIRED'; end if;
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
    select asset_id from private.media_block_assets(v_article.draft_blocks)
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

revoke all on function private.media_content_url(text),private.media_block_assets(jsonb) from public,anon,authenticated;

-- Media branding, organization and reader presentation. Existing drafts are preserved.

alter table public.media_sites add column presentation jsonb not null default '{}'::jsonb;
alter table public.media_articles add column category_names text[] not null default '{}',
 add column display_date timestamptz, add column publication_order integer not null default 0,
 add column pinned boolean not null default false;
alter table public.media_article_versions add column categories jsonb not null default '[]';
-- Changing list placement does not create an unpublished body revision.
create or replace function private.media_touch_review_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='media_articles' and (to_jsonb(new)-array['display_date','pinned','publication_order','updated_at'])=(to_jsonb(old)-array['display_date','pinned','publication_order','updated_at']) then new.updated_at:=old.updated_at;
 else new.updated_at:=clock_timestamp();end if;
 return new;
end $$;
grant update(category_names) on public.media_articles to authenticated;
grant insert(category_names) on public.media_articles to authenticated;

create table public.media_collections (
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.media_sites(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 120), article_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index media_collections_site on public.media_collections(site_id);
alter table public.media_collections enable row level security;
revoke all on public.media_collections from public,anon,authenticated;
grant select on public.media_collections to authenticated;
create policy media_collections_owner on public.media_collections for select to authenticated using(
 private.media_is_human_user() and exists(select 1 from public.media_sites s where s.id=site_id and s.owner_id=(select auth.uid())));

create table private.media_site_image_tokens (
 token text primary key,site_id uuid not null references public.media_sites(id) on delete cascade,
 field_name text not null check(field_name in ('bannerImageUrl','logoImageUrl','authorAvatarUrl')),
 asset_id uuid not null references private.media_private_images(asset_id), unique(site_id,field_name));
alter table private.media_site_image_tokens enable row level security;
revoke all on private.media_site_image_tokens from public,anon,authenticated;

create function public.media_update_settings(p_site_id uuid,p_settings jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s public.media_sites; k text; u text; aid uuid; ref text; info jsonb; c text; cats text[];
begin
 if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
 select * into s from public.media_sites where id=p_site_id and owner_id=auth.uid() and publishing_policy='direct_owner' and deleted_at is null for update;
 if not found then raise exception 'MEDIA_SITE_NOT_AVAILABLE'; end if;
 if jsonb_typeof(p_settings)<>'object' or char_length(coalesce(p_settings->>'authorBio',''))>500 or
  coalesce(p_settings->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_settings->>'slug')>100 then raise exception 'MEDIA_SETTINGS_INVALID'; end if;
 info=jsonb_build_object('bannerImageUrl',coalesce(p_settings->>'bannerImageUrl',''),'bannerPosition',greatest(0,least(100,coalesce((p_settings->>'bannerPosition')::integer,50))),
  'logoImageUrl',coalesce(p_settings->>'logoImageUrl',''),'authorAvatarUrl',coalesce(p_settings->>'authorAvatarUrl',''),
  'authorBio',coalesce(p_settings->>'authorBio',''),'storyReference',coalesce(p_settings->>'storyReference',''),
  'storyLinkRequested',coalesce((p_settings->>'storyLinkRequested')::boolean,false),'showStory',false,'storyUrl','');
 foreach k in array array['bannerImageUrl','logoImageUrl','authorAvatarUrl'] loop
  u=info->>k;
  if u<>'' then
   if u!~'^/api/media/assets/[a-f0-9-]{36}$' then raise exception 'MEDIA_ASSET_NOT_AVAILABLE'; end if;
   aid=substring(u from 19)::uuid;
   if public.media_resolve_owner_image(s.owner_id,aid) is null then raise exception 'MEDIA_ASSET_NOT_AVAILABLE'; end if;
   insert into private.media_site_image_tokens(token,site_id,field_name,asset_id)
    values(encode(extensions.gen_random_bytes(32),'hex'),s.id,k,aid)
    on conflict(site_id,field_name) do update set token=excluded.token,asset_id=excluded.asset_id;
  else delete from private.media_site_image_tokens where site_id=s.id and field_name=k; end if;
 end loop;
 -- The requested ID is checked against the authenticated owner's published STORY.
 -- Explicit opt-in here is the owner's approval; other owners' STORYs never link.
 if (info->>'storyLinkRequested')::boolean then
  ref=info->>'storyReference';
  if ref ~ '^https://(app\.)?mikke-os\.com/story/[a-z0-9_-]+/?$' then ref=regexp_replace(ref,'^.*/story/([^/]+)/?$','\1'); end if;
  if not exists(select 1 from public.story_profiles p where p.owner_user_id=auth.uid() and p.handle=ref and p.publication_status='published') then raise exception 'MEDIA_STORY_OWNER_CONFIRMATION_REQUIRED'; end if;
  info=info||jsonb_build_object('storyReference',ref,'showStory',true,'storyUrl','https://app.mikke-os.com/story/'||ref);
 end if;
 if jsonb_typeof(p_settings->'categories')<>'array' or jsonb_array_length(p_settings->'categories')>100 then raise exception 'MEDIA_CATEGORIES_INVALID'; end if;
 select coalesce(array_agg(distinct btrim(value)),array[]::text[]) into cats from jsonb_array_elements_text(p_settings->'categories');
 foreach c in array cats loop
  if char_length(c) not between 1 and 60 then raise exception 'MEDIA_CATEGORIES_INVALID'; end if;
  if not exists(select 1 from public.media_categories where site_id=s.id and name=c) then
   insert into public.media_categories(site_id,name,slug,sort_order) values(s.id,c,'c-'||replace(gen_random_uuid()::text,'-',''),coalesce((select max(sort_order)+1 from public.media_categories where site_id=s.id),0));
  end if;
 end loop;
 update public.media_sites set name=btrim(p_settings->>'name'),slug=lower(p_settings->>'slug'),description=coalesce(p_settings->>'description',''),
  author_name=coalesce(nullif(btrim(p_settings->>'authorName'),''),btrim(p_settings->>'name')),presentation=info where id=s.id;
end $$;

create function public.media_update_publication_order(p_article_id uuid,p_date timestamptz default null,p_direction integer default null,p_pinned boolean default null) returns void
language plpgsql security definer set search_path='' as $$
declare a public.media_articles; neighbor uuid; ids uuid[]; idx integer; swap uuid;
begin
 if not private.media_is_human_user() then raise exception 'MEDIA_HUMAN_AUTH_REQUIRED'; end if;
 select a0.* into a from public.media_articles a0 join public.media_sites s on s.id=a0.site_id where a0.id=p_article_id and s.owner_id=auth.uid() and s.publishing_policy='direct_owner';
 if not found then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
 perform 1 from public.media_sites where id=a.site_id for update;
 if p_direction is not null and p_direction not in (-1,1) then raise exception 'MEDIA_ORDER_INVALID'; end if;
 update public.media_articles set pinned=coalesce(p_pinned,pinned),display_date=coalesce(p_date,display_date) where id=a.id;
 select array_agg(id order by publication_order,coalesce(display_date,created_at) desc,id) into ids from public.media_articles where site_id=a.site_id and status='published' and pinned=coalesce(p_pinned,a.pinned);
 idx=array_position(ids,a.id);
 if p_direction is not null and idx+p_direction between 1 and cardinality(ids) then swap=ids[idx+p_direction];ids[idx+p_direction]=a.id;ids[idx]=swap;end if;
 update public.media_articles x set publication_order=v.ordinality from unnest(ids) with ordinality v(id,ordinality) where x.id=v.id;
end $$;

create function public.media_save_collection(p_site_id uuid,p_name text,p_article_ids uuid[],p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.media_is_human_user() or not exists(select 1 from public.media_sites where id=p_site_id and owner_id=auth.uid() and publishing_policy='direct_owner') then raise exception 'MEDIA_SITE_NOT_AVAILABLE';end if;
 if cardinality(p_article_ids)>500 or exists(select 1 from unnest(p_article_ids) i where not exists(select 1 from public.media_articles where id=i and site_id=p_site_id)) then raise exception 'MEDIA_COLLECTION_INVALID';end if;
 if p_id is null and (select count(*) from public.media_collections where site_id=p_site_id)>=500 then raise exception 'MEDIA_COLLECTION_LIMIT';end if;
 if p_id is null then insert into public.media_collections(site_id,name,article_ids) values(p_site_id,btrim(p_name),p_article_ids) returning id into result;
 else update public.media_collections set name=btrim(p_name),article_ids=p_article_ids,updated_at=now() where id=p_id and site_id=p_site_id returning id into result;
 if result is null then raise exception 'MEDIA_COLLECTION_NOT_AVAILABLE';end if;end if;
 return result;
end $$;

create function public.media_resolve_site_image(p_token text) returns jsonb language sql stable security definer set search_path='' as $$
 select public.media_resolve_owner_image(s.owner_id,t.asset_id) from private.media_site_image_tokens t join public.media_sites s on s.id=t.site_id
 where t.token=p_token and s.is_published and not s.moderation_hold and s.deleted_at is null
 and exists(select 1 from public.media_articles a join private.media_reviewed_publications r on r.version_id=a.current_published_version_id and r.revoked_at is null where a.site_id=s.id and a.status='published' and not a.moderation_hold and a.deleted_at is null);
$$;
create function public.media_public_presentation(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('bannerPosition',coalesce((s.presentation->>'bannerPosition')::integer,50),'authorBio',coalesce(s.presentation->>'authorBio',''),
 'storyUrl',case when exists(select 1 from public.story_profiles p where p.owner_user_id=s.owner_id and p.handle=s.presentation->>'storyReference' and p.publication_status='published') and (s.presentation->>'showStory')::boolean then s.presentation->>'storyUrl' else '' end,
 'bannerImageUrl',coalesce((select '/media/site-images/'||t.token from private.media_site_image_tokens t where t.site_id=s.id and t.field_name='bannerImageUrl' and public.media_resolve_site_image(t.token) is not null),''),
 'logoImageUrl',coalesce((select '/media/site-images/'||t.token from private.media_site_image_tokens t where t.site_id=s.id and t.field_name='logoImageUrl' and public.media_resolve_site_image(t.token) is not null),''),
 'authorAvatarUrl',coalesce((select '/media/site-images/'||t.token from private.media_site_image_tokens t where t.site_id=s.id and t.field_name='authorAvatarUrl' and public.media_resolve_site_image(t.token) is not null),''),
 'articles','[]'::jsonb,
 'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'slugs','[]'::jsonb)) from public.media_collections c where c.site_id=s.id),'[]'::jsonb))
 from public.media_sites s where s.slug=p_slug and s.is_published and not s.moderation_hold and s.deleted_at is null
 and exists(select 1 from public.media_articles a join private.media_reviewed_publications r on r.version_id=a.current_published_version_id and r.revoked_at is null where a.site_id=s.id and a.status='published' and not a.moderation_hold and a.deleted_at is null);
$$;
revoke all on function public.media_update_settings(uuid,jsonb),public.media_update_publication_order(uuid,timestamptz,integer,boolean),public.media_save_collection(uuid,text,uuid[],uuid),public.media_resolve_site_image(text),public.media_public_presentation(text) from public,anon,authenticated;
grant execute on function public.media_update_settings(uuid,jsonb),public.media_update_publication_order(uuid,timestamptz,integer,boolean),public.media_save_collection(uuid,text,uuid[],uuid) to authenticated;
grant execute on function public.media_public_presentation(text) to anon,authenticated;
grant execute on function public.media_resolve_site_image(text) to service_role;

create function private.media_validate_categories() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if cardinality(new.category_names)>100 or exists(select 1 from unnest(new.category_names) n where not exists(select 1 from public.media_categories c where c.site_id=new.site_id and c.name=n)) then raise exception 'MEDIA_CATEGORY_NOT_AVAILABLE';end if;
 return new;
end $$;
create trigger media_article_categories_check before insert or update of category_names,site_id on public.media_articles for each row execute function private.media_validate_categories();
revoke all on function private.media_validate_categories() from public,anon,authenticated;

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
    select asset_id from private.media_block_assets(a.draft_blocks)
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
  if exists(select 1 from private.media_block_assets(a.draft_blocks) b where b.required_alt
    and btrim(coalesce(b.alt,''))='') then raise exception 'MEDIA_IMAGE_ALT_REQUIRED'; end if;
  snapshot:=jsonb_build_object('title',a.title,'slug',a.slug,'excerpt',a.excerpt,'category',coalesce(category_name,''),'categories',to_jsonb(a.category_names),
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
    'category',coalesce(v_category,''),'categories',to_jsonb(v_article.category_names),'cover',v_article.cover_image_url,'blocks',v_article.draft_blocks)::text,'UTF8')),'hex');
  insert into public.media_article_versions(article_id,site_id,version_number,locale,title,slug,excerpt,category_name,cover_image_url,blocks,revision_hash,categories)
    values (v_article.id,v_article.site_id,v_number,v_article.locale,v_article.title,v_article.slug,v_article.excerpt,
      coalesce(v_category,''),v_article.cover_image_url,v_article.draft_blocks,v_hash,to_jsonb(v_article.category_names)) returning id into v_version;
  for v_asset in select distinct asset_id from (
    select v_article.cover_image_asset_id asset_id union all
    select asset_id from private.media_block_assets(v_article.draft_blocks)
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



create function public.media_public_article_page(p_site_slug text,p_locale text default null,p_page integer default 1,p_query text default '',p_category text default '',p_month text default '',p_collection uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with eligible as (
  select v.*,case when jsonb_array_length(v.categories)>0 then v.categories when v.category_name<>'' then jsonb_build_array(v.category_name) else '[]'::jsonb end effective_categories,a.pinned,a.publication_order,coalesce(a.display_date,v.published_at) display_date,
    case when p_collection is null then 0 else array_position(c.article_ids,a.id) end collection_order
  from public.media_sites s join public.media_articles a on a.site_id=s.id
   join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
   join private.media_reviewed_publications r on r.version_id=v.id and r.revoked_at is null
   left join public.media_collections c on c.site_id=s.id and c.id=p_collection
  where s.slug=p_site_slug and s.is_published and not s.moderation_hold and s.deleted_at is null
   and a.status='published' and not a.moderation_hold and a.deleted_at is null and v.locale=coalesce(p_locale,s.default_locale)
   and char_length(coalesce(p_query,''))<=200 and strpos(lower(v.title),lower(coalesce(p_query,'')))>0
   and (coalesce(p_category,'')='' or v.categories ? p_category or (jsonb_array_length(v.categories)=0 and v.category_name=p_category))
   and (coalesce(p_month,'')='' or to_char(coalesce(a.display_date,v.published_at) at time zone 'Asia/Tokyo','YYYY-MM')=p_month)
   and (p_collection is null or a.id=any(c.article_ids))
 ), page as (
  select * from eligible order by collection_order,pinned desc,publication_order,display_date desc,id
  offset (greatest(1,least(coalesce(p_page,1),1000000))-1)*12 limit 12
 )
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce((select jsonb_agg(jsonb_build_object(
  'article',jsonb_build_object('title',v.title,'slug',v.slug,'excerpt',v.excerpt,'categoryName',v.category_name,'coverImageUrl',private.media_token_cover_url(v.id,v.cover_image_url),
   'locale',v.locale,'versionNumber',v.version_number,'revisionHash',v.revision_hash,'publishedAt',v.published_at,'updatedAt',v.published_at),
  'categories',v.effective_categories,'pinned',v.pinned,'publicationOrder',v.publication_order,'displayDate',v.display_date) order by v.collection_order,v.pinned desc,v.publication_order,v.display_date desc,v.id) from page v),'[]'::jsonb));
$$;
revoke all on function public.media_public_article_page(text,text,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.media_public_article_page(text,text,integer,text,text,text,uuid) to anon,authenticated;

create function public.media_public_article_categories(p_site_slug text,p_article_slug text,p_revision_hash text)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when jsonb_array_length(v.categories)>0 then v.categories when v.category_name<>'' then jsonb_build_array(v.category_name) else '[]'::jsonb end
 from public.media_sites s join public.media_articles a on a.site_id=s.id
 join public.media_article_versions v on v.id=a.current_published_version_id and v.article_id=a.id
 join private.media_reviewed_publications r on r.version_id=v.id and r.revoked_at is null
 where s.slug=p_site_slug and v.slug=p_article_slug and v.revision_hash=p_revision_hash
 and s.is_published and not s.moderation_hold and s.deleted_at is null
 and a.status='published' and not a.moderation_hold and a.deleted_at is null limit 1;
$$;
revoke all on function public.media_public_article_categories(text,text,text) from public,anon,authenticated;
grant execute on function public.media_public_article_categories(text,text,text) to anon,authenticated;

-- Reader data never inherits the owner's local preview persona. All writes bind auth.uid().
create table private.media_readers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_id uuid not null unique default gen_random_uuid(),
 name text not null default '読者' check (char_length(btrim(name)) between 1 and 40),
 icon text not null default '🌱' check (char_length(icon)<=8),
 avatar text not null default '' check (avatar='' or (char_length(avatar)<=60000 and avatar ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$')),
 bio text not null default '' check (char_length(bio)<=200),
 destination text not null default 'none' check(destination in ('none','profile','media')),
 notify_replies boolean not null default true
);
create table private.media_reader_marks (
 user_id uuid not null references auth.users(id) on delete cascade,
 article_id uuid not null references public.media_articles(id) on delete cascade,
 kind text not null check(kind in ('saved','favorite')), created_at timestamptz not null default now(),
 primary key(user_id,article_id,kind)
);
create table private.media_reader_follows (
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.media_sites(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,site_id)
);
create table private.media_comment_settings (
 article_id uuid primary key references public.media_articles(id) on delete cascade,
 mode text not null default 'review' check(mode in ('review','open','closed'))
);
create table private.media_reader_comments (
 id uuid primary key default gen_random_uuid(), article_id uuid not null references public.media_articles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reply_to uuid references private.media_reader_comments(id), root_id uuid references private.media_reader_comments(id),
 body text not null check(char_length(body)<=2000), status text not null check(status in ('pending','visible','hidden','deleted')),
 was_published boolean not null default false, closed boolean not null default false, moderation_hold boolean not null default false, created_at timestamptz not null default now()
);
create index media_reader_comments_article_idx on private.media_reader_comments(article_id,created_at);
create table private.media_comment_thanks (
 user_id uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references private.media_reader_comments(id) on delete cascade, primary key(user_id,comment_id)
);
create table private.media_comment_blocks (
 site_id uuid not null references public.media_sites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, primary key(site_id,user_id)
);
create table private.media_reader_notices (
 id uuid primary key default gen_random_uuid(), recipient uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references private.media_reader_comments(id) on delete cascade,
 read_at timestamptz, created_at timestamptz not null default now(), unique(recipient,comment_id)
);
create table private.media_reader_reports (
 reporter uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references private.media_reader_comments(id) on delete cascade,
 case_id uuid not null references private.media_report_cases(id), evidence_body text not null check(char_length(evidence_body)<=2000), primary key(reporter,comment_id)
);
create table private.media_read_events (
 article_id uuid not null references public.media_articles(id) on delete cascade,
 visitor uuid not null, day date not null default current_date, kind text not null check(kind in ('read','share')),
 primary key(article_id,visitor,day,kind)
);
create table private.media_measurement_rates (
 day date not null, key text not null check(key ~ '^[a-f0-9]{64}$'), hits integer not null check(hits between 0 and 20000), primary key(day,key)
);
do $$ declare t text; begin
 foreach t in array array['media_readers','media_reader_marks','media_reader_follows','media_comment_settings','media_reader_comments','media_comment_thanks','media_comment_blocks','media_reader_notices','media_reader_reports','media_read_events','media_measurement_rates'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Private tables are deliberately accessible only through the bounded, checked projection RPCs below.
create function private.media_social_article(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_articles a join public.media_sites s on s.id=a.site_id
 join private.media_reviewed_publications r on r.version_id=a.current_published_version_id and r.revoked_at is null
 where a.id=p_id and a.status='published' and s.is_published and not a.moderation_hold and not s.moderation_hold and a.deleted_at is null and s.deleted_at is null);
$$;
create function private.media_reader_card(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.public_id,'name',r.name,'icon',r.icon,'avatar',r.avatar,'bio',case when r.destination='none' then '' else r.bio end,'href',case
 when r.destination='profile' then '/media-reader/'||r.public_id::text
 when r.destination='media' then (select '/media/'||s.slug from public.media_sites s where s.owner_id=r.user_id and s.is_published and not s.moderation_hold and s.deleted_at is null limit 1)
 else null end) from private.media_readers r where r.user_id=p_user;
$$;
create function public.media_reader_profile(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.media_reader_card(user_id) from private.media_readers where public_id=p_id and destination<>'none';
$$;
create function public.media_social_read(p_site text,p_article text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.media_sites; a public.media_articles; actor uuid:=auth.uid(); result jsonb;
begin
 select * into s from public.media_sites where slug=p_site and deleted_at is null and not moderation_hold;
 if s.id is null or not exists(select 1 from public.media_articles x where x.site_id=s.id and private.media_social_article(x.id)) then return null; end if;
 result:=jsonb_build_object('following',exists(select 1 from private.media_reader_follows where user_id=actor and site_id=s.id),'owner',s.owner_id=actor,'signedIn',actor is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
 if p_article is null then return result; end if;
 select x.* into a from public.media_articles x join public.media_article_versions v on v.id=x.current_published_version_id where x.site_id=s.id and v.slug=p_article and private.media_social_article(x.id) limit 1;
 if a.id is null then return null; end if;
 return result||jsonb_build_object('mode',coalesce((select mode from private.media_comment_settings where article_id=a.id),'review'),
 'saved',exists(select 1 from private.media_reader_marks where user_id=actor and article_id=a.id and kind='saved'),
 'favorite',exists(select 1 from private.media_reader_marks where user_id=actor and article_id=a.id and kind='favorite'),
 'blocked',exists(select 1 from private.media_comment_blocks where user_id=actor and site_id=s.id),
 'comments',coalesce((select jsonb_agg(row_data order by created_at) from (
 select c.created_at,jsonb_build_object('id',c.id,'replyTo',c.reply_to,'rootId',c.root_id,'body',case when c.status='deleted' then '' else c.body end,'status',c.status,'closed',c.closed,'held',c.moderation_hold or exists(select 1 from private.media_reader_comments root where root.id=c.root_id and root.moderation_hold),'createdAt',c.created_at,
 'author',coalesce(private.media_reader_card(c.user_id),jsonb_build_object('name','読者','icon','🌱')) || case when c.user_id=s.owner_id then jsonb_build_object('name',s.author_name,'avatar',coalesce(public.media_public_presentation(s.slug)->>'authorAvatarUrl',''),'href','/media/'||s.slug) else '{}'::jsonb end,'mine',c.user_id=actor,'owner',c.user_id=s.owner_id,
 'thanks',(select count(*) from private.media_comment_thanks t where t.comment_id=c.id),'thanked',exists(select 1 from private.media_comment_thanks t where t.comment_id=c.id and t.user_id=actor)) row_data
 from private.media_reader_comments c where c.article_id=a.id and (((c.status='visible' or (c.status='deleted' and c.was_published)) and not c.moderation_hold) or c.user_id=actor or s.owner_id=actor) and (c.root_id is null or c.user_id=actor or s.owner_id=actor or exists(select 1 from private.media_reader_comments root where root.id=c.root_id and (root.status='visible' or (root.status='deleted' and root.was_published)) and not root.moderation_hold))
 order by c.created_at limit 500) q),'[]'::jsonb));
end $$;
create function private.media_comment_notify(p_comment uuid) returns void language plpgsql security definer set search_path='' as $$
declare c private.media_reader_comments; target uuid;
begin
 select * into c from private.media_reader_comments where id=p_comment and status='visible' and not moderation_hold;
 if c.id is null or c.reply_to is null then return; end if;
 select user_id into target from private.media_reader_comments where id=c.reply_to;
 if target<>c.user_id and coalesce((select notify_replies from private.media_readers where user_id=target),true) then
 insert into private.media_reader_notices(recipient,comment_id) values(target,c.id) on conflict do nothing;
 end if;
end $$;
create function public.media_social_action(p_site text,p_article text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.media_sites; a public.media_articles; c private.media_reader_comments; target private.media_reader_comments; mode text; cid uuid; report_id uuid;
begin
 if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'MEDIA_LOGIN_REQUIRED' using errcode='42501'; end if;
 select * into s from public.media_sites where slug=p_site and deleted_at is null and not moderation_hold;
 if s.id is null or not exists(select 1 from public.media_articles x where x.site_id=s.id and private.media_social_article(x.id)) then raise exception 'MEDIA_NOT_PUBLIC'; end if;
 insert into private.media_readers(user_id) values(actor) on conflict do nothing;
 if p_action='follow' then
 if coalesce((p_payload->>'value')::boolean,false) then insert into private.media_reader_follows(user_id,site_id) values(actor,s.id) on conflict do nothing;
 else delete from private.media_reader_follows where user_id=actor and site_id=s.id; end if;
 return public.media_social_read(p_site,p_article); end if;
 select x.* into a from public.media_articles x join public.media_article_versions v on v.id=x.current_published_version_id where x.site_id=s.id and v.slug=p_article and private.media_social_article(x.id) limit 1;
 if a.id is null then raise exception 'MEDIA_NOT_PUBLIC'; end if;
 if p_action in ('saved','favorite') then
 if coalesce((p_payload->>'value')::boolean,false) then insert into private.media_reader_marks(user_id,article_id,kind) values(actor,a.id,p_action) on conflict do nothing;
 else delete from private.media_reader_marks where user_id=actor and article_id=a.id and kind=p_action; end if;
 elsif p_action='mode' then
 if s.owner_id<>actor then raise exception 'MEDIA_FORBIDDEN' using errcode='42501'; end if;
 insert into private.media_comment_settings(article_id,mode) values(a.id,p_payload->>'mode') on conflict(article_id) do update set mode=excluded.mode;
 elsif p_action='comment' then
 mode:=coalesce((select x.mode from private.media_comment_settings x where article_id=a.id),'review');
 if mode='closed' or exists(select 1 from private.media_comment_blocks where user_id=actor and site_id=s.id) then raise exception 'MEDIA_COMMENTS_CLOSED'; end if;
 if char_length(btrim(coalesce(p_payload->>'body',''))) not between 1 and 2000 then raise exception 'MEDIA_COMMENT_LENGTH'; end if;
 if (select count(*) from private.media_reader_comments where user_id=actor and created_at>now()-interval '1 minute')>=5 then raise exception 'MEDIA_RATE_LIMIT'; end if;
 if p_payload->>'replyTo' is not null then
 select * into target from private.media_reader_comments where id=(p_payload->>'replyTo')::uuid and article_id=a.id and status='visible' and not moderation_hold;
 if target.id is null or target.closed or exists(select 1 from private.media_reader_comments where id=target.root_id and (closed or moderation_hold or status not in ('visible','deleted'))) then raise exception 'MEDIA_REPLY_UNAVAILABLE'; end if;
 end if;
 insert into private.media_reader_comments(article_id,user_id,reply_to,root_id,body,status,was_published)
 values(a.id,actor,target.id,coalesce(target.root_id,target.id),btrim(p_payload->>'body'),case when mode='open' or actor=s.owner_id then 'visible' else 'pending' end,mode='open' or actor=s.owner_id) returning id into cid;
 perform private.media_comment_notify(cid);
 else
 select * into c from private.media_reader_comments where id=(p_payload->>'id')::uuid and article_id=a.id for update;
 if c.id is null or not(((c.status='visible' or (c.status='deleted' and c.was_published)) and not c.moderation_hold) or c.user_id=actor or s.owner_id=actor) or (c.root_id is not null and c.user_id<>actor and s.owner_id<>actor and not exists(select 1 from private.media_reader_comments root where root.id=c.root_id and (root.status='visible' or (root.status='deleted' and root.was_published)) and not root.moderation_hold)) then raise exception 'MEDIA_COMMENT_UNAVAILABLE'; end if;
 if p_action in ('thanks','report','approve') and (c.moderation_hold or exists(select 1 from private.media_reader_comments root where root.id=c.root_id and root.moderation_hold)) then raise exception 'MEDIA_COMMENT_HELD'; end if;
 if p_action='thanks' and c.status='visible' then
 if coalesce((p_payload->>'value')::boolean,false) then insert into private.media_comment_thanks(user_id,comment_id) values(actor,c.id) on conflict do nothing;
 else delete from private.media_comment_thanks where user_id=actor and comment_id=c.id; end if;
 elsif p_action='delete' and c.user_id=actor then update private.media_reader_comments set body='',status='deleted' where id=c.id;
 elsif p_action in ('approve','hide','close','block') and s.owner_id=actor then
 if p_action='approve' and c.status<>'deleted' then update private.media_reader_comments set status='visible',was_published=true where id=c.id; perform private.media_comment_notify(c.id);
 elsif p_action='hide' and c.status<>'deleted' then update private.media_reader_comments set status='hidden' where id=c.id;
 elsif p_action='close' then update private.media_reader_comments set closed=coalesce((p_payload->>'value')::boolean,true) where id=coalesce(c.root_id,c.id);
 elsif p_action='block' and c.user_id<>s.owner_id then
 if coalesce((p_payload->>'value')::boolean,true) then insert into private.media_comment_blocks(site_id,user_id) values(s.id,c.user_id) on conflict do nothing;
 else delete from private.media_comment_blocks where site_id=s.id and user_id=c.user_id; end if;
 end if;
 elsif p_action='report' and c.status='visible' then
 if not exists(select 1 from private.media_reader_reports where reporter=actor and comment_id=c.id) then
 if (select count(*) from private.media_report_cases where opened_by=actor and received_at>now()-interval '1 day')>=20 then raise exception 'MEDIA_RATE_LIMIT'; end if;
 insert into private.media_report_cases(canonical_url,reason_category,evidence_ref,opened_by)
 values('/media/'||s.slug||'/'||p_article||'#comment-'||c.id,'other','media-comment:'||c.id,actor) returning id into report_id;
 insert into private.media_reader_reports(reporter,comment_id,case_id,evidence_body) values(actor,c.id,report_id,c.body);
 end if;
 else raise exception 'MEDIA_FORBIDDEN' using errcode='42501'; end if;
 end if;
 return public.media_social_read(p_site,p_article);
end $$;
create function public.media_reader_home(p_action text default 'read',p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r private.media_readers;
begin
 if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'MEDIA_LOGIN_REQUIRED' using errcode='42501'; end if;
 insert into private.media_readers(user_id) values(actor) on conflict do nothing;
 if p_action='profile' then update private.media_readers set name=btrim(p_payload->>'name'),bio=coalesce(p_payload->>'bio',''),icon=coalesce(p_payload->>'icon','🌱'),avatar=coalesce(p_payload->>'avatar',''),destination=coalesce(p_payload->>'destination','none') where user_id=actor;
 elsif p_action='notifications' then update private.media_readers set notify_replies=(p_payload->>'value')::boolean where user_id=actor;
 elsif p_action='read_notices' then update private.media_reader_notices set read_at=now() where recipient=actor;
 elsif p_action='remove' then delete from private.media_reader_marks where user_id=actor and article_id=(p_payload->>'id')::uuid and kind=p_payload->>'kind';
 elsif p_action='unfollow' then delete from private.media_reader_follows where user_id=actor and site_id=(p_payload->>'id')::uuid;
 elsif p_action<>'read' then raise exception 'MEDIA_INVALID_ACTION'; end if;
 select * into r from private.media_readers where user_id=actor;
 return jsonb_build_object('profile',jsonb_build_object('id',r.public_id,'name',r.name,'bio',r.bio,'icon',r.icon,'avatar',r.avatar,'destination',r.destination),'notifyReplies',r.notify_replies,
 'articles',coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from (
 select jsonb_build_object('id',a.id,'kind',m.kind,'title',v.title,'href','/media/'||s.slug||'/'||v.slug,'site',s.name,'createdAt',m.created_at) x
 from private.media_reader_marks m join public.media_articles a on a.id=m.article_id join public.media_sites s on s.id=a.site_id join public.media_article_versions v on v.id=a.current_published_version_id
 where m.user_id=actor and private.media_social_article(a.id)) q),'[]'::jsonb),
 'following',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'href','/media/'||s.slug)) from private.media_reader_follows f join public.media_sites s on s.id=f.site_id
 where f.user_id=actor and s.is_published and not s.moderation_hold and s.deleted_at is null),'[]'::jsonb),
 'feed',coalesce((select jsonb_agg(x) from (select jsonb_build_object('id',a.id,'title',v.title,'href','/media/'||s.slug||'/'||v.slug,'site',s.name) x
 from private.media_reader_follows f join public.media_sites s on s.id=f.site_id join public.media_articles a on a.site_id=s.id join public.media_article_versions v on v.id=a.current_published_version_id
 where f.user_id=actor and private.media_social_article(a.id) order by v.published_at desc limit 50) q),'[]'::jsonb),
 'notices',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'read',n.read_at is not null,'name',coalesce(rp.name,'読者'),'href','/media/'||s.slug||'/'||v.slug||'#comment-'||c.id) order by n.created_at desc)
 from private.media_reader_notices n join private.media_reader_comments c on c.id=n.comment_id join public.media_articles a on a.id=c.article_id join public.media_sites s on s.id=a.site_id join public.media_article_versions v on v.id=a.current_published_version_id left join private.media_readers rp on rp.user_id=c.user_id
 where n.recipient=actor and c.status='visible' and not c.moderation_hold and (c.root_id is null or exists(select 1 from private.media_reader_comments root where root.id=c.root_id and (root.status='visible' or (root.status='deleted' and root.was_published)) and not root.moderation_hold)) and private.media_social_article(a.id)),'[]'::jsonb));
end $$;
create function public.media_record_read(p_site text,p_article text,p_visitor uuid,p_kind text,p_rate_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare aid uuid;
begin
 if p_kind not in ('read','share') or p_visitor is null or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' or p_rate_key=repeat('0',64) then raise exception 'MEDIA_INVALID_EVENT'; end if;
 select a.id into aid from public.media_articles a join public.media_sites s on s.id=a.site_id join public.media_article_versions v on v.id=a.current_published_version_id where s.slug=p_site and v.slug=p_article and private.media_social_article(a.id) limit 1;
 if aid is null then return false;end if;
 -- Serialize the small daily counters, so new connections cannot race the global ceiling.
 perform pg_catalog.pg_advisory_xact_lock(73184921);
 delete from private.media_measurement_rates where day<current_date-1;
 if coalesce((select hits from private.media_measurement_rates where day=current_date and key=p_rate_key),0)>=120
 or coalesce((select hits from private.media_measurement_rates where day=current_date and key=repeat('0',64)),0)>=20000 then return false;end if;
 insert into private.media_measurement_rates(day,key,hits) values(current_date,p_rate_key,1),(current_date,repeat('0',64),1)
 on conflict(day,key) do update set hits=media_measurement_rates.hits+1;
 insert into private.media_read_events(article_id,visitor,kind) values(aid,p_visitor,p_kind) on conflict do nothing;
 return true;
end $$;
create function public.media_owner_analytics(p_site uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.media_sites where id=p_site and owner_id=auth.uid()) then raise exception 'MEDIA_FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('read',(select count(*) from private.media_read_events e join public.media_articles a on a.id=e.article_id where a.site_id=p_site and e.kind='read'),
 'share',(select count(*) from private.media_read_events e join public.media_articles a on a.id=e.article_id where a.site_id=p_site and e.kind='share'),
 'saved',(select count(*) from private.media_reader_marks m join public.media_articles a on a.id=m.article_id where a.site_id=p_site and m.kind='saved'),
 'favorite',(select count(*) from private.media_reader_marks m join public.media_articles a on a.id=m.article_id where a.site_id=p_site and m.kind='favorite'));
end $$;
revoke all on function private.media_social_article(uuid),private.media_reader_card(uuid),private.media_comment_notify(uuid) from public,anon,authenticated;
revoke all on function public.media_social_read(text,text),public.media_social_action(text,text,text,jsonb),public.media_reader_home(text,jsonb),public.media_reader_profile(uuid),public.media_record_read(text,text,uuid,text,text),public.media_owner_analytics(uuid) from public,anon,authenticated;
grant execute on function public.media_social_read(text,text),public.media_reader_profile(uuid) to anon,authenticated;
grant execute on function public.media_record_read(text,text,uuid,text,text) to service_role;
grant execute on function public.media_social_action(text,text,text,jsonb),public.media_reader_home(text,jsonb),public.media_owner_analytics(uuid) to authenticated;
-- Existing operations actors can inspect the report evidence and hide only the reported comment.
create function public.media_ops_comment_reports(p_actor uuid,p_case uuid default null,p_hide boolean default false,p_release boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_FORBIDDEN' using errcode='42501'; end if;
 if p_release and private.media_ops_actor_role(p_actor)<>'final_decider' then raise exception 'MEDIA_OPS_FINAL_DECIDER_REQUIRED' using errcode='42501';end if;
 if p_hide and p_release then raise exception 'MEDIA_INVALID_ACTION';end if;
 if p_hide or p_release then
 if p_case is null then raise exception 'MEDIA_REPORT_REQUIRED'; end if;
 update private.media_reader_comments set moderation_hold=p_hide,status=case when p_hide and status<>'deleted' then 'hidden' else status end where id in(select comment_id from private.media_reader_reports where case_id=p_case);
 update private.media_report_cases set status='triage',updated_at=now() where id=p_case;
 insert into private.media_audit_events(event_type,report_case_id,actor_kind,actor_id,details) values(case when p_hide then 'comment_hold' else 'comment_release' end,p_case,'operator',p_actor,'{}');
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('caseId',r.case_id,'commentId',c.id,'body',r.evidence_body,'commentStatus',c.status,'held',c.moderation_hold,'reportStatus',rc.status,'receivedAt',rc.received_at,'url',rc.canonical_url))
 from private.media_reader_reports r join private.media_reader_comments c on c.id=r.comment_id join private.media_report_cases rc on rc.id=r.case_id
 where p_case is null or r.case_id=p_case),'[]'::jsonb);
end $$;
revoke all on function public.media_ops_comment_reports(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.media_ops_comment_reports(uuid,uuid,boolean,boolean) to service_role;






commit;
