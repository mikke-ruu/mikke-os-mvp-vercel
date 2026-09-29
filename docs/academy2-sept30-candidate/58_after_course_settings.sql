-- Production candidate; review and isolated validation required before approval.
-- Owned local candidate only. No production execution, existing-data rewrite or charge.
-- A verified provider connection is not consent to the Academy card-payment contract.
create table if not exists academy2_access.after_course_card_contracts (
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 accepted_by uuid not null references auth.users(id), terms_version text not null,
 accepted_at timestamptz not null, valid_until timestamptz not null,
 evidence_reference text not null, check(length(btrim(terms_version)) between 1 and 100),
 check(length(btrim(evidence_reference)) between 1 and 500),
 check(isfinite(accepted_at) and isfinite(valid_until) and valid_until>accepted_at)
);
alter table academy2_access.after_course_card_contracts enable row level security;
revoke all on academy2_access.after_course_card_contracts from public,anon,authenticated,service_role;
-- Contract provisioning belongs to the verified contract service; no client write RPC.
create or replace function academy2_access.after_course_card_contracted(p_hq uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy2_access.after_course_card_contracts c join public.academy_headquarters h on h.id=c.headquarters_id
 where c.headquarters_id=p_hq and c.accepted_by=h.owner_user_id and c.accepted_at<=now() and c.valid_until>now())
$$;
create or replace function academy2_access.after_course_capabilities(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return jsonb_build_object('card_contract',case when academy2_access.after_course_card_contracted(p_hq) then 'active' else 'unverified' end,'card_ready',academy2_access.payment_provider_ready(p_hq),'local_review',exists(select 1 from academy2_access.payment_provider_connections where headquarters_id=p_hq and provider='local_simulator'));
end$$;
create or replace function public.academy2_after_course_capabilities(p_hq uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.after_course_capabilities(p_hq)$$;
revoke all on function academy2_access.after_course_card_contracted(uuid),academy2_access.after_course_capabilities(uuid),public.academy2_after_course_capabilities(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.after_course_capabilities(uuid),public.academy2_after_course_capabilities(uuid) to authenticated;
create or replace function academy2_access.validate_after_course_expiry(v jsonb,p_fixed boolean) returns void language plpgsql immutable set search_path='' as $$begin
 if v is null or jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'kind','') not in('none','months','years','date') or (v->>'kind'='date' and not p_fixed) then raise exception 'academy2_invalid_after_expiry' using errcode='22023';end if;
 if v->>'kind' in('months','years') and v->'count' is not null and v->'count'<>'null' then
 if jsonb_typeof(v->'count')<>'number' or (v->>'count')::numeric not between 1 and 1200 or trunc((v->>'count')::numeric)<>(v->>'count')::numeric then raise exception 'academy2_invalid_after_expiry' using errcode='22023';end if;end if;
 if v->>'kind'='date' and coalesce(v->>'date','')<>'' then begin
 if to_char((v->>'date')::date,'YYYY-MM-DD')<>v->>'date' then raise exception 'academy2_invalid_after_expiry' using errcode='22023';end if;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'academy2_invalid_after_expiry' using errcode='22023';end;end if;
end$$;
create or replace function academy2_access.validate_after_course_settings(p_hq uuid,p_configuration jsonb,p_existing jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare a jsonb:=p_configuration->'after';v jsonb;oldv jsonb;key text;begin
 if a ? 'qualification' then
 v:=a->'qualification';if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'name') is distinct from 'string' or length(v->>'name')>200 then raise exception 'academy2_invalid_qualification' using errcode='22023';end if;
 perform academy2_access.validate_after_course_expiry(v->'expiry',true);
 end if;
 if a ? 'instructor_policy' then perform academy2_access.validate_after_course_expiry(a#>'{instructor_policy,expiry}',false);end if;
 foreach key in array array['qualification','instructor_policy'] loop
 v:=a#>array[key,'renewal'];if v is null then continue;end if;
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'enabled') is distinct from 'boolean' or jsonb_typeof(v->'conditions') is distinct from 'array' or octet_length(v::text)>6000 then raise exception 'academy2_invalid_after_renewal' using errcode='22023';end if;
 end loop;
 if a ? 'manual' and (jsonb_typeof(a#>'{manual,blocks}') is distinct from 'array' or jsonb_array_length(a#>'{manual,blocks}')>400 or exists(select 1 from jsonb_array_elements(a#>'{manual,blocks}') b where jsonb_typeof(b) is distinct from 'object' or coalesce(b->>'type','') not in('heading','text','image','video','links','image-text','gallery','cta','materials-list'))) then raise exception 'academy2_invalid_manual' using errcode='22023';end if;
 if a ? 'completion_timing' and coalesce(a->>'completion_timing','') not in('period_end','lesson_complete','hq_review') then raise exception 'academy2_invalid_after_timing' using errcode='22023';end if;
 foreach key in array array['registration_fee','dues','opening_license'] loop
 v:=case when key='registration_fee' then a->key else p_configuration->key end;
 oldv:=case when key='registration_fee' then p_existing#>array['after',key] else p_existing->key end;
 -- Leave unchanged legacy fee settings intact; never silently convert them or grant rights.
 if v is null or v is not distinct from oldv then continue;end if;
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'enabled') is distinct from 'boolean' then raise exception 'academy2_invalid_instructor_fee' using errcode='22023';end if;
 if v->>'enabled'='true' then
 if not academy2_access.after_course_card_contracted(p_hq) or not academy2_access.payment_provider_ready(p_hq) then raise exception 'academy2_card_contract_required' using errcode='42501';end if;
 if (key='registration_fee' or coalesce(oldv->>'enabled','false')<>'true') and v->>'payment_method' is distinct from 'academy_card' then raise exception 'academy2_registration_fee_card_only' using errcode='22023';end if;
 if v->>'payment_method' is not null and v->>'payment_method'<>'academy_card' then raise exception 'academy2_instructor_fee_card_only' using errcode='22023';end if;
 if v->'amount' is not null and v->'amount'<>'null' then
 if jsonb_typeof(v->'amount')<>'number' or (v->>'amount')::numeric not between 1 and 99999999 or trunc((v->>'amount')::numeric)<>(v->>'amount')::numeric then raise exception 'academy2_invalid_instructor_fee' using errcode='22023';end if;end if;
 end if;
 end loop;
end$$;
revoke all on function academy2_access.validate_after_course_expiry(jsonb,boolean),academy2_access.validate_after_course_settings(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
-- Patch, do not replace the current save function's version/ownership/form/price guards.
do $patch$ declare definition text;marker text:='conf:=p_configuration; kind:=conf->>''kind'';';begin
 definition:=pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure);
 if position('validate_after_course_settings' in definition)=0 then
 if position(marker in definition)=0 then raise exception 'academy2_after_save_contract_changed';end if;
 execute replace(definition,marker,'perform academy2_access.validate_after_course_settings(p_hq,p_configuration,(select configuration from academy2_access.sales_plan_drafts where id=p_id and headquarters_id=p_hq));'||chr(10)||marker);
 end if;
end $patch$;
-- No readiness hold is removed. Configurations with unsupported downstream flows remain blocked.
notify pgrst,'reload schema';

-- Keep administrator preview and public intake on the same automatic question contract.
do $patch$ declare d text;marker text;begin
 d:=pg_get_functiondef('academy2_access.intake_condition_context(jsonb,jsonb,boolean)'::regprocedure);
 marker:=$m$'course_ids',coalesce(p_configuration->'course_ids','[]')$m$;
 if position('instructor_registration' in d)=0 then
 if position(marker in d)=0 then raise exception 'academy2_after_intake_context_changed';end if;
 execute replace(d,marker,$m$'instructor_registration',coalesce(p_configuration#>'{after,instructor_license}'='true'::jsonb,false),$m$||marker);
 end if;
 d:=pg_get_functiondef('academy2_access.intake_runtime_fields(jsonb,jsonb)'::regprocedure);
 marker:=$m$if p_context->'certificate'='true' then$m$;
 if position('instructor_path_notice' in d)=0 then
 if position(marker in d)=0 then raise exception 'academy2_after_intake_fields_changed';end if;
 execute replace(d,marker,$new$if p_context->'instructor_registration'='true' then autofields:=autofields||'[{"id":"instructor_path_notice","label":"講師活動には受講後の登録・契約・条件確認が必要です","type":"select","required":true,"options":["確認しました"]}]';end if;
$new$||marker);
 end if;
end$patch$;
notify pgrst,'reload schema';

-- New policy fields must not be silently ignored by the existing public workflow.
do $patch$ declare d text;marker text:='conf:=academy2_access.resolved_saved_plan_configuration(d.id,d.revision);';begin
 d:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 if position('after_course_settings_v2_pending' in d)=0 then
 if position(marker in d)=0 then raise exception 'academy2_after_readiness_contract_changed';end if;
 execute replace(d,marker,marker||$new$
 -- after_course_settings_v2_pending: keep new expiry, renewal and license policies on hold until their consumer is connected.
 if (conf#>>'{after,skill_certification}'='true' and conf#>'{after,qualification}' is not null)
 or (conf#>>'{after,instructor_license}'='true' and (conf#>'{after,instructor_policy}' is not null or conf#>'{after,registration_fee}' is not null or conf#>'{after,manual}' is not null))
 or conf#>'{after,completion_timing}' is not null then reasons:=reasons||'"after_course_flow_pending"'::jsonb;end if;
$new$);
 end if;
end$patch$;
notify pgrst,'reload schema';
