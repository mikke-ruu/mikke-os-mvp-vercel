-- Apply after the original publication gate, before any full Media migration.
create temporary table media_existing_snapshot_check(version_id uuid,article_id uuid,slug text,version_before jsonb,article_before jsonb,site_before jsonb);
do $$
declare u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();a uuid:=gen_random_uuid();v uuid:=gen_random_uuid();c uuid:=gen_random_uuid();legacy_slug text:='legacy-'||replace(gen_random_uuid()::text,'-',''); term text;digest text;review jsonb;
begin
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(u,legacy_slug||'@example.invalid','{}','{}',now(),now());
 insert into public.media_sites(id,owner_id,name,slug,author_name,is_published) values(s,u,'Legacy',legacy_slug,'Public name',true);
 insert into public.media_categories(id,site_id,name,slug) values(c,s,'Old category','old');
 insert into public.media_articles(id,site_id,category_id,title,slug,draft_blocks) values(a,s,c,'Existing article','existing','[{"id":"p","type":"paragraph","text":"Keep original"}]');
 select terms_version,document_sha256 into term,digest from private.media_legal_revisions where is_active limit 1;
 if term is null then raise exception 'ACTIVE_TERMS_FIXTURE_REQUIRED';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 perform public.media_accept_terms(term,digest,true);
 review:=public.media_review_article(a);
 perform public.media_publish_article_reviewed(a,review->>'expectedRevision',term,true,true,true);
 execute 'reset role';
 select current_published_version_id into v from public.media_articles where id=a;
 insert into media_existing_snapshot_check select v,a,legacy_slug,to_jsonb(ver),to_jsonb(art),to_jsonb(site)
 from public.media_article_versions ver,public.media_articles art,public.media_sites site where ver.id=v and art.id=a and site.id=s;
end $$;
