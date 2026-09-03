-- Re-contract safe retention workers. Common subscription/entitlement rows are
-- locked before the app parent and the access window is rechecked immediately
-- before any anonymization mutation.

alter function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)
  rename to platform_billing_subscription_event_apply_unlocked_legacy;

create function public.platform_billing_subscription_event_apply(p_provider_subscription_id text,p_provider_event_id text,p_provider_event_hash text,p_event_kind text,p_projected_status text,p_period_start timestamptz,p_period_end timestamptz,p_cancel_at_period_end boolean,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_scope uuid; v_count int;
begin
 if session_user<>'service_role' and coalesce(current_setting('role',true),'')<>'service_role' then raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN'; end if;
 select count(*),(array_agg(a.scope_id order by a.scope_id))[1] into v_count,v_scope from platform_billing_private.subscriptions s join platform_billing_private.attempts a on a.id=s.source_attempt_id where s.provider_subscription_id=p_provider_subscription_id;
 if v_count<>1 then raise exception using errcode='23505',message='PLATFORM_BILLING_SUBSCRIPTION_SCOPE_AMBIGUOUS'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope for update;
 if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
 return public.platform_billing_subscription_event_apply_unlocked_legacy(p_provider_subscription_id,p_provider_event_id,p_provider_event_hash,p_event_kind,p_projected_status,p_period_start,p_period_end,p_cancel_at_period_end,p_occurred_at);
end $$;

revoke all on function public.platform_billing_subscription_event_apply_unlocked_legacy(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;

create or replace function public.community_apply_platform_retention_anonymization(p_community_id uuid,p_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_access record; v_owner uuid; v_scope uuid; v_scope_count int; v_subscription uuid; v_attempt uuid; v_entitlement uuid; v_manifest jsonb;
begin
 if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
 select owner_user_id into v_owner from public.community_communities where id=p_community_id;
 if v_owner is null then raise exception using errcode='22023',message='COMMUNITY_RETENTION_SCOPE_INVALID'; end if;
 select count(*),(array_agg(id order by id))[1] into v_scope_count,v_scope from platform_billing_private.scopes where owner_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id::text;
 if v_scope_count>1 then raise exception using errcode='23505',message='COMMUNITY_RETENTION_SCOPE_AMBIGUOUS'; end if;
 if v_scope_count=1 then
  perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id::text for update;
 else
  select id into v_entitlement from platform_billing_private.creation_entitlements where actor_user_id=v_owner and product_key='community_platform' and source_kind='verified_trial' and status='consumed' and resource_id=p_community_id order by created_at desc,id desc limit 1 for update;
  if v_entitlement is null then raise exception using errcode='55000',message='COMMUNITY_RETENTION_NOT_DUE'; end if;
 end if;
 v_subscription:=platform_billing_private.resource_subscription_select(v_owner,'community_platform',p_community_id,p_at);
 if v_subscription is not null then
  select source_attempt_id into strict v_attempt from platform_billing_private.subscriptions where id=v_subscription for update;
  select id into strict v_entitlement from platform_billing_private.creation_entitlements where source_attempt_id=v_attempt and actor_user_id=v_owner and product_key='community_platform' and status='consumed' and resource_id=p_community_id for update;
 elsif v_scope_count=1 then
  select id into v_entitlement from platform_billing_private.creation_entitlements where actor_user_id=v_owner and product_key='community_platform' and source_kind='verified_trial' and status='consumed' and resource_id=p_community_id order by created_at desc,id desc limit 1 for update;
 end if;
 select owner_user_id into strict v_owner from public.community_communities where id=p_community_id for update;
 select access.* into v_access from community_private.community_platform_access_window(p_community_id,p_at) access;
 if v_access.actor_user_id is distinct from v_owner or v_access.status is distinct from 'ended' or v_access.anonymize_after is null or p_at<v_access.anonymize_after then raise exception using errcode='55000',message='COMMUNITY_RETENTION_NOT_DUE'; end if;
 if exists(select 1 from community_private.platform_retention_anonymizations where community_id=p_community_id) then return false; end if;
 select jsonb_agg(jsonb_build_object('table',target_table,'column',target_column) order by target_table,target_column) into v_manifest from community_private.platform_retention_anonymization_allowlist;
 update public.community_communities set name='終了したCommunity',description=null,logo_url=null,banner_url=null where id=p_community_id;
 update public.community_operator_profiles set business_name='',representative_name='',postal_address='',contact_email='',contact_phone=null,website_url=null,commercial_disclosure_url=null,privacy_policy_url=null,terms_url=null,status='incomplete',verified_at=null where community_id=p_community_id;
 insert into community_private.platform_retention_anonymizations(community_id,anonymized_after,anonymized_at,target_manifest) values(p_community_id,v_access.anonymize_after,p_at,v_manifest);
 return true;
end $$;

revoke all on function public.community_apply_platform_retention_anonymization(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.community_apply_platform_retention_anonymization(uuid,timestamptz) to service_role;

create or replace function private.academy_anonymize_ended_headquarters_at(p_headquarters_id uuid,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_window record; v_scope uuid; v_scope_count int; v_subscription uuid; v_attempt uuid; v_entitlement uuid; v_owner uuid; v_counts jsonb:='{}'::jsonb; v_count integer;
begin
 select owner_user_id into v_owner from public.academy_headquarters where id=p_headquarters_id;
 if v_owner is null then raise exception 'academy_anonymization_scope_invalid'; end if;
 select count(*),(array_agg(id order by id))[1] into v_scope_count,v_scope from platform_billing_private.scopes where owner_user_id=v_owner and product_key='academy_platform' and resource_id=p_headquarters_id::text;
 if v_scope_count<>1 then raise exception 'academy_anonymization_scope_invalid'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=v_owner and product_key='academy_platform' and resource_id=p_headquarters_id::text for update;
 v_subscription:=platform_billing_private.resource_subscription_select(v_owner,'academy_platform',p_headquarters_id,p_at);
 if v_subscription is null then raise exception 'academy_anonymization_not_due'; end if;
 select source_attempt_id into strict v_attempt from platform_billing_private.subscriptions where id=v_subscription for update;
 select id into strict v_entitlement from platform_billing_private.creation_entitlements where source_attempt_id=v_attempt and actor_user_id=v_owner and product_key='academy_platform' and source_kind='verified_paid' and status='consumed' and resource_id=p_headquarters_id for update;
 select owner_user_id into strict v_owner from public.academy_headquarters where id=p_headquarters_id for update;
 select access_window.* into strict v_window from private.academy_paid_access_window(p_headquarters_id,p_at) access_window;
 if v_window.actor_user_id is distinct from v_owner or v_window.status<>'ended' or v_window.anonymize_after is null or p_at<v_window.anonymize_after or v_window.owner_read_until is distinct from v_window.anonymize_after then raise exception 'academy_anonymization_not_due'; end if;
 if exists(select 1 from private.academy_retention_anonymization_runs where headquarters_id=p_headquarters_id) then return jsonb_build_object('status','already_anonymized'); end if;
 perform set_config('app.academy_retention_worker','on',true); perform set_config('app.academy_retention_headquarters',p_headquarters_id::text,true);
 update public.academy_headquarters set is_active=false,contact_email=null,default_payment_note=null,logo_url=null,hero_image_url=null,front_message=null,updated_at=p_at where id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('headquarters',v_count);
 update public.academy_courses set is_published=false,payment_url=null,kit_payment_url=null,main_image_url=null,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('courses',v_count);
 update public.academy_learner_pages set is_published=false,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('learnerPages',v_count);
 update public.academy_materials set is_published=false,url='about:blank#retained-record',updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('materials',v_count);
 update public.academy_classes set meeting_url=null,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('classes',v_count);
 update public.academy_billing_accounts set payment_url=null,is_active=false,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('billingAccounts',v_count);
 update public.academy_applications set applicant_name='匿名化済み',applicant_email=null,applicant_phone=null,applicant_note=null,form_answers='{}'::jsonb,diploma_name_en=null,applicant_shipping_address=null,provider_checkout_id=null,provider_checkout_url=null,provider_payment_id=null,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('applications',v_count);
 update public.academy_instructors set memo=null,business_name=null,area=null,instagram_url=null,self_intro=null,message=null,available_note=null,photo_url=null,payment_method_note=null,payment_url=null,accepts_applications=false,is_listed=false,display_on_story=false,updated_at=p_at where headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('instructors',v_count);
 update public.academy_instructor_addresses address set address_text='匿名化済み' from public.academy_instructors instructor where address.instructor_id=instructor.id and instructor.headquarters_id=p_headquarters_id;
 get diagnostics v_count=row_count; v_counts:=v_counts||jsonb_build_object('instructorAddresses',v_count);
 insert into private.academy_retention_anonymization_runs(headquarters_id,ended_at,anonymize_after,executed_at,affected_rows) values(p_headquarters_id,v_window.anonymize_after-interval '90 days',v_window.anonymize_after,p_at,v_counts);
 return jsonb_build_object('status','anonymized','affectedRows',v_counts);
end $$;

revoke all on function private.academy_anonymize_ended_headquarters_at(uuid,timestamptz) from public,anon,authenticated,service_role;
