-- Synthetic retention fixtures. The caller must ROLLBACK and verify zero residue.
begin;

do $privileges$
begin
  if has_table_privilege('anon','private.media_deletion_cases','select')
    or has_table_privilege('authenticated','private.media_audit_events','select')
    or has_table_privilege('service_role','private.media_operation_logs','delete')
    or has_function_privilege(
      'authenticated','public.media_ops_request_removal(text,uuid,uuid,text)','execute'
    )
  then raise exception 'MEDIA_RETENTION_UNSAFE_GRANTS'; end if;
  if not has_function_privilege(
    'service_role','public.media_ops_request_removal(text,uuid,uuid,text)','execute'
  ) then raise exception 'MEDIA_RETENTION_SERVICE_RPC_MISSING'; end if;
end
$privileges$;

insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('aa100000-0000-4000-8000-000000000001','retention-owner@example.invalid','{}','{}',now(),now()),
  ('aa100000-0000-4000-8000-000000000002','retention-other@example.invalid','{}','{}',now(),now()),
  ('aa100000-0000-4000-8000-000000000003','retention-final@example.invalid','{}','{}',now(),now()),
  ('aa100000-0000-4000-8000-000000000004','retention-tech@example.invalid','{}','{}',now(),now());
insert into private.media_ops_operators(user_id,operator_name,operator_role) values
  ('aa100000-0000-4000-8000-000000000003','Ayumi fixture','final_decider'),
  ('aa100000-0000-4000-8000-000000000004','Technical fixture','technical');

set local request.jwt.claim.sub='aa100000-0000-4000-8000-000000000001';
set local request.jwt.claim.role='authenticated';
set local request.jwt.claims='{"sub":"aa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}';
set local role authenticated;
select public.media_accept_terms(
  'media-free-terms-2026-09-09-v1',
  'bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5',true
);
select set_config('test.media_site',public.media_create_site(
  'Retention Media','retention-media','','Owner','ja-JP'
)::text,true);
reset role;

set local request.jwt.claim.sub='aa100000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"aa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}';
set local role authenticated;
select public.media_accept_terms(
  'media-free-terms-2026-09-09-v1',
  'bf760ca718f97c701a3f835bc11d3c9c87df4abfc0b5cf1220a670feb03dfca5',true
);
select set_config('test.other_site',public.media_create_site(
  'Other Media','retention-other','','Other','ja-JP'
)::text,true);
reset role;

insert into public.media_articles(id,site_id,title,slug,draft_blocks) values
  ('aa100000-0000-4000-8000-000000000101',current_setting('test.media_site')::uuid,'First','first',
    '[{"id":"p1","type":"paragraph","text":"first"}]'::jsonb),
  ('aa100000-0000-4000-8000-000000000102',current_setting('test.media_site')::uuid,'Shared','shared',
    '[{"id":"p1","type":"paragraph","text":"shared"}]'::jsonb),
  ('aa100000-0000-4000-8000-000000000201',current_setting('test.other_site')::uuid,'Other','other',
    '[{"id":"p1","type":"paragraph","text":"other"}]'::jsonb);
insert into storage.objects(bucket_id,name,metadata) values(
  'mikke-media-private',
  'aa100000-0000-4000-8000-000000000001/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp',
  '{"size":10,"mimetype":"image/webp"}'
);
set local request.jwt.claims='{"role":"service_role"}';
set local request.jwt.claim.sub='';
set local role service_role;
select set_config('test.shared_asset',(
  public.media_register_private_image(
    'aa100000-0000-4000-8000-000000000001',
    'aa100000-0000-4000-8000-000000000001/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp',
    10,repeat('a',64),'shared.webp'
  )->>'assetId'
),true);
reset role;

do $image_site$
begin
  if not exists(select 1 from private.media_private_images
    where asset_id=current_setting('test.shared_asset')::uuid
      and site_id=current_setting('test.media_site')::uuid)
  then raise exception 'MEDIA_PRIVATE_IMAGE_SITE_NOT_BOUND'; end if;
end
$image_site$;

update public.media_articles set
  cover_image_asset_id=current_setting('test.shared_asset')::uuid,
  cover_image_url='/api/media/assets/'||current_setting('test.shared_asset'),
  draft_blocks=jsonb_build_array(jsonb_build_object(
    'id','img','type','image','imageAssetId',current_setting('test.shared_asset'),
    'imageUrl','/api/media/assets/'||current_setting('test.shared_asset'),'alt','Shared image'
  ))
where id in ('aa100000-0000-4000-8000-000000000101','aa100000-0000-4000-8000-000000000102');

set local request.jwt.claim.sub='aa100000-0000-4000-8000-000000000001';
set local request.jwt.claim.role='authenticated';
set local request.jwt.claims='{"sub":"aa100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}';
set local role authenticated;
select set_config('test.review_first',(public.media_review_article(
  'aa100000-0000-4000-8000-000000000101'
)->>'expectedRevision'),true);
select public.media_publish_article_reviewed(
  'aa100000-0000-4000-8000-000000000101',current_setting('test.review_first'),
  'media-free-terms-2026-09-09-v1',true,true,true
);
select set_config('test.review_shared',(public.media_review_article(
  'aa100000-0000-4000-8000-000000000102'
)->>'expectedRevision'),true);
select public.media_publish_article_reviewed(
  'aa100000-0000-4000-8000-000000000102',current_setting('test.review_shared'),
  'media-free-terms-2026-09-09-v1',true,true,true
);
reset role;

set local request.jwt.claim.sub='aa100000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"aa100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}';
set local role authenticated;
select set_config('test.review_other',(public.media_review_article(
  'aa100000-0000-4000-8000-000000000201'
)->>'expectedRevision'),true);
select public.media_publish_article_reviewed(
  'aa100000-0000-4000-8000-000000000201',current_setting('test.review_other'),
  'media-free-terms-2026-09-09-v1',true,true,true
);
reset role;

set local request.jwt.claims='{"role":"service_role"}';
set local request.jwt.claim.sub='';
set local role service_role;
select set_config('test.restore_case',public.media_ops_request_removal(
  'article','aa100000-0000-4000-8000-000000000201',
  'aa100000-0000-4000-8000-000000000004','verified-email:restore'
)::text,true);
select public.media_ops_restore_removal(
  current_setting('test.restore_case')::uuid,
  'aa100000-0000-4000-8000-000000000004','owner requested restoration'
);
reset role;
do $restored$
begin
  if not exists(select 1 from public.media_articles
    where id='aa100000-0000-4000-8000-000000000201'
      and deleted_at is null and status='unpublished' and current_published_version_id is null)
    or exists(select 1 from public.media_public_article('retention-other','ja-JP','other'))
    or not exists(select 1 from private.media_deletion_cases
      where id=current_setting('test.restore_case')::uuid and status='restored')
  then raise exception 'MEDIA_REMOVAL_RESTORE_FAILED'; end if;
end
$restored$;

set local role service_role;
select set_config('test.expired_restore_case',public.media_ops_request_removal(
  'article','aa100000-0000-4000-8000-000000000201',
  'aa100000-0000-4000-8000-000000000004','verified-email:expired'
)::text,true);
reset role;
update private.media_deletion_cases
set requested_at=x.requested_at,
  recoverable_until=x.requested_at+interval '30 days',
  purge_due_at=x.requested_at+interval '30 days'
from (select clock_timestamp()-interval '31 days' requested_at) x
where id=current_setting('test.expired_restore_case')::uuid;
set local role service_role;
do $expired_restore$
begin
  begin
    perform public.media_ops_restore_removal(
      current_setting('test.expired_restore_case')::uuid,
      'aa100000-0000-4000-8000-000000000004','too late'
    );
    raise exception 'MEDIA_EXPIRED_RESTORE_ALLOWED';
  exception when others then
    if sqlerrm<>'MEDIA_REMOVAL_RECOVERY_EXPIRED' then raise; end if;
  end;
end
$expired_restore$;
reset role;

do $immutable$
begin
  begin
    delete from public.media_article_versions
      where article_id='aa100000-0000-4000-8000-000000000101';
    raise exception 'MEDIA_VERSION_DELETE_BYPASSED';
  exception when others then
    if sqlerrm<>'MEDIA_PUBLISHED_VERSION_IMMUTABLE' then raise; end if;
  end;
end
$immutable$;

set local request.jwt.claims='{"role":"service_role"}';
set local request.jwt.claim.sub='';
set local role service_role;
select set_config('test.first_case',public.media_ops_request_removal(
  'article','aa100000-0000-4000-8000-000000000101',
  'aa100000-0000-4000-8000-000000000004','verified-email:first'
)::text,true);
do $early$
begin
  begin
    perform public.media_ops_prepare_purge(
      current_setting('test.first_case')::uuid,'aa100000-0000-4000-8000-000000000004'
    );
    raise exception 'MEDIA_EARLY_PURGE_ALLOWED';
  exception when others then
    if sqlerrm<>'MEDIA_PURGE_NOT_DUE' then raise; end if;
  end;
end
$early$;
reset role;

do $hidden$
begin
  if exists(select 1 from public.media_public_article('retention-media','ja-JP','first'))
    then raise exception 'MEDIA_REMOVED_ARTICLE_PUBLIC'; end if;
  if not exists(select 1 from public.media_articles
    where id='aa100000-0000-4000-8000-000000000101' and deleted_at is not null
      and status='unpublished' and current_published_version_id is null)
    then raise exception 'MEDIA_RECOVERABLE_ARTICLE_MISSING'; end if;
end
$hidden$;

update private.media_deletion_cases
set requested_at=x.requested_at,
  recoverable_until=x.requested_at+interval '30 days',
  purge_due_at=x.requested_at+interval '30 days'
from (select clock_timestamp()-interval '31 days' requested_at) x
where id=current_setting('test.first_case')::uuid;
set local role service_role;
select set_config('test.first_manifest',public.media_ops_prepare_purge(
  current_setting('test.first_case')::uuid,'aa100000-0000-4000-8000-000000000004'
)::text,true);
do $shared_manifest$
begin
  if jsonb_array_length(current_setting('test.first_manifest')::jsonb)<>0
    then raise exception 'MEDIA_SHARED_ASSET_ENTERED_PURGE'; end if;
end
$shared_manifest$;
select public.media_ops_complete_purge(
  current_setting('test.first_case')::uuid,'aa100000-0000-4000-8000-000000000004',repeat('e',64)
);
reset role;

do $article_purged$
begin
  if exists(select 1 from public.media_articles where id='aa100000-0000-4000-8000-000000000101')
    or exists(select 1 from public.media_article_versions where article_id='aa100000-0000-4000-8000-000000000101')
    then raise exception 'MEDIA_ARTICLE_PURGE_RESIDUE'; end if;
  if not exists(select 1 from private.media_private_images where asset_id=current_setting('test.shared_asset')::uuid)
    then raise exception 'MEDIA_SHARED_ASSET_PURGED'; end if;
  if not exists(select 1 from private.media_audit_events
    where deletion_case_id=current_setting('test.first_case')::uuid and event_type='content_purged'
      and retain_until=retention_anchor_at+interval '3 years')
    then raise exception 'MEDIA_PURGE_AUDIT_MISSING'; end if;
end
$article_purged$;

set local role service_role;
select set_config('test.report',public.media_ops_open_report(
  '/media/retention-media/shared','privacy','mailbox:report',
  'aa100000-0000-4000-8000-000000000004'
)::text,true);
select set_config('test.hold',public.media_ops_apply_hold(
  current_setting('test.report')::uuid,'article','aa100000-0000-4000-8000-000000000102',
  'privacy','Fixture hold','mailbox:report','aa100000-0000-4000-8000-000000000004'
)::text,true);
do $technical_release$
begin
  begin
    perform public.media_ops_review_hold(
      current_setting('test.hold')::uuid,'release','wrong actor',
      'aa100000-0000-4000-8000-000000000004'
    );
    raise exception 'MEDIA_TECHNICAL_RELEASE_ALLOWED';
  exception when others then
    if sqlerrm<>'MEDIA_FINAL_DECIDER_REQUIRED' then raise; end if;
  end;
end
$technical_release$;
select public.media_ops_review_hold(
  current_setting('test.hold')::uuid,'release','review complete',
  'aa100000-0000-4000-8000-000000000003'
);
select public.media_ops_close_report(
  current_setting('test.report')::uuid,'removed','removed',
  'aa100000-0000-4000-8000-000000000003'
);
reset role;

do $hold_release$
begin
  if exists(select 1 from public.media_public_article('retention-media','ja-JP','shared'))
    then raise exception 'MEDIA_HOLD_RELEASE_AUTO_PUBLISHED'; end if;
  if not exists(select 1 from private.media_report_cases
    where id=current_setting('test.report')::uuid
      and final_decider='aa100000-0000-4000-8000-000000000003'
      and retain_until=closed_at+interval '3 years')
    then raise exception 'MEDIA_REPORT_RETENTION_MISSING'; end if;
end
$hold_release$;

set local role service_role;
select public.media_ops_write_log(
  'access','aa100000-0000-4000-8000-000000000001','/media/retention-media',
  'read','ok','192.0.2.10','fixture-agent','{}'::jsonb
);
reset role;
insert into private.media_operation_logs(log_kind,action,result,occurred_at,expires_at)
select 'error','expired','error',x.occurred_at,x.occurred_at+interval '90 days'
from (select clock_timestamp()-interval '91 days' occurred_at) x;
set local role service_role;
do $log_purge$
declare n integer;
begin
  n:=public.media_ops_purge_expired_logs(
    'aa100000-0000-4000-8000-000000000004',repeat('d',64)
  );
  if n<>1 then raise exception 'MEDIA_LOG_PURGE_BOUNDARY_FAILED'; end if;
end
$log_purge$;
reset role;
do $log_future$
begin
  if (select count(*) from private.media_operation_logs)<>1
    or exists(select 1 from private.media_operation_logs where expires_at<=clock_timestamp())
    then raise exception 'MEDIA_LOG_RETENTION_FAILED'; end if;
end
$log_future$;

set local role service_role;
select set_config('test.site_case',public.media_ops_request_removal(
  'site',current_setting('test.media_site')::uuid,
  'aa100000-0000-4000-8000-000000000004','verified-email:site'
)::text,true);
reset role;
update private.media_deletion_cases
set requested_at=x.requested_at,
  recoverable_until=x.requested_at+interval '30 days',
  purge_due_at=x.requested_at+interval '30 days'
from (select clock_timestamp()-interval '31 days' requested_at) x
where id=current_setting('test.site_case')::uuid;
set local role service_role;
select set_config('test.site_manifest',public.media_ops_prepare_purge(
  current_setting('test.site_case')::uuid,'aa100000-0000-4000-8000-000000000004'
)::text,true);
do $storage_guard$
begin
  if jsonb_array_length(current_setting('test.site_manifest')::jsonb)<>1
    then raise exception 'MEDIA_SITE_MANIFEST_INCOMPLETE'; end if;
  begin
    perform public.media_ops_complete_purge(
      current_setting('test.site_case')::uuid,
      'aa100000-0000-4000-8000-000000000004',repeat('c',64)
    );
    raise exception 'MEDIA_DB_PURGED_BEFORE_STORAGE';
  exception when others then
    if sqlerrm<>'MEDIA_PURGE_STORAGE_REMAINS' then raise; end if;
  end;
end
$storage_guard$;
reset role;
delete from storage.objects where bucket_id='mikke-media-private'
  and name='aa100000-0000-4000-8000-000000000001/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
set local role service_role;
select public.media_ops_complete_purge(
  current_setting('test.site_case')::uuid,'aa100000-0000-4000-8000-000000000004',repeat('c',64)
);
reset role;

do $isolation$
begin
  if exists(select 1 from public.media_sites where id=current_setting('test.media_site')::uuid)
    or exists(select 1 from public.media_articles where site_id=current_setting('test.media_site')::uuid)
    or exists(select 1 from private.media_private_images where site_id=current_setting('test.media_site')::uuid)
    then raise exception 'MEDIA_SITE_PURGE_RESIDUE'; end if;
  if not exists(select 1 from public.media_sites where id=current_setting('test.other_site')::uuid)
    or not exists(select 1 from public.media_articles where id='aa100000-0000-4000-8000-000000000201')
    then raise exception 'MEDIA_SITE_PURGE_CROSSED_OWNER'; end if;
  if not exists(select 1 from private.media_audit_events
    where owner_id='aa100000-0000-4000-8000-000000000001' and retain_until is not null)
    then raise exception 'MEDIA_SITE_AUDIT_MISSING'; end if;
end
$isolation$;

set local role service_role;
do $audit_boundary$
declare n integer;
begin
  n:=public.media_ops_purge_expired_audit(
    'aa100000-0000-4000-8000-000000000003',repeat('b',64)
  );
  if n<>0 then raise exception 'MEDIA_FUTURE_AUDIT_PURGED'; end if;
end
$audit_boundary$;
reset role;

select 'media_free_retention_operations_test_ok';
rollback;
