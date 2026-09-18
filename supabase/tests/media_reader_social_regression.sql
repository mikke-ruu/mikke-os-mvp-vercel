-- Run after the migration in a disposable transaction. No customer content is read or altered.
begin;
insert into auth.users(id) values('91000000-0000-0000-0000-000000000001'),('91000000-0000-0000-0000-000000000002'),('91000000-0000-0000-0000-000000000003');
insert into public.media_sites(id,owner_id,name,slug,author_name,is_published) values('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Social test','media-social-regression-test','Test',true);
insert into public.media_articles(id,site_id,title,slug,status) values('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','Test','test','published');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare terms jsonb; reviewed jsonb; begin
 terms:=public.media_current_terms();
 if terms is null then raise exception 'social fixture requires legal activation';end if;
 perform public.media_accept_terms(terms->>'termsVersion',terms->>'documentSha256',true);
 reviewed:=public.media_review_article('93000000-0000-0000-0000-000000000001');
 perform public.media_publish_article_reviewed('93000000-0000-0000-0000-000000000001',reviewed->>'expectedRevision',terms->>'termsVersion',true,true,true);
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select public.media_reader_home('profile','{"name":"Reader A","icon":"🌱","avatar":"","bio":"Private bio","destination":"none"}');
select public.media_social_action('media-social-regression-test','test','saved','{"value":true}');
select public.media_social_action('media-social-regression-test','test','favorite','{"value":true}');
select public.media_social_action('media-social-regression-test','test','follow','{"value":true}');
select public.media_social_action('media-social-regression-test','test','comment','{"body":"Pending reader comment"}');
do $$declare b jsonb; begin
 b:=public.media_social_read('media-social-regression-test','test');
 if jsonb_array_length(b->'comments')<>1 or b->'comments'->0->>'status'<>'pending' then raise exception 'own pending is missing'; end if;
 if b->'comments'->0->'author'->>'bio'<>'' then raise exception 'private bio leaked'; end if;
 if jsonb_array_length(public.media_reader_home()->'articles')<>2 then raise exception 'marks did not round trip'; end if;
 begin perform public.media_owner_analytics('92000000-0000-0000-0000-000000000001');raise exception 'nonowner analytics allowed';exception when insufficient_privilege then null;end;
 begin perform public.media_social_action('media-social-regression-test','test','mode','{"mode":"open"}');raise exception 'nonowner mode allowed';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.media_reader_comments;raise exception 'direct table access allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 perform public.media_social_action('media-social-regression-test','test','comment','{"body":"Pending deleted before approval"}');
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending deleted before approval';
 perform public.media_social_action('media-social-regression-test','test','delete',jsonb_build_object('id',cid));
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.media_social_read('media-social-regression-test','test')->'comments')<>0 then raise exception 'other pending leaked';end if;
 if jsonb_array_length(public.media_reader_home()->'articles')<>0 then raise exception 'other marks leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending reader comment';
 perform public.media_social_action('media-social-regression-test','test','approve',jsonb_build_object('id',cid));
 perform public.media_social_action('media-social-regression-test','test','comment',jsonb_build_object('body','Owner reply','replyTo',cid));
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 if jsonb_array_length(public.media_social_read('media-social-regression-test','test')->'comments')<>2 then raise exception 'public approved thread missing';end if;
 begin perform public.media_reader_home();raise exception 'anon home allowed';exception when insufficient_privilege then null;end;
 begin perform public.media_social_action('media-social-regression-test','test','comment','{"body":"anonymous write"}');raise exception 'anon comment allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.media_reader_home()->'notices')<>1 then raise exception 'reply notification missing';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending reader comment';
 perform public.media_social_action('media-social-regression-test','test','report',jsonb_build_object('id',cid));
 if jsonb_array_length(public.media_reader_home()->'notices')<>0 then raise exception 'other notifications leaked';end if;
end $$;
reset role;
do $$begin
 if not exists(select 1 from private.media_report_cases where opened_by='91000000-0000-0000-0000-000000000003' and evidence_ref like 'media-comment:%') then raise exception 'report not connected to operations';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending reader comment';
 perform public.media_social_action('media-social-regression-test','test','hide',jsonb_build_object('id',cid));
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 if jsonb_array_length(public.media_social_read('media-social-regression-test','test')->'comments')<>0 then raise exception 'hidden parent exposed reply';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$begin
 if jsonb_array_length(public.media_reader_home()->'notices')<>0 then raise exception 'hidden parent exposed notice';end if;
end $$;
reset role;
-- An operations hold survives author deletion and cannot be cleared by the site owner.
insert into private.media_ops_operators(user_id,operator_name,operator_role) values('91000000-0000-0000-0000-000000000001','Synthetic operator','technical');
set local role service_role;
do $$declare case_id uuid; begin
 select (x->>'caseId')::uuid into case_id from jsonb_array_elements(public.media_ops_comment_reports('91000000-0000-0000-0000-000000000001')) x where x->>'body'='Pending reader comment';
 perform public.media_ops_comment_reports('91000000-0000-0000-0000-000000000001',case_id,true);
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending reader comment';
 begin
 perform public.media_social_action('media-social-regression-test','test','approve',jsonb_build_object('id',cid));
 raise exception 'owner bypassed operations hold';
 exception when others then if sqlerrm<>'MEDIA_COMMENT_HELD' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare cid text; begin
 select item->>'id' into cid from jsonb_array_elements(public.media_social_read('media-social-regression-test','test')->'comments') item where item->>'body'='Pending reader comment';
 perform public.media_social_action('media-social-regression-test','test','delete',jsonb_build_object('id',cid));
 if jsonb_array_length(public.media_reader_home()->'notices')<>0 then raise exception 'held deleted root exposed notice';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 if jsonb_array_length(public.media_social_read('media-social-regression-test','test')->'comments')<>0 then raise exception 'held deleted root exposed replies';end if;
 if has_function_privilege('anon','public.media_record_read(text,text,uuid,text,text)','execute') or has_function_privilege('authenticated','public.media_record_read(text,text,uuid,text,text)','execute') then raise exception 'direct analytics ingestion allowed';end if;
end $$;
reset role;
set local role service_role;
do $$begin
 for i in 1..120 loop
 if not public.media_record_read('media-social-regression-test','test',gen_random_uuid(),'read',repeat('b',64)) then raise exception 'measurement below limit rejected';end if;
 end loop;
 if public.media_record_read('media-social-regression-test','test',gen_random_uuid(),'read',repeat('b',64)) then raise exception 'measurement rate limit bypassed';end if;
end $$;
reset role;
update public.media_articles set status='unpublished' where id='93000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$begin
 if public.media_social_read('media-social-regression-test','test') is not null then raise exception 'unpublished social exposed';end if;
 if jsonb_array_length(public.media_reader_home()->'articles')<>0 then raise exception 'unpublished saved content exposed';end if;
end $$;
reset role;
rollback;
