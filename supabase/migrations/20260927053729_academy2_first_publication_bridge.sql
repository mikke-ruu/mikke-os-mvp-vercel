-- Candidate only. Existing policy/quote/payment conditions are retained.
-- No policy seed, provider call, old enrollment conversion, or JWT impersonation.
-- Keep the installed billing arithmetic and quote producer unchanged. Only the
-- opt-in owner authorization differs from the legacy role lookup.
do $quote_bridge$
declare source text;gate text:='private.academy_headquarters_role(p_headquarters_id, (select auth.uid())) is distinct from ''owner''';
begin
 source:=pg_get_functiondef('public.academy_get_my_current_billing_estimate(uuid)'::regprocedure);
 if position(gate in source)=0 or position('private.academy_catalog_monthly_price_yen' in source)=0 then raise exception 'academy2_billing_estimate_unrecognized';end if;
 source:=replace(source,'public.academy_get_my_current_billing_estimate','academy2_access.first_publication_estimate');
 source:=replace(source,gate,'academy2_access.my_role(p_headquarters_id) is distinct from ''owner'' or not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=auth.uid())');
 execute source;
 source:=pg_get_functiondef('academy_publication_private.quote(uuid,text)'::regprocedure);
 if position('public.academy_get_my_current_billing_estimate(p_headquarters_id)' in source)=0 then raise exception 'academy2_quote_producer_unrecognized';end if;
 source:=replace(source,'academy_publication_private.quote(','academy2_access.first_publication_quote(');
 source:=replace(source,'public.academy_get_my_current_billing_estimate(p_headquarters_id)','academy2_access.first_publication_estimate(p_headquarters_id)');
 execute source;
end $quote_bridge$;
revoke all on function academy2_access.first_publication_estimate(uuid),academy2_access.first_publication_quote(uuid,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.first_publication_quote(uuid,text) to authenticated;
create function public.academy2_first_publication_quote(p_headquarters_id uuid,p_policy_version text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.first_publication_quote(p_headquarters_id,p_policy_version)$$;
revoke all on function public.academy2_first_publication_quote(uuid,text) from public,anon,service_role;
grant execute on function public.academy2_first_publication_quote(uuid,text) to authenticated;

create table academy2_access.first_publication_consents (
 id bigint generated always as identity primary key,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 owner_user_id uuid not null references auth.users(id),quote_id uuid not null references academy_publication_private.quotes(id),
 snapshot jsonb not null,consented_at timestamptz not null default clock_timestamp()
);
create table academy2_access.first_publication_releases (
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 request_id uuid not null unique,published_by uuid not null references auth.users(id),plan_id uuid not null,
 first_published_at timestamptz not null
);
alter table academy2_access.first_publication_consents enable row level security;
alter table academy2_access.first_publication_releases enable row level security;
revoke all on academy2_access.first_publication_consents,academy2_access.first_publication_releases from public,anon,authenticated,service_role;
create trigger academy2_first_consent_immutable before update or delete on academy2_access.first_publication_consents for each row execute function academy2_access.opening_immutable();
create trigger academy2_first_release_immutable before update or delete on academy2_access.first_publication_releases for each row execute function academy2_access.opening_immutable();

create function academy2_access.first_publication_status(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e academy_publication_private.enrollments;q academy_publication_private.quotes;r text:=academy2_access.my_role(p_hq);
begin
 if r is null or r not in('owner','administrator') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_hq;
 select * into q from academy_publication_private.quotes where headquarters_id=p_hq and not revoked order by (id=e.quote_id) desc nulls last,issued_at desc,id limit 1;
 return jsonb_build_object('phase',coalesce(e.phase,'unprepared'),'can_consent',r='owner' and exists(select 1 from public.academy_headquarters where id=p_hq and owner_user_id=auth.uid()),
 'consented',exists(select 1 from academy2_access.first_publication_consents where headquarters_id=p_hq and quote_id=e.quote_id and owner_user_id=e.owner_user_id),
 'first_published_at',e.first_published_at,'trial_ends_at',e.trial_ends_at,'policy_version',coalesce(e.policy_version,q.policy_version),'terms_revision',coalesce(e.terms_revision,q.terms_revision),
 'enrollment',case when e.headquarters_id is null then null else jsonb_build_object('headquarters_id',e.headquarters_id,'owner_user_id',e.owner_user_id,'policy_version',e.policy_version,'terms_revision',e.terms_revision,'quote_id',e.quote_id,'amount_yen',e.amount_yen,'instructor_count',e.instructor_count,'consent_at',e.consent_at,'consent_revision',e.consent_revision,'plan_key',e.plan_key,'plan_name',e.plan_name,'discount_description',e.discount_description,'first_published_at',e.first_published_at,'trial_ends_at',e.trial_ends_at,'cancellation_accepted_at',e.cancellation_accepted_at,'phase',e.phase) end,
 'quote',case when q.id is null then null else jsonb_build_object('id',q.id,'amount_yen',q.amount_yen,'terms_revision',q.terms_revision,'consent_revision',q.consent_revision,'plan_name',q.plan_name,'discount_description',q.discount_description,'instructor_count',q.instructor_count,'expires_at',q.expires_at,'payment_verified',q.payment_verified) end);
end $$;

create function academy2_access.first_publication_prepare(p_hq uuid,p_quote uuid,p_terms text,p_amount bigint,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy_publication_private.enrollments;result jsonb;
begin
 if academy2_access.my_role(p_hq) is distinct from 'owner' or not exists(select 1 from public.academy_headquarters where id=p_hq and owner_user_id=auth.uid()) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() for update;
 perform 1 from public.academy_headquarters where id=p_hq for update;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_hq for update;
 if e.headquarters_id is not null and (e.first_published_at is not null or e.phase<>'prepared' or not exists(select 1 from academy2_access.first_publication_consents where headquarters_id=p_hq and quote_id=e.quote_id and owner_user_id=e.owner_user_id)) then raise exception 'academy2_existing_enrollment_unchanged' using errcode='22023';end if;
 result:=academy_publication_private.command(p_hq,'prepare',null,p_quote,p_confirmed,p_terms,p_amount);
 if not exists(select 1 from academy2_access.first_publication_consents where headquarters_id=p_hq and quote_id=p_quote and owner_user_id=auth.uid() and snapshot->>'terms_revision'=p_terms and (snapshot->>'amount_yen')::bigint=p_amount) then
  insert into academy2_access.first_publication_consents(headquarters_id,owner_user_id,quote_id,snapshot) values(p_hq,auth.uid(),p_quote,result);
 end if;
 return academy2_access.first_publication_status(p_hq);
end $$;

-- Reuse the installed canonical eligibility, current-price, quote-expiry,
-- payment-proof and consent validation. Only the publication target and actor
-- roles differ. The old function is neither replaced nor granted more widely.
do $derive$
declare source text;course_check text;course_write text;guard text;
begin
 source:=replace(pg_get_functiondef('academy_publication_private.command_before_runtime(uuid,text,uuid,uuid,boolean,text,bigint)'::regprocedure),E'\r\n',E'\n');
 course_check:=E'  if p_action in (''publish'',''unpublish'') then\n    perform 1 from public.academy_courses c where c.id=p_course_id and c.headquarters_id=p_headquarters_id for update;\n    if not found then raise exception ''course_not_found''; end if;\n  end if;';
 course_write:=E'  insert into academy_publication_private.publication_permits values(txid_current(),p_course_id);\n  update public.academy_courses set is_published=true where id=p_course_id;\n  delete from academy_publication_private.publication_permits where transaction_id=txid_current() and course_id=p_course_id;';
 if position(course_check in source)=0 or position(course_write in source)=0 or position('actor uuid := auth.uid();' in source)=0 or position('q.payment_verified' in source)=0 or position('q.consent_revision is distinct from p.consent_revision' in source)=0 then raise exception 'academy2_first_publication_canonical_unrecognized';end if;
 guard:=$body$
 if academy2_access.my_role(p_headquarters_id) is distinct from 'administrator' or p_action is distinct from 'publish' or p_course_id is not null or p_confirmed is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from academy_publication_private.enrollments en join academy2_access.first_publication_consents co on co.headquarters_id=en.headquarters_id and co.quote_id=en.quote_id and co.owner_user_id=en.owner_user_id where en.headquarters_id=p_headquarters_id and en.first_published_at is null and en.phase='prepared' and en.quote_id=p_quote_id and en.terms_revision=p_terms_revision and en.amount_yen=p_amount_yen) then raise exception 'academy2_owner_consent_required' using errcode='42501';end if;
$body$;
 source:=replace(source,'academy_publication_private.command_before_runtime','academy2_access.first_publication_start_core');
 source:=replace(source,'actor uuid := auth.uid();','actor uuid := (select owner_user_id from public.academy_headquarters where id=p_headquarters_id);');
 source:=replace(source,course_check,'');source:=replace(source,course_write,'');
 source:=overlay(source placing E'begin\n'||guard from position(E'begin\n' in source) for length(E'begin\n'));
 execute source;
end $derive$;
revoke all on function academy2_access.first_publication_start_core(uuid,text,uuid,uuid,boolean,text,bigint) from public,anon,authenticated,service_role;

create function academy2_access.publish_plan(p_hq uuid,p_plan uuid,p_plan_revision integer,p_page_revision integer,p_event uuid,p_event_revision integer,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e academy_publication_private.enrollments;owner_id uuid;result jsonb;started boolean:=false;
begin
 if academy2_access.my_role(p_hq) is distinct from 'administrator' or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null then raise exception 'academy2_invalid_publication' using errcode='22023';end if;
 select owner_user_id into owner_id from public.academy_headquarters where id=p_hq;
 perform 1 from auth.users where id=owner_id for update;
 perform 1 from public.academy_headquarters where id=p_hq for update;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_hq for update;
 if e.first_published_at is null and public.academy_is_publicly_available(p_hq) is distinct from true then
  if e.headquarters_id is null then raise exception 'academy2_owner_consent_required' using errcode='42501';end if;
  perform academy2_access.first_publication_start_core(p_hq,'publish',null,e.quote_id,true,e.terms_revision,e.amount_yen);
  update public.academy_headquarters set is_active=true where id=p_hq;
  started:=true;
 end if;
 result:=academy2_access.publish_existing_plan(p_hq,p_plan,p_plan_revision,p_page_revision,p_event,p_event_revision,p_request);
 if started then
  insert into academy2_access.first_publication_releases(headquarters_id,request_id,published_by,plan_id,first_published_at) select p_hq,p_request,auth.uid(),p_plan,first_published_at from academy_publication_private.enrollments where headquarters_id=p_hq;
 end if;
 return result||jsonb_build_object('starts_new_trial',exists(select 1 from academy2_access.first_publication_releases where headquarters_id=p_hq and request_id=p_request and published_by=auth.uid() and plan_id=p_plan));
end $$;

create function public.academy2_first_publication_status(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.first_publication_status(p_headquarters_id)$$;
create function public.academy2_first_publication_prepare(p_headquarters_id uuid,p_quote_id uuid,p_terms_revision text,p_amount_yen bigint,p_confirmed boolean) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.first_publication_prepare(p_headquarters_id,p_quote_id,p_terms_revision,p_amount_yen,p_confirmed)$$;
create function public.academy2_publish_plan(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer,p_page_revision integer,p_event_id uuid,p_event_revision integer,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.publish_plan(p_headquarters_id,p_plan_id,p_plan_revision,p_page_revision,p_event_id,p_event_revision,p_request_id)$$;
revoke all on function academy2_access.first_publication_status(uuid),academy2_access.first_publication_prepare(uuid,uuid,text,bigint,boolean),academy2_access.publish_plan(uuid,uuid,integer,integer,uuid,integer,uuid),public.academy2_first_publication_status(uuid),public.academy2_first_publication_prepare(uuid,uuid,text,bigint,boolean),public.academy2_publish_plan(uuid,uuid,integer,integer,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.first_publication_status(uuid),academy2_access.first_publication_prepare(uuid,uuid,text,bigint,boolean),academy2_access.publish_plan(uuid,uuid,integer,integer,uuid,integer,uuid),public.academy2_first_publication_status(uuid),public.academy2_first_publication_prepare(uuid,uuid,text,bigint,boolean),public.academy2_publish_plan(uuid,uuid,integer,integer,uuid,integer,uuid) to authenticated;
-- Trusted existing payment adapter only. These do not create provider proof;
-- they reuse the original reserve/complete validators after the opt-in scope gate.
create function academy2_access.first_setup_owner(p_hq uuid,p_owner uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from academy2_access.tenants t join academy2_access.memberships m on m.headquarters_id=t.headquarters_id join public.academy_headquarters h on h.id=t.headquarters_id where t.headquarters_id=p_hq and t.runtime_enabled and m.user_id=p_owner and m.active and m.role='owner' and h.owner_user_id=p_owner) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if exists(select 1 from academy_publication_private.enrollments e where e.headquarters_id=p_hq and (e.first_published_at is not null or e.phase<>'prepared' or not exists(select 1 from academy2_access.first_publication_consents c where c.headquarters_id=p_hq and c.quote_id=e.quote_id and c.owner_user_id=e.owner_user_id))) then raise exception 'academy2_existing_enrollment_unchanged' using errcode='22023';end if;
end $$;
revoke all on function academy2_access.first_setup_owner(uuid,uuid) from public,anon,authenticated,service_role;
create function public.academy2_first_publication_setup_reserve(p_owner_user_id uuid,p_headquarters_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform academy2_access.first_setup_owner(p_headquarters_id,p_owner_user_id);
 return academy2_access.legacy_setup_reserve(p_owner_user_id,p_headquarters_id,p_quote_id);
end $$;
create function public.academy2_first_publication_setup_complete(p_attempt_id uuid,p_provider_customer_id text,p_setup_intent_id text,p_payment_method_id text) returns jsonb
language plpgsql security definer set search_path='' as $$declare a academy_publication_private.setup_attempts;begin
 select * into a from academy_publication_private.setup_attempts where attempt_id=p_attempt_id;
 perform academy2_access.first_setup_owner(a.headquarters_id,a.owner_user_id);
 return academy2_access.legacy_setup_complete(p_attempt_id,p_provider_customer_id,p_setup_intent_id,p_payment_method_id);
end $$;
revoke all on function public.academy2_first_publication_setup_reserve(uuid,uuid,uuid),public.academy2_first_publication_setup_complete(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.academy2_first_publication_setup_reserve(uuid,uuid,uuid),public.academy2_first_publication_setup_complete(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
