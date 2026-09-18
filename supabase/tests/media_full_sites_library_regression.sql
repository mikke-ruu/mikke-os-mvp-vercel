-- Synthetic settings/library fixtures; the native harness wraps and rolls back.
savepoint media_full_library_tests;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); os uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); asset uuid; suffix text:=replace(gen_random_uuid()::text,'-','');
 settings jsonb; review jsonb; term text; digest text; coll uuid; token text; result jsonb; i integer; extra uuid;
begin
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (u,'full-owner-'||suffix||'@example.invalid','{}','{}',now(),now()),(other_u,'full-other-'||suffix||'@example.invalid','{}','{}',now(),now());
 insert into public.media_sites(id,owner_id,name,slug,author_name) values(s,u,'Original','full-'||suffix,'Public author'),(os,other_u,'Other','other-'||suffix,'Other');
 insert into storage.objects(bucket_id,name,metadata) values('mikke-media-private',u::text||'/media/'||repeat('e',64)||'.webp','{"size":10,"mimetype":"image/webp"}');
 execute 'set local role service_role';
 asset:=(public.media_register_private_image(u,u::text||'/media/'||repeat('e',64)||'.webp',10,repeat('e',64),'brand.webp')->>'assetId')::uuid;
 execute 'reset role';
 settings:=jsonb_build_object('name','Changed','slug','full-'||suffix,'description','Intro','authorName','Public pen name','categories',jsonb_build_array('A','B'),
 'authorBio','Author bio','bannerPosition',20,'bannerImageUrl','/api/media/assets/'||asset,'logoImageUrl','','authorAvatarUrl','','storyLinkRequested',false,'storyReference','');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 perform public.media_update_settings(s,settings);
 if not exists(select 1 from public.media_sites where id=s and name='Changed' and presentation->>'authorBio'='Author bio') then raise exception 'SETTINGS_ROUNDTRIP_FAILED';end if;
 if (select count(*) from public.media_categories where site_id=s)<>2 then raise exception 'SETTINGS_CATEGORY_SAVE_FAILED';end if;
 begin perform public.media_update_settings(s,settings||jsonb_build_object('name','Must rollback','authorBio',repeat('x',501)));raise exception 'INVALID_SETTINGS_ACCEPTED';
 exception when others then if sqlerrm<>'MEDIA_SETTINGS_INVALID' then raise;end if;end;
 if exists(select 1 from public.media_sites where id=s and name='Must rollback') then raise exception 'PARTIAL_SETTINGS_COMMIT';end if;
 begin perform public.media_update_settings(s,settings||jsonb_build_object('logoImageUrl','https://example.invalid/unsafe.png'));raise exception 'EXTERNAL_BRANDING_ACCEPTED';
 exception when others then if sqlerrm<>'MEDIA_ASSET_NOT_AVAILABLE' then raise;end if;end;
 begin perform public.media_update_settings(s,settings||jsonb_build_object('storyLinkRequested',true,'storyReference','not-owned'));raise exception 'UNOWNED_STORY_LINKED';
 exception when others then if sqlerrm<>'MEDIA_STORY_OWNER_CONFIRMATION_REQUIRED' then raise;end if;end;
 execute 'reset role';
 insert into public.media_articles(id,site_id,title,slug,category_names,draft_blocks) values
 (a,s,'A','a',array['A','B'],'[{"id":"p","type":"paragraph","text":"first"}]'),(b,s,'B','b',array['B'],'[{"id":"p","type":"paragraph","text":"second"}]');
 execute 'set local role authenticated';
 begin update public.media_articles set category_names=array['Other site category'] where id=a;raise exception 'FOREIGN_CATEGORY_ACCEPTED';
 exception when others then if sqlerrm<>'MEDIA_CATEGORY_NOT_AVAILABLE' then raise;end if;end;
 execute 'reset role';
 insert into public.media_articles(id,site_id,title,slug,draft_blocks) values(c,os,'C','c','[{"id":"p","type":"paragraph","text":"other"}]');
 select terms_version,document_sha256 into term,digest from private.media_legal_revisions where is_active limit 1;
 if term is null then raise exception 'ACTIVE_TERMS_FIXTURE_REQUIRED';end if;
 execute 'set local role authenticated';
 perform public.media_accept_terms(term,digest,true);
 review:=public.media_review_article(a);perform public.media_publish_article_reviewed(a,review->>'expectedRevision',term,true,true,true);
 review:=public.media_review_article(b);perform public.media_publish_article_reviewed(b,review->>'expectedRevision',term,true,true,true);
 if not exists(select 1 from public.media_article_versions where article_id=a and categories='["A","B"]') then raise exception 'MULTI_CATEGORY_SNAPSHOT_LOST';end if;
 perform public.media_update_publication_order(a,'2026-08-01T00:00:00Z',null,true);
 if not exists(select 1 from public.media_articles where id=a and pinned and display_date='2026-08-01T00:00:00Z') then raise exception 'PIN_DATE_NOT_SAVED';end if;
 perform public.media_update_publication_order(a,null,null,false);
 perform public.media_update_publication_order(a,null,-1,null);
 if (select publication_order from public.media_articles where id=a)>=(select publication_order from public.media_articles where id=b) then raise exception 'ORDER_NOT_CHANGED';end if;
 coll:=public.media_save_collection(s,'Series',array[b,a],null);
 if not exists(select 1 from public.media_collections where id=coll and article_ids=array[b,a]) then raise exception 'COLLECTION_ORDER_LOST';end if;
 begin perform public.media_save_collection(s,'Foreign',array[c],null);raise exception 'FOREIGN_ARTICLE_IN_COLLECTION';
 exception when others then if sqlerrm<>'MEDIA_COLLECTION_INVALID' then raise;end if;end;

 execute 'reset role';
 for i in 1..55 loop
  extra:=gen_random_uuid();
  insert into public.media_articles(id,site_id,title,slug,draft_blocks) values(extra,s,'Page '||i,'page-'||i,'[{"id":"p","type":"paragraph","text":"paging"}]');
  execute 'set local role authenticated';
  review:=public.media_review_article(extra);perform public.media_publish_article_reviewed(extra,review->>'expectedRevision',term,true,true,true);
  execute 'reset role';
 end loop;
 execute 'set local role anon';
 result:=public.media_public_article_page('full-'||suffix,null,5);
 if (result->>'total')::integer<>57 or jsonb_array_length(result->'items')<>9 then raise exception 'PUBLIC_PAGE_TRUNCATED_AFTER_50';end if;
 result:=public.media_public_article_page('full-'||suffix,null,1,'','B');
 if (result->>'total')::integer<>2 then raise exception 'PUBLIC_CATEGORY_FILTER_FAILED';end if;
 result:=public.media_public_article_page('full-'||suffix,null,1,'','','',coll);
 if (result->>'total')::integer<>2 or result->'items'->0->'article'->>'slug'<>'b' then raise exception 'PUBLIC_COLLECTION_ORDER_FAILED';end if;
 execute 'reset role';
 select t.token into token from private.media_site_image_tokens t where site_id=s and field_name='bannerImageUrl';
 if public.media_resolve_site_image(token) is null then raise exception 'PUBLISHED_BRANDING_MISSING';end if;
 result:=public.media_public_presentation('full-'||suffix);
 if result::text like '%'||u::text||'%' or result::text like '%/api/media/assets/%' then raise exception 'PRIVATE_PRESENTATION_LEAK';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',other_u,'role','authenticated','is_anonymous',false)::text,true);
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.media_collections where site_id=s) then raise exception 'OTHER_COLLECTION_READ';end if;
 begin perform public.media_update_settings(s,settings);raise exception 'OTHER_SETTINGS_WRITE';exception when others then if sqlerrm<>'MEDIA_SITE_NOT_AVAILABLE' then raise;end if;end;
 begin perform public.media_update_publication_order(a,null,null,true);raise exception 'OTHER_ORDER_WRITE';exception when others then if sqlerrm<>'MEDIA_ARTICLE_NOT_AVAILABLE' then raise;end if;end;
 execute 'reset role';
 update public.media_sites set moderation_hold=true where id=s;
 if public.media_resolve_site_image(token) is not null or public.media_public_presentation('full-'||suffix) is not null then raise exception 'HELD_BRANDING_VISIBLE';end if;
 if has_function_privilege('anon','public.media_update_settings(uuid,jsonb)','execute') or has_table_privilege('authenticated','private.media_site_image_tokens','select') then raise exception 'BRANDING_UNSAFE_GRANTS';end if;
end $$;
rollback to savepoint media_full_library_tests;
