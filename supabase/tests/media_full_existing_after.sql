-- Apply after all additive full Media migrations, in the same rollback-only DB.
do $$
declare old media_existing_snapshot_check; ver jsonb; art jsonb; site jsonb; page jsonb;
begin
 for old in select * from media_existing_snapshot_check loop
  select to_jsonb(v)-'categories' into ver from public.media_article_versions v where id=old.version_id;
  select to_jsonb(a)-array['category_names','display_date','publication_order','pinned'] into art from public.media_articles a where id=old.article_id;
  select to_jsonb(s)-'presentation' into site from public.media_sites s where slug=old.slug;
  if ver is distinct from old.version_before then raise exception 'EXISTING_VERSION_MUTATED';end if;
  if art is distinct from old.article_before then raise exception 'EXISTING_DRAFT_OR_TIMESTAMP_MUTATED';end if;
  if site is distinct from old.site_before then raise exception 'EXISTING_SITE_MUTATED';end if;
  page:=public.media_public_article_page(old.slug,null,1,'','Old category');
  if public.media_public_article_categories(old.slug,'existing',old.version_before->>'revision_hash') <> '["Old category"]'::jsonb or public.media_public_article_categories(old.slug,'existing',repeat('b',64)) is not null then raise exception 'LEGACY_DETAIL_CATEGORY_REVISION_NOT_CHECKED';end if;
  if (page->>'total')::integer<>1 or page->'items'->0->'categories' <> '["Old category"]'::jsonb then raise exception 'LEGACY_CATEGORY_NOT_PROJECTED';end if;
 end loop;
end $$;
