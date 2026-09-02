-- Media Free negative contract test. Run only after the dependency migrations
-- and 20260902054001_media_free_foundation.sql in a disposable database.
-- Every fixture is rolled back.
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_anon uuid := gen_random_uuid();
  v_site uuid := gen_random_uuid();
  v_second_site uuid := gen_random_uuid();
  v_article uuid := gen_random_uuid();
  v_other_article uuid := gen_random_uuid();
  v_conflict_article uuid := gen_random_uuid();
  v_owner_asset uuid := gen_random_uuid();
  v_other_asset uuid := gen_random_uuid();
  v_version uuid;
  v_count integer;
  v_suffix text := substr(replace(gen_random_uuid()::text,'-',''),1,12);
begin
  if has_table_privilege('anon','public.media_articles','select')
    or has_table_privilege('authenticated','public.media_articles','update')
    or has_column_privilege('authenticated','public.media_articles','status','update')
    or has_column_privilege('authenticated','public.media_articles','current_published_version_id','update')
    or has_column_privilege('authenticated','public.media_sites','is_published','update')
  then raise exception 'MEDIA_UNSAFE_BASE_GRANTS'; end if;

  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    (v_owner,'media-owner-'||v_suffix||'@example.invalid','{}','{}',now(),now()),
    (v_other,'media-other-'||v_suffix||'@example.invalid','{}','{}',now(),now()),
    (v_anon,'media-anon-'||v_suffix||'@example.invalid','{}','{}',now(),now());
  insert into public.mikke_media_assets(id,owner_id,storage_path,original_name,mime_type,byte_size,source_app,status,content_sha256)
  values
    (v_owner_asset,v_owner,'media-test/'||v_owner,'owner.webp','image/webp',10,'media','active',repeat('a',64)),
    (v_other_asset,v_other,'media-test/'||v_other,'other.webp','image/webp',10,'media','active',repeat('b',64));

  perform set_config('request.jwt.claims',json_build_object('sub',v_anon,'role','authenticated','is_anonymous',true)::text,true);
  perform set_config('request.jwt.claim.sub',v_anon::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  begin
    insert into public.media_sites(owner_id,name,slug,author_name) values(v_anon,'Anon','anon-'||v_suffix,'Anon');
    raise exception 'MEDIA_ANON_CREATED_SITE';
  exception when insufficient_privilege then null; end;
  begin
    perform public.media_create_site('Anon','anon-'||v_suffix,'','Anon','ja-JP');
    raise exception 'MEDIA_ANON_CALLED_CREATE_RPC';
  exception when others then
    if sqlerrm <> 'MEDIA_HUMAN_AUTH_REQUIRED' then raise; end if;
  end;
  begin
    perform public.media_unpublish_article(v_article);
    raise exception 'MEDIA_ANON_CALLED_OWNER_RPC';
  exception when others then
    if sqlerrm <> 'MEDIA_HUMAN_AUTH_REQUIRED' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims',json_build_object('sub',v_owner,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  execute 'set local role authenticated';
  v_site := public.media_create_site('Owner Media','owner-'||v_suffix,'','Owner','ja-JP');
  select count(*) into v_count from public.mikke_app_entitlements
    where user_id=v_owner and app_key='media' and status='active' and source='media_create';
  if v_count <> 1 then raise exception 'MEDIA_CREATE_DID_NOT_MARK_OWNED'; end if;
  begin
    perform public.media_create_site('Second Free','second-'||v_suffix,'','Owner','ja-JP');
    raise exception 'MEDIA_FREE_LIMIT_BYPASSED';
  exception when others then
    if sqlerrm <> 'MEDIA_FREE_SITE_LIMIT_REACHED' then raise; end if;
  end;
  begin
    insert into public.media_sites(owner_id,name,slug,author_name) values(v_owner,'Direct','direct-'||v_suffix,'Owner');
    raise exception 'MEDIA_DIRECT_SITE_INSERT_WORKED';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  insert into public.media_sites(owner_id,name,slug,author_name,default_locale,publishing_policy)
    values(v_owner,'JLT Media','jlt-'||v_suffix,'JLT','en-US','managed_brand') returning id into v_second_site;
  execute 'set local role authenticated';
  insert into public.media_articles(site_id,locale,title,slug,draft_blocks)
    values(v_site,'ja-JP','First','first-'||v_suffix,
      jsonb_build_array(jsonb_build_object('id','p1','type','paragraph','text','hello')))
    returning id into v_article;
  begin
    execute format('update public.media_articles set status=%L where id=%L','published',v_article);
    raise exception 'MEDIA_DIRECT_STATUS_UPDATE_WORKED';
  exception when insufficient_privilege then null; end;
  begin
    execute format('update public.media_sites set is_published=true where id=%L',v_site);
    raise exception 'MEDIA_DIRECT_SITE_PUBLISH_WORKED';
  exception when insufficient_privilege then null; end;
  v_version := public.media_publish_article(v_article,'test-terms-v1',true,true,true);
  if v_version is null then raise exception 'MEDIA_PUBLISH_DID_NOT_RETURN_VERSION'; end if;
  begin
    update public.media_sites set slug='renamed-site-'||v_suffix where id=v_site;
    raise exception 'MEDIA_PUBLISHED_SITE_SLUG_CHANGED';
  exception when others then
    if sqlerrm <> 'MEDIA_PUBLISHED_SITE_SLUG_IMMUTABLE' then raise; end if;
  end;
  begin
    update public.media_article_versions set title='mutated' where id=v_version;
    raise exception 'MEDIA_CLIENT_VERSION_MUTATION_WORKED';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  begin
    update public.media_article_versions set title='mutated' where id=v_version;
    raise exception 'MEDIA_OWNER_VERSION_MUTATION_WORKED';
  exception when others then
    if sqlerrm <> 'MEDIA_PUBLISHED_VERSION_IMMUTABLE' then raise; end if;
  end;
  execute 'set local role authenticated';
  update public.media_articles set slug='renamed-'||v_suffix where id=v_article;
  begin
    perform public.media_publish_article(v_article,'test-terms-v1',true,true,true);
    raise exception 'MEDIA_PUBLISHED_SLUG_CHANGED';
  exception when others then
    if sqlerrm <> 'MEDIA_PUBLISHED_SLUG_IMMUTABLE' then raise; end if;
  end;
  update public.media_articles set slug='first-'||v_suffix where id=v_article;
  insert into public.media_articles(site_id,locale,title,slug,draft_blocks)
    values(v_site,'ja-JP','Conflict','conflict-'||v_suffix,
      jsonb_build_array(jsonb_build_object('id','p2','type','paragraph','text','conflict')))
    returning id into v_conflict_article;
  update public.media_articles set slug='moved-'||v_suffix where id=v_article;
  update public.media_articles set slug='first-'||v_suffix where id=v_conflict_article;
  begin
    perform public.media_publish_article(v_conflict_article,'test-terms-v1',true,true,true);
    raise exception 'MEDIA_RESERVED_SLUG_REUSED';
  exception when unique_violation then null; end;
  update public.media_articles set cover_image_asset_id=v_other_asset,cover_image_url='https://example.invalid/other.webp'
    where id=v_conflict_article;
  begin
    perform public.media_publish_article(v_conflict_article,'test-terms-v1',true,true,true);
    raise exception 'MEDIA_FOREIGN_ASSET_PUBLISHED';
  exception when others then
    if sqlerrm <> 'MEDIA_COVER_ASSET_NOT_AVAILABLE' then raise; end if;
  end;
  update public.media_articles set cover_image_asset_id=null,cover_image_url='',
    draft_blocks=jsonb_build_array(jsonb_build_object('id','x','type','script','text','bad'))
    where id=v_conflict_article;
  begin
    perform public.media_publish_article(v_conflict_article,'test-terms-v1',true,true,true);
    raise exception 'MEDIA_UNSAFE_BLOCK_PUBLISHED';
  exception when others then
    if sqlerrm <> 'MEDIA_UNSAFE_BLOCKS' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims',json_build_object('sub',v_other,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.media_sites where id=v_site;
  if v_count <> 0 then raise exception 'MEDIA_OTHER_USER_READ_SITE'; end if;
  begin
    perform public.media_unpublish_article(v_article);
    raise exception 'MEDIA_OTHER_USER_UNPUBLISHED_ARTICLE';
  exception when others then
    if sqlerrm <> 'MEDIA_ARTICLE_NOT_AVAILABLE' then raise; end if;
  end;
  perform public.media_create_site('Other','other-'||v_suffix,'','Other','ja-JP');
  insert into public.media_articles(site_id,locale,title,slug,draft_blocks)
    select id,'ja-JP','Other article','other-article-'||v_suffix,
      jsonb_build_array(jsonb_build_object('id','p3','type','paragraph','text','other'))
    from public.media_sites where owner_id=v_other;
  execute 'reset role';

  select count(*) into v_count from public.media_public_article('owner-'||v_suffix,'ja-JP','first-'||v_suffix);
  if v_count <> 1 then raise exception 'MEDIA_PUBLIC_PROJECTION_MISSING'; end if;
  select count(*) into v_count from public.media_public_article('other-'||v_suffix,'ja-JP','other-article-'||v_suffix);
  if v_count <> 0 then raise exception 'MEDIA_DRAFT_LEAKED_PUBLICLY'; end if;
end;
$$;

select 'media_free_foundation_rls_test_ok';

rollback;
