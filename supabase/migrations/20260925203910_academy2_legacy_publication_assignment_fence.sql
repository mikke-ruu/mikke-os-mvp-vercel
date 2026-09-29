-- Prevent old publication/payment/assignment side effects for explicit v2 tenants.
-- No tenant activation, contract transition, provider call or historic data update.
-- Existing RPC OIDs and EXECUTE ACLs remain unchanged, including service-only APIs.
do $$ declare item record; definition text; begin
 for item in select * from(values
 ('public.academy_first_publication_setup_reserve(uuid,uuid,uuid)','public.academy_first_publication_setup_reserve','legacy_setup_reserve','uuid,uuid,uuid'),
 ('public.academy_first_publication_setup_complete(uuid,text,text,text)','public.academy_first_publication_setup_complete','legacy_setup_complete','uuid,text,text,text'),
 ('public.academy_activate_paid_access(uuid,uuid,text,timestamp with time zone)','public.academy_activate_paid_access','legacy_activate_paid','uuid,uuid,text,timestamp with time zone'),
 ('public.academy_activate_paid_access_from_platform_subscription(uuid)','public.academy_activate_paid_access_from_platform_subscription','legacy_activate_paid_subscription','uuid'),
 ('public.academy_respond_class_instructor_request(uuid,text,text)','public.academy_respond_class_instructor_request','legacy_respond_class_instructor','uuid,text,text')
 ) f(signature,source_name,backup_name,args) loop
  if to_regprocedure('academy2_access.'||item.backup_name||'('||item.args||')') is not null then raise exception 'academy2_legacy_backup_already_exists';end if;
  select pg_get_functiondef(item.signature::regprocedure) into definition;
  if position('CREATE OR REPLACE FUNCTION '||item.source_name||'(' in definition)=0 then raise exception 'academy2_legacy_signature_mismatch';end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION '||item.source_name||'(','CREATE FUNCTION academy2_access.'||item.backup_name||'(');
  execute 'revoke all on function academy2_access.'||item.backup_name||'('||item.args||') from public,anon,authenticated,service_role';
 end loop;
end $$;

create function academy2_access.require_legacy_operation(p_hq uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 perform 1 from academy2_access.tenants where headquarters_id=p_hq for share;
 if not academy2_access.legacy_allowed(p_hq) then raise exception 'academy2_legacy_operation_disabled' using errcode='42501';end if;
end $$;
revoke all on function academy2_access.require_legacy_operation(uuid) from public,anon,authenticated,service_role;

create or replace function public.academy_first_publication_setup_reserve(p_owner_user_id uuid,p_headquarters_id uuid,p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform academy2_access.require_legacy_operation(p_headquarters_id);
 return academy2_access.legacy_setup_reserve(p_owner_user_id,p_headquarters_id,p_quote_id);
end $$;

create or replace function public.academy_first_publication_setup_complete(p_attempt_id uuid,p_provider_customer_id text,p_setup_intent_id text,p_payment_method_id text)
returns jsonb language plpgsql security definer set search_path='' as $$declare hq uuid;begin
 select headquarters_id into hq from academy_publication_private.setup_attempts where attempt_id=p_attempt_id;
 perform academy2_access.require_legacy_operation(hq);
 return academy2_access.legacy_setup_complete(p_attempt_id,p_provider_customer_id,p_setup_intent_id,p_payment_method_id);
end $$;

create or replace function public.academy_activate_paid_access(p_headquarters_id uuid,p_owner_user_id uuid,p_contract_reference text,p_activated_at timestamptz default now())
returns table(headquarters_id uuid,access_kind text,status text,paid_started_at timestamptz)
language plpgsql security definer set search_path='' as $$begin
 perform academy2_access.require_legacy_operation(p_headquarters_id);
 return query select * from academy2_access.legacy_activate_paid(p_headquarters_id,p_owner_user_id,p_contract_reference,p_activated_at);
end $$;

create or replace function public.academy_activate_paid_access_from_platform_subscription(p_headquarters_id uuid)
returns table(headquarters_id uuid,access_kind text,status text,paid_started_at timestamptz)
language plpgsql security definer set search_path='' as $$begin
 -- Must run before platform_billing_academy_existing_paid_consume.
 perform academy2_access.require_legacy_operation(p_headquarters_id);
 return query select * from academy2_access.legacy_activate_paid_subscription(p_headquarters_id);
end $$;

create or replace function public.academy_respond_class_instructor_request(p_request_id uuid,p_status text,p_response_note text default null)
returns public.academy_class_instructor_requests language plpgsql security definer set search_path='' as $$declare hq uuid;begin
 select headquarters_id into hq from public.academy_class_instructor_requests where id=p_request_id;
 perform academy2_access.require_legacy_operation(hq);
 return academy2_access.legacy_respond_class_instructor(p_request_id,p_status,p_response_note);
end $$;
