-- Synthetic transaction only; no real accounts or articles.
savepoint media_full_blocks_test;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
  asset uuid; image_url text; p text; blocks jsonb; bad jsonb; review jsonb; v uuid; public_blocks jsonb; suffix text:=replace(gen_random_uuid()::text,'-','');
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(u,'full-'||suffix||'@example.invalid','{}','{}',now(),now());
  insert into public.media_sites(id,owner_id,name,slug,author_name) values(s,u,'Full editor','full-'||suffix,'Publisher');
  p:=u::text||'/media/'||repeat('f',64)||'.webp';
  insert into storage.objects(bucket_id,name,metadata) values('mikke-media-private',p,'{"size":10,"mimetype":"image/webp"}');
  execute 'set local role service_role';
  asset:=(public.media_register_private_image(u,p,10,repeat('f',64),'full.webp')->>'assetId')::uuid;
  execute 'reset role'; image_url:='/api/media/assets/'||asset::text;
  blocks:=jsonb_build_array(
    '{"id":"p","type":"paragraph","text":"ABC","align":"center","richText":[{"text":"A","bold":true},{"text":"B","strike":true},{"text":"C","href":"https://example.com"}]}'::jsonb,
    '{"id":"h","type":"heading","text":"見出し","level":3,"align":"right","richText":[{"text":"見出し","bold":true}]}'::jsonb,
    jsonb_build_object('id','i','type','image','imageUrl',image_url,'imageAssetId',asset,'alt','image','imageLink','https://example.com'),
    '{"id":"q","type":"quote","text":"quote","attribution":"source"}'::jsonb,
    '{"id":"list","type":"list","items":["one","two"]}'::jsonb,
    '{"id":"d","type":"divider"}'::jsonb,
    jsonb_build_object('id','card','type','link','url','https://example.com','title','Card','text','description','imageUrl',image_url,'imageAssetId',asset),
    '{"id":"video","type":"video","url":"https://youtu.be/abcdefghijk"}'::jsonb,
    '{"id":"links","type":"links","title":"links","links":[{"label":"site","url":"https://example.com"}]}'::jsonb,
    jsonb_build_object('id','it','type','image-text','imageUrl',image_url,'imageAssetId',asset,'alt','image text','text','body','title','title','imageSide','right','imageLink','/media'),
    jsonb_build_object('id','g','type','gallery','columns',2,'images',jsonb_build_array(jsonb_build_object('url',image_url,'assetId',asset,'alt','gallery','href','https://example.com','caption','caption'))),
    '{"id":"cta","type":"cta","title":"CTA","text":"body","buttonLabel":"見る","url":"https://example.com"}'::jsonb,
    '{"id":"remote","type":"link","url":"https://example.com","title":"Remote","text":"description","imageUrl":"https://example.com/card.webp"}'::jsonb
  );
  if not private.media_blocks_are_safe(blocks,u) then raise exception 'FULL_VALID_BLOCKS_REJECTED'; end if;
  if private.media_blocks_are_safe(blocks,other_u) then raise exception 'FULL_OTHER_OWNER_ASSET_ALLOWED'; end if;
  bad:=jsonb_set(blocks,'{0,richText,0,text}','"mismatch"');
  if private.media_blocks_are_safe(bad,u) then raise exception 'FULL_RICH_TEXT_MISMATCH_ALLOWED'; end if;
  bad:=jsonb_set(blocks,'{0,richText,2,href}','"javascript:alert(1)"');
  if private.media_blocks_are_safe(bad,u) then raise exception 'FULL_SCRIPT_LINK_ALLOWED'; end if;
  bad:=jsonb_set(blocks,'{10,images,0,assetId}',to_jsonb(gen_random_uuid()));
  if private.media_blocks_are_safe(bad,u) then raise exception 'FULL_GALLERY_ASSET_SUBSTITUTION'; end if;
  bad:=jsonb_set(blocks,'{0,secret}','"private"');
  if private.media_blocks_are_safe(bad,u) then raise exception 'FULL_UNKNOWN_KEY_ALLOWED'; end if;
  bad:=jsonb_set(blocks,'{12,imageUrl}','"https://127.0.0.1/a.png"');
  if private.media_blocks_are_safe(bad,u) then raise exception 'FULL_PRIVATE_CARD_URL_ALLOWED'; end if;
  if not private.media_blocks_are_safe('[{"id":"old","type":"paragraph","text":"legacy"}]',u) then raise exception 'FULL_LEGACY_BLOCK_REJECTED'; end if;
  insert into public.media_articles(id,site_id,title,slug,draft_blocks) values(a,s,'Full content','full-content',blocks);
  -- Test transaction restores the original active revision at the savepoint.
  update private.media_legal_revisions set is_active=false where is_active;
  insert into private.media_legal_revisions(terms_version,document_sha256,document_url,is_active)
    values('full-'||suffix,repeat('d',64),'/legal/media/full-fixture',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  perform public.media_accept_terms('full-'||suffix,repeat('d',64),true);
  review:=public.media_review_article(a);
  v:=public.media_publish_article_reviewed(a,review->>'expectedRevision','full-'||suffix,true,true,true);
  execute 'reset role';
  if (select count(*) from public.media_article_version_assets where version_id=v)<>1 then raise exception 'FULL_NESTED_ASSET_BINDING_MISSING'; end if;
  public_blocks:=private.media_token_public_blocks(v,blocks);
  if jsonb_array_length(public_blocks)<>13 or public_blocks->0->'richText' is distinct from blocks->0->'richText' then raise exception 'FULL_PUBLIC_CONTENT_LOSS'; end if;
  if public_blocks::text ~ '(imageAssetId|assetId|/api/media/assets/)' then raise exception 'FULL_PRIVATE_ASSET_LEAK'; end if;
  if public_blocks->10->'images'->0->>'url' !~ '^/media/images/[a-f0-9]{64}$' then raise exception 'FULL_GALLERY_TOKEN_MISSING'; end if;
  if public_blocks->9->>'imageUrl' !~ '^/media/images/[a-f0-9]{64}$' then raise exception 'FULL_IMAGE_TEXT_TOKEN_MISSING'; end if;
  if public_blocks->6->>'imageUrl' !~ '^/media/images/[a-f0-9]{64}$' then raise exception 'FULL_CARD_TOKEN_MISSING'; end if;
  if public_blocks->12->>'imageUrl'<>'https://example.com/card.webp' then raise exception 'FULL_REMOTE_CARD_LOST'; end if;
  perform set_config('media.test_full_blocks',public_blocks::text,true);
  execute 'set local role authenticated';
  perform public.media_unpublish_article(a);
  execute 'reset role';
  if private.media_token_image_url(v,asset) is not null then raise exception 'FULL_CANCEL_TOKEN_LIVE'; end if;
end $$;
select 'media_full_blocks_test_ok';
select 'MEDIA_FULL_BLOCKS_DTO:'||current_setting('media.test_full_blocks');
rollback to savepoint media_full_blocks_test;
