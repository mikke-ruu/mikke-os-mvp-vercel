-- Run inside an outer BEGIN after baseline + foundation + additive gate.
-- Only synthetic fixtures. Caller must ROLLBACK and verify zero residue separately.
savepoint media_private_gate_tests;
grant select on storage.objects to anon,authenticated;
create policy media_fixture_broad_storage_read on storage.objects for select to anon,authenticated using(true);
do $$
declare
  reserved_u uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); other_s uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); asset uuid; other_asset uuid; cat uuid:=gen_random_uuid(); v uuid;
  suffix text:=replace(gen_random_uuid()::text,'-',''); p text; other_p text;
  reviewed jsonb; old_review jsonb; locator jsonb; token text; old_token text; payload text; n integer;
begin
  if has_function_privilege('authenticated','public.media_publish_article(uuid,text,boolean,boolean,boolean)','execute')
    or has_function_privilege('anon','public.media_review_article(uuid)','execute')
    or has_function_privilege('authenticated','public.media_register_private_image(uuid,text,bigint,text,text)','execute')
    or has_function_privilege('authenticated','public.media_resolve_public_image(text)','execute')
    or has_function_privilege('anon','public.media_resolve_public_image(text)','execute')
    or has_table_privilege('authenticated','private.media_public_image_tokens','select')
    or has_table_privilege('anon','private.media_private_images','select')
    or has_table_privilege('authenticated','public.media_articles','delete') then
    raise exception 'MEDIA_PRIVATE_UNSAFE_GRANTS';
  end if;
  if exists(select 1 from private.media_legal_revisions where is_active) then raise exception 'MEDIA_LEGAL_SEEDED_ACTIVE'; end if;
  if not exists(select 1 from storage.buckets where id='mikke-media-private' and not public
    and file_size_limit=3145728 and allowed_mime_types=array['image/webp']) then raise exception 'MEDIA_BUCKET_UNSAFE'; end if;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(u,'private-owner-'||suffix||'@example.invalid','{}','{}',now(),now()),
      (other_u,'private-other-'||suffix||'@example.invalid','{}','{}',now(),now()),
      (reserved_u,'private-reserved-'||suffix||'@example.invalid','{}','{}',now(),now());
  insert into public.media_sites(id,owner_id,name,slug,author_name) values
    (s,u,'Owner','private-owner-'||suffix,'Author'),(other_s,other_u,'Other','private-other-'||suffix,'Other');
  insert into public.media_categories(id,site_id,name,slug) values(cat,s,'News','news');
  insert into public.media_articles(id,site_id,category_id,title,slug,draft_blocks)
    values(a,s,cat,'First','first',jsonb_build_array(jsonb_build_object('id','p1','type','paragraph','text','hello')));
  p:=u::text||'/media/'||repeat('a',64)||'.webp'; other_p:=other_u::text||'/media/'||repeat('b',64)||'.webp';
  insert into storage.objects(bucket_id,name,metadata) values
    ('mikke-media-private',p,'{"size":10,"mimetype":"image/webp"}'),
    ('mikke-media-private',other_p,'{"size":10,"mimetype":"image/webp"}');
  execute 'set local role service_role';
  asset:=(public.media_register_private_image(u,p,10,repeat('a',64),'owner.webp')->>'assetId')::uuid;
  if (public.media_register_private_image(u,p,10,repeat('a',64),'owner.webp')->>'assetId')::uuid<>asset then
    raise exception 'MEDIA_PRIVATE_REGISTRATION_NOT_IDEMPOTENT'; end if;
  other_asset:=(public.media_register_private_image(other_u,other_p,10,repeat('b',64),'other.webp')->>'assetId')::uuid;
  begin perform public.media_register_private_image(u,p,3145729,repeat('a',64),'oversize.webp');
    raise exception 'MEDIA_OVERSIZE_IMAGE_REGISTERED';
  exception when others then if sqlerrm<>'MEDIA_INVALID_PRIVATE_IMAGE' then raise; end if; end;
  if public.media_resolve_owner_image(other_u,asset) is not null then raise exception 'MEDIA_OTHER_OWNER_LOCATOR_LEAK'; end if;
  begin perform public.media_register_private_image(u,p,10,repeat('c',64),'changed.webp');
    raise exception 'MEDIA_REGISTRATION_DIGEST_CHANGED';
  exception when others then if sqlerrm<>'MEDIA_PRIVATE_IMAGE_IDEMPOTENCY_CONFLICT' then raise; end if; end;
  execute 'reset role';
  select count(*) into n from public.mikke_media_assets where owner_id=u;
  if n<>1 then raise exception 'MEDIA_PRIVATE_QUOTA_DOUBLE_COUNT'; end if;
  insert into public.mikke_media_assets(owner_id,storage_path,original_name,mime_type,byte_size,source_app,status)
    values(u,u::text||'/images/2026-09/shared-pending.webp','shared.webp','image/webp',5,'page','pending');
  update public.mikke_media_accounts set max_bytes=24 where owner_id=u;
  insert into storage.objects(bucket_id,name,metadata) values('mikke-media-private',u::text||'/media/'||repeat('c',64)||'.webp','{"size":10,"mimetype":"image/webp"}');
  execute 'set local role service_role';
  begin perform public.media_register_private_image(u,u::text||'/media/'||repeat('c',64)||'.webp',10,repeat('c',64),'quota.webp');
    raise exception 'MEDIA_PRIVATE_QUOTA_BYPASSED';
  exception when others then if sqlerrm<>'MIKKE_MEDIA_QUOTA_EXCEEDED' then raise; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claims',json_build_object('sub',reserved_u,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',reserved_u::text,true);
  execute 'set local role authenticated';
  begin perform public.media_create_site('Reserved','images','','Reserved','ja-JP'); raise exception 'MEDIA_RESERVED_SLUG_CREATED';
  exception when check_violation then null; end;
  execute 'reset role';
  if exists(select 1 from public.media_sites where owner_id=reserved_u) then raise exception 'MEDIA_RESERVED_SLUG_RESIDUE'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',other_u,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from storage.objects where bucket_id='mikke-media-private') then raise exception 'MEDIA_PRIVATE_BUCKET_DIRECT_READ'; end if;
  begin perform public.media_publish_article_reviewed(a,repeat('0',64),'fixture-v1',true,true,true); raise exception 'MEDIA_OTHER_PUBLISH_ALLOWED';
  exception when others then if sqlerrm<>'MEDIA_ARTICLE_NOT_AVAILABLE' then raise; end if; end;
  begin perform public.media_review_article(a); raise exception 'MEDIA_OTHER_REVIEW_ALLOWED';
  exception when others then if sqlerrm<>'MEDIA_ARTICLE_NOT_AVAILABLE' then raise; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  begin perform public.media_review_article(a); raise exception 'MEDIA_ANON_REVIEW_ALLOWED';
  exception when others then if sqlerrm<>'MEDIA_HUMAN_AUTH_REQUIRED' then raise; end if; end;
  begin perform public.media_accept_terms('fixture-v1',repeat('d',64),true); raise exception 'MEDIA_ANON_TERMS_ALLOWED';
  exception when others then if sqlerrm<>'MEDIA_HUMAN_AUTH_REQUIRED' then raise; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
  execute 'set local role authenticated';
  if public.media_current_terms() is not null then raise exception 'MEDIA_INACTIVE_TERMS_VISIBLE'; end if;
  begin perform public.media_publish_article(a,'fixture-v1',true,true,true); raise exception 'MEDIA_OLD_RPC_ACCESSIBLE';
  exception when insufficient_privilege then null; end;
  reviewed:=public.media_review_article(a);
  begin perform public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_IMPLICIT_TERMS_ACCEPTANCE';
  exception when others then if sqlerrm<>'MEDIA_TERMS_ACCEPTANCE_REQUIRED' then raise; end if; end;
  execute 'reset role';
  insert into private.media_legal_revisions(terms_version,document_sha256,document_url,is_active)
    values('fixture-v1',repeat('d',64),'/legal/media/fixture-v1',false);
  execute 'set local role authenticated';
  begin perform public.media_accept_terms('fixture-v1',repeat('d',64),true); raise exception 'MEDIA_INACTIVE_TERMS_ACCEPTED';
  exception when others then if sqlerrm<>'MEDIA_TERMS_NOT_ACTIVE' then raise; end if; end;
  execute 'reset role';
  update private.media_legal_revisions set is_active=true where terms_version='fixture-v1';
  execute 'set local role authenticated';
  if (public.media_current_terms()->>'accepted')::boolean then raise exception 'MEDIA_TERMS_INFERRED_ACCEPTANCE'; end if;
  begin perform public.media_accept_terms('fixture-v1',repeat('d',64),false); raise exception 'MEDIA_FALSE_CONSENT_ACCEPTED';
  exception when others then if sqlerrm<>'MEDIA_TERMS_EXPLICIT_CONSENT_REQUIRED' then raise; end if; end;
  perform public.media_accept_terms('fixture-v1',repeat('d',64),true);
  if not (public.media_current_terms()->>'accepted')::boolean then raise exception 'MEDIA_TERMS_ACCEPTANCE_MISSING'; end if;
  reviewed:=public.media_review_article(a);
  execute 'reset role';
  update private.media_legal_revisions set is_active=false where terms_version='fixture-v1';
  execute 'set local role authenticated';
  begin perform public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_RETIRED_TERMS_PUBLISHED';
  exception when others then if sqlerrm<>'MEDIA_TERMS_ACCEPTANCE_REQUIRED' then raise; end if; end;
  execute 'reset role';
  update private.media_legal_revisions set is_active=true where terms_version='fixture-v1';
  execute 'set local role authenticated';
  old_review:=public.media_review_article(a);
  update public.media_articles set title='Changed' where id=a;
  begin perform public.media_publish_article_reviewed(a,old_review->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_STALE_ARTICLE_PUBLISHED';
  exception when others then if sqlerrm<>'MEDIA_REVIEW_REVISION_CHANGED' then raise; end if; end;
  old_review:=public.media_review_article(a);
  update public.media_categories set name='Changed category' where id=cat;
  begin perform public.media_publish_article_reviewed(a,old_review->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_STALE_CATEGORY_PUBLISHED';
  exception when others then if sqlerrm<>'MEDIA_REVIEW_REVISION_CHANGED' then raise; end if; end;
  old_review:=public.media_review_article(a);
  update public.media_sites set name='Changed site' where id=s;
  begin perform public.media_publish_article_reviewed(a,old_review->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_STALE_SITE_PUBLISHED';
  exception when others then if sqlerrm<>'MEDIA_REVIEW_REVISION_CHANGED' then raise; end if; end;
  update public.media_articles set cover_image_asset_id=other_asset,cover_image_url='/api/media/assets/'||other_asset where id=a;
  begin perform public.media_review_article(a); raise exception 'MEDIA_OTHER_ASSET_REVIEW_ALLOWED';
  exception when others then if sqlerrm not in('MEDIA_ASSET_NOT_AVAILABLE','MEDIA_UNSAFE_ASSET_REFERENCE') then raise; end if; end;
  update public.media_articles set cover_image_asset_id=asset,cover_image_url='/api/media/assets/'||asset,
    draft_blocks=jsonb_build_array(jsonb_build_object('id','img1','type','image','imageUrl','/api/media/assets/'||asset,'imageAssetId',asset,'alt','sample')) where id=a;
  reviewed:=public.media_review_article(a);
  v:=public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
  execute 'reset role';
  select t.token into token from private.media_public_image_tokens t where t.version_id=v and t.asset_id=asset;
  if length(token)<>64 then raise exception 'MEDIA_PUBLIC_TOKEN_MISSING'; end if;
  execute 'set local role service_role';
  locator:=public.media_resolve_public_image(token);
  if locator->>'bucket'<>'mikke-media-private' or locator->>'storagePath'<>p then raise exception 'MEDIA_PUBLIC_LOCATOR_INVALID'; end if;
  execute 'reset role';
  execute 'set local role anon';
  if exists(select 1 from storage.objects where bucket_id='mikke-media-private') then raise exception 'MEDIA_PRIVATE_BUCKET_ANON_READ'; end if;
  select row_to_json(q)::text into payload from public.media_public_article('private-owner-'||suffix,'ja-JP','first') q;
  if payload is null or position('/media/images/'||token in payload)=0 or position('/api/media/assets' in payload)>0
    or position(u::text in payload)>0 or position(asset::text in payload)>0 or position(p in payload)>0 then raise exception 'MEDIA_PUBLIC_IMAGE_LEAK'; end if;
  execute 'reset role';
  old_token:=token;
  execute 'set local role authenticated';
  perform public.media_unpublish_article(a);
  execute 'reset role';
  if public.media_resolve_public_image(old_token) is not null then raise exception 'MEDIA_CANCELLED_TOKEN_VISIBLE'; end if;
  execute 'set local role authenticated';
  reviewed:=public.media_review_article(a);
  v:=public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
  execute 'reset role';
  select t.token into token from private.media_public_image_tokens t where t.version_id=v and t.asset_id=asset;
  if token=old_token or public.media_resolve_public_image(old_token) is not null then raise exception 'MEDIA_OLD_TOKEN_REVIVED'; end if;
  update public.media_articles set moderation_hold=true where id=a;
  if public.media_resolve_public_image(token) is not null then raise exception 'MEDIA_HELD_TOKEN_VISIBLE'; end if;
  if exists(select 1 from public.media_public_article('private-owner-'||suffix,'ja-JP','first')) then raise exception 'MEDIA_HELD_ARTICLE_VISIBLE'; end if;
  update public.media_articles set moderation_hold=false where id=a;
  if public.media_resolve_public_image(token) is not null then raise exception 'MEDIA_HOLD_CLEAR_REVIVED_TOKEN'; end if;
  if exists(select 1 from public.media_public_article('private-owner-'||suffix,'ja-JP','first')) then raise exception 'MEDIA_HOLD_CLEAR_REVIVED_TEXT'; end if;
  execute 'set local role authenticated';
  reviewed:=public.media_review_article(a);
  execute 'reset role';
  update private.media_private_images set moderation_hold=true where asset_id=asset;
  update private.media_private_images set moderation_hold=false where asset_id=asset;
  execute 'set local role authenticated';
  begin perform public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
    raise exception 'MEDIA_ASSET_HOLD_CLEAR_REUSED_CONFIRMATION';
  exception when others then if sqlerrm<>'MEDIA_REVIEW_REVISION_CHANGED' then raise; end if; end;
  reviewed:=public.media_review_article(a);
  v:=public.media_publish_article_reviewed(a,reviewed->>'expectedRevision','fixture-v1',true,true,true);
  execute 'reset role';
  select t.token into token from private.media_public_image_tokens t where t.version_id=v and t.asset_id=asset;
  update private.media_private_images set deleted_at=now() where asset_id=asset;
  if public.media_resolve_public_image(token) is not null then raise exception 'MEDIA_DELETED_IMAGE_VISIBLE'; end if;
  update public.media_sites set deleted_at=now() where id=s;
  if exists(select 1 from public.media_public_site('private-owner-'||suffix,'ja-JP')) then raise exception 'MEDIA_DELETED_SITE_VISIBLE'; end if;
  raise notice 'Media private publication SQL checks PASS';
end $$;
rollback to savepoint media_private_gate_tests;
release savepoint media_private_gate_tests;
