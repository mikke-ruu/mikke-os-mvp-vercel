create table platform_billing_private.internal_resource_grants(
 id uuid primary key default gen_random_uuid(), actor_user_id uuid not null references auth.users(id),
 product_key text not null check(product_key='community_platform'), resource_id uuid not null,
 purpose text not null check(purpose in ('official_operations','test_only')), reason text not null check(length(btrim(reason)) between 1 and 160),
 granted_by uuid not null references auth.users(id), evidence text not null check(length(btrim(evidence)) between 1 and 240),
 starts_at timestamptz not null, expires_at timestamptz, revoked_at timestamptz, revoked_by uuid references auth.users(id), revoked_reason text,
 created_at timestamptz not null default clock_timestamp(),
 unique(product_key,resource_id), check(expires_at is null or expires_at>starts_at),
 check((revoked_at is null and revoked_by is null and revoked_reason is null) or (revoked_at is not null and revoked_by is not null and length(btrim(revoked_reason)) between 1 and 160))
);
alter table platform_billing_private.internal_resource_grants enable row level security;
revoke all on platform_billing_private.internal_resource_grants from public,anon,authenticated,service_role;

create function platform_billing_private.internal_resource_grant_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or old.actor_user_id is distinct from new.actor_user_id or old.product_key is distinct from new.product_key or old.resource_id is distinct from new.resource_id or old.purpose is distinct from new.purpose or old.reason is distinct from new.reason or old.granted_by is distinct from new.granted_by or old.evidence is distinct from new.evidence or old.starts_at is distinct from new.starts_at or old.expires_at is distinct from new.expires_at or old.created_at is distinct from new.created_at or old.revoked_at is not null or new.revoked_at is null then raise exception using errcode='42501',message='PLATFORM_BILLING_INTERNAL_GRANT_IMMUTABLE'; end if;
 return new;
end $$;
create trigger platform_billing_internal_resource_grant_guard before update or delete on platform_billing_private.internal_resource_grants for each row execute function platform_billing_private.internal_resource_grant_guard();
revoke all on function platform_billing_private.internal_resource_grant_guard() from public,anon,authenticated,service_role;

-- Freeze the preflight and migration to the three explicitly approved rows.
do $seed$
declare n int; v_now timestamptz:=clock_timestamp();
begin
 select count(*) into n from public.community_communities c join auth.users u on u.id=c.owner_user_id
 where c.slug in ('official-academy-community','mikkeos','ayumitest') and btrim(c.name)<>'' and coalesce(u.is_anonymous,false)=false;
 if n<>3 or (select count(*) from public.community_communities where slug in ('official-academy-community','mikkeos','ayumitest'))<>3 then raise exception using errcode='55000',message='PLATFORM_BILLING_INTERNAL_GRANT_PREFLIGHT'; end if;
 if exists(select 1 from public.community_communities c join platform_billing_private.creation_entitlements e on e.resource_id=c.id where c.slug in ('official-academy-community','mikkeos','ayumitest') and e.product_key='community_platform' and e.source_kind in ('verified_paid','verified_trial')) then raise exception using errcode='55000',message='PLATFORM_BILLING_INTERNAL_GRANT_HAS_CUSTOMER_BINDING'; end if;
 insert into platform_billing_private.internal_resource_grants(actor_user_id,product_key,resource_id,purpose,reason,granted_by,evidence,starts_at,expires_at)
 select c.owner_user_id,'community_platform',c.id,case when c.slug='ayumitest' then 'test_only' else 'official_operations' end,
 case when c.slug='ayumitest' then 'Approved 30-day internal test Community' else 'Approved OJAS official operations Community' end,
 c.owner_user_id,'Ayumi approval 2026-09-03',v_now,case when c.slug='ayumitest' then v_now+interval '30 days' end
 from public.community_communities c where c.slug in ('official-academy-community','mikkeos','ayumitest');
end $seed$;

alter function platform_billing_private.resource_access_window(text,uuid,timestamptz) rename to resource_access_window_customer_legacy;
create function platform_billing_private.resource_access_window(p_product_key text,p_resource_id uuid,p_at timestamptz)
returns table(actor_user_id uuid,status text,current_period_start timestamptz,current_period_end timestamptz,write_allowed boolean,owner_read_until timestamptz,anonymize_after timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v record; g platform_billing_private.internal_resource_grants%rowtype;
begin
 select * into v from platform_billing_private.resource_access_window_customer_legacy(p_product_key,p_resource_id,p_at);
 if found and v.status in ('active','past_due') then return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,v.write_allowed,v.owner_read_until,v.anonymize_after; return; end if;
 if p_product_key='community_platform' then
  select * into g from platform_billing_private.internal_resource_grants where product_key=p_product_key and resource_id=p_resource_id;
  if found and g.revoked_at is null then
   if g.starts_at<=p_at and (g.expires_at is null or g.expires_at>p_at) then return query select g.actor_user_id,'internal_grant'::text,g.starts_at,g.expires_at,true,null::timestamptz,null::timestamptz; return;
   elsif g.expires_at is not null and g.expires_at<=p_at then return query select g.actor_user_id,'ended'::text,g.starts_at,g.expires_at,false,g.expires_at+interval '90 days',g.expires_at+interval '90 days'; return; end if;
  end if;
 end if;
 if v.actor_user_id is not null then return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,v.write_allowed,v.owner_read_until,v.anonymize_after; end if;
end $$;
revoke all on function platform_billing_private.resource_access_window_customer_legacy(text,uuid,timestamptz),platform_billing_private.resource_access_window(text,uuid,timestamptz) from public,anon,authenticated,service_role;

create function public.platform_billing_internal_grant_revoke(p_resource_id uuid,p_revoked_by uuid,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if session_user not in ('postgres','service_role') and coalesce(current_setting('role',true),'')<>'service_role' then raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN'; end if;
 if p_resource_id is null or p_revoked_by is null or length(btrim(coalesce(p_reason,''))) not between 1 and 160 or not exists(select 1 from auth.users where id=p_revoked_by and coalesce(is_anonymous,false)=false) then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_INPUT'; end if;
 update platform_billing_private.internal_resource_grants set revoked_at=clock_timestamp(),revoked_by=p_revoked_by,revoked_reason=btrim(p_reason) where product_key='community_platform' and resource_id=p_resource_id and revoked_at is null;
 return found;
end $$;
revoke all on function public.platform_billing_internal_grant_revoke(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_billing_internal_grant_revoke(uuid,uuid,text) to service_role;

create or replace function public.community_apply_platform_retention_anonymization(p_community_id uuid,p_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_access record; v_owner uuid; v_scope uuid; v_scope_count int; v_subscription uuid; v_attempt uuid; v_entitlement uuid; v_grant uuid; v_manifest jsonb;
begin
 if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception using errcode='42501',message='Service role required'; end if;
 select owner_user_id into v_owner from public.community_communities where id=p_community_id;
 if v_owner is null then raise exception using errcode='22023',message='COMMUNITY_RETENTION_SCOPE_INVALID'; end if;
 select count(*),(array_agg(id order by id))[1] into v_scope_count,v_scope from platform_billing_private.scopes where owner_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id::text;
 if v_scope_count>1 then raise exception using errcode='23505',message='COMMUNITY_RETENTION_SCOPE_AMBIGUOUS'; end if;
 if v_scope_count=1 then
  perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id::text for update;
  v_subscription:=platform_billing_private.resource_subscription_select(v_owner,'community_platform',p_community_id,p_at);
  if v_subscription is not null then
   select source_attempt_id into strict v_attempt from platform_billing_private.subscriptions where id=v_subscription for update;
   select id into strict v_entitlement from platform_billing_private.creation_entitlements where source_attempt_id=v_attempt and actor_user_id=v_owner and product_key='community_platform' and status='consumed' and resource_id=p_community_id for update;
  end if;
 else
  if exists(select 1 from platform_billing_private.creation_entitlements where actor_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id and source_kind in ('verified_paid','verified_trial')) then raise exception using errcode='55000',message='COMMUNITY_RETENTION_NOT_DUE'; end if;
  select id into strict v_grant from platform_billing_private.internal_resource_grants where actor_user_id=v_owner and product_key='community_platform' and resource_id=p_community_id and revoked_at is null for update;
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
