-- Production candidate; review and isolated validation required before approval.
-- LOCAL CANDIDATE ONLY. Apply after conditional_intake and all_courses_publication.
-- Existing bank/onsite rows are not rewritten. Card, monthly and staged remain held.
create or replace function academy2_access.manual_plan_payment_methods(p_config jsonb) returns text[]
language plpgsql immutable set search_path='' as $$
declare methods text[];url text;
begin
 if jsonb_typeof(p_config->'payment_methods') is distinct from 'array' then return null;end if;
 select array_agg(value order by ord) into methods from jsonb_array_elements_text(p_config->'payment_methods') with ordinality a(value,ord);
 if coalesce(cardinality(methods),0)=0 or not methods<@array['bank','onsite','external']::text[] or cardinality(methods)<>(select count(distinct value) from unnest(methods) value) then return null;end if;
 if 'external'=any(methods) then
  url:=p_config#>>'{external_payment_urls,plan}';
  -- HTTPS with a host, without credentials, whitespace, control characters or backslashes.
  if url is null or length(url)>2048 or url !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#].*)?$' or url ~ '[[:space:][:cntrl:]\\]' then return null;end if;
 end if;
 return methods;
end$$;
revoke all on function academy2_access.manual_plan_payment_methods(jsonb) from public,anon,authenticated,service_role;

create table academy2_access.manual_payment_selection_permits(
 actor_id uuid not null,request_id uuid not null,offering_id uuid not null,transaction_id bigint not null,
 method text not null check(method in('bank','onsite','external')),primary key(actor_id,request_id)
);
alter table academy2_access.manual_payment_selection_permits enable row level security;
revoke all on academy2_access.manual_payment_selection_permits from public,anon,authenticated,service_role;
create function academy2_access.selected_manual_payment(p_offering uuid,p_request uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select method from academy2_access.manual_payment_selection_permits where actor_id=auth.uid() and request_id=p_request and offering_id=p_offering and transaction_id=txid_current()),'bank')
$$;
revoke all on function academy2_access.selected_manual_payment(uuid,uuid) from public,anon,authenticated,service_role;

-- The wider CHECK is paired with private-permit guards; no legacy external path opens.
alter table public.academy_offerings drop constraint academy_offerings_payment_methods_check;
alter table public.academy_offerings add constraint academy_offerings_payment_methods_check check(cardinality(payment_methods)>0 and payment_methods<@array['bank','onsite','external']::text[]);
alter table public.academy_offering_applications drop constraint academy_offering_applications_payment_method_check;
alter table public.academy_offering_applications add constraint academy_offering_applications_payment_method_check check(payment_method in('bank','onsite','external'));
create function academy2_access.guard_external_payment_origin() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='academy_offerings' then
  if 'external'=any(new.payment_methods) and not exists(select 1 from academy2_access.plan_publication_permits p where p.offering_id=new.id and p.actor_id=auth.uid() and p.transaction_id=txid_current() and p.operation=tg_op and p.new_row=to_jsonb(new)) then raise exception 'academy2_external_publication_required' using errcode='42501';end if;
 else
  if new.payment_method='external' and not exists(select 1 from academy2_access.manual_payment_selection_permits p where p.offering_id=new.offering_id and p.actor_id=new.learner_user_id and p.actor_id=auth.uid() and p.request_id=new.request_token and p.transaction_id=txid_current() and p.method='external') then raise exception 'academy2_external_selection_required' using errcode='42501';end if;
 end if;
 return new;
end$$;
-- Alphabetically before academy_offering_guard consumes the publication permit.
create trigger aaa_academy2_external_payment_origin before insert or update on public.academy_offerings for each row execute function academy2_access.guard_external_payment_origin();
create trigger aaa_academy2_external_payment_origin before insert on public.academy_offering_applications for each row execute function academy2_access.guard_external_payment_origin();
revoke all on function academy2_access.guard_external_payment_origin() from public,anon,authenticated,service_role;

-- Guarded small replacements retain installed answers, kit, material and all-course fixes.
do $patch$
declare fn text;old_text text;new_text text;definition text;routine regprocedure;
begin
 for fn,old_text,new_text in select * from(values
 ('plan_publication_readiness',$old$if conf->'payment_methods' is distinct from '["bank"]'::jsonb then reasons:=reasons||'"bank_only_bridge"'::jsonb;end if;$old$,$new$if academy2_access.manual_plan_payment_methods(conf) is null then reasons:=reasons||'"manual_payment_configuration_required"'::jsonb;end if;$new$),
 ('publish_existing_plan',$old$o.payment_methods:=array['bank'];$old$,$new$o.payment_methods:=academy2_access.manual_plan_payment_methods(d.configuration);$new$),
 ('bind_operation_source',$old$or ('bank'=any(o.payment_methods)) is distinct from true or ((r.configuration->'payment_methods')?'bank') is distinct from true$old$,$new$or academy2_access.manual_plan_payment_methods(r.configuration) is null or o.payment_methods is distinct from academy2_access.manual_plan_payment_methods(r.configuration)$new$),
 ('public_intake',$old$or (data->'payment_methods'?'bank') is distinct from true$old$,$new$or (case when p_instructor then (data->'payment_methods'?'bank') is distinct from true else academy2_access.manual_plan_payment_methods(cfg) is null or data->'payment_methods' is distinct from to_jsonb(academy2_access.manual_plan_payment_methods(cfg)) end)$new$),
 ('public_intake',$old$'offering',data||jsonb_build_object('payment_methods',jsonb_build_array('bank'))$old$,$new$'offering',data||jsonb_build_object('payment_methods',case when p_instructor then jsonb_build_array('bank') else to_jsonb(academy2_access.manual_plan_payment_methods(cfg)) end,'external_payment_url',case when not p_instructor and 'external'=any(academy2_access.manual_plan_payment_methods(cfg)) then cfg#>>'{external_payment_urls,plan}' else null end)$new$),
 ('submit_operation',$old$a.offering_id<>p_offering or a.applicant_name$old$,$new$a.payment_method is distinct from academy2_access.selected_manual_payment(p_offering,p_request) or a.offering_id<>p_offering or a.applicant_name$new$),
 ('submit_operation',$old$('bank'=any(o.payment_methods)) is distinct from true$old$,$new$(academy2_access.selected_manual_payment(p_offering,p_request)=any(o.payment_methods)) is distinct from true or academy2_access.manual_plan_payment_methods(r.configuration) is null or o.payment_methods is distinct from academy2_access.manual_plan_payment_methods(r.configuration)$new$),
 ('submit_operation',$old$o.price,o.currency,'bank');$old$,$new$o.price,o.currency,academy2_access.selected_manual_payment(p_offering,p_request));$new$),
 ('operation_command',$old$a.payment_method<>'bank'$old$,$new$a.payment_method not in('bank','onsite','external')$new$),
 ('operation_command',$old$if p_action in('confirm_completion','confirm_certification') and$old$,$new$if p_action='confirm_payment' and a.payment_method in('onsite','external') and (nullif(btrim(p_input->>'review_note'),'') is null or length(p_input->>'review_note')>2000) then raise exception 'academy2_payment_review_required' using errcode='22023';end if;
 if p_action in('confirm_completion','confirm_certification') and$new$),
 ('hq_application',$old$a.payment_method='bank' and academy2_access.can(p_hq,'payment.confirm')$old$,$new$a.payment_method in('bank','onsite','external') and academy2_access.can(p_hq,'payment.confirm')$new$)
 ) changes(function_name,old_value,new_value) loop
  select p.oid::regprocedure into strict routine from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academy2_access' and p.proname=fn;
  definition:=pg_get_functiondef(routine);
  if position(new_text in definition)>0 then continue;end if;
  if position(old_text in definition)=0 then raise exception 'academy2_unrecognized_manual_payment_contract: %',fn;end if;
  execute replace(definition,old_text,new_text);
 end loop;
end$patch$;

-- New entry point leaves the existing bank RPC and instructor intake unchanged.
create function academy2_access.submit_public_intake_payment(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid,p_answers jsonb,p_payment_method text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb;result jsonb;prior public.academy_offering_applications;conf jsonb;url text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_request is null then raise exception 'authenticated_user_required' using errcode='42501';end if;
 if p_instructor is distinct from false or p_payment_method is null or p_payment_method not in('bank','onsite','external') then raise exception 'academy2_payment_selection_invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request::text,213000));
 select * into prior from public.academy_offering_applications where learner_user_id=auth.uid() and request_token=p_request;
 if found then
  if prior.offering_id is distinct from p_id or prior.payment_method is distinct from p_payment_method then raise exception 'academy2_payment_selection_conflict' using errcode='PT409';end if;
  -- Retry uses the immutable purchase revision even if the public page later closes.
  select r.configuration into conf from academy2_access.operation_enrollments e join academy2_access.sales_plan_draft_revisions r on r.draft_id=e.plan_id and r.revision=e.plan_revision where e.application_id=prior.id;
 else
  ctx:=academy2_access.public_intake_with_form(p_id,false);
  if ctx->>'mode' is distinct from 'headquarters' or (ctx#>'{offering,payment_methods}'?p_payment_method) is distinct from true then raise exception 'academy2_payment_selection_unavailable' using errcode='42501';end if;
  conf:=academy2_access.intake_configuration(p_id);
 end if;
 if academy2_access.manual_plan_payment_methods(conf) is null or (p_payment_method=any(academy2_access.manual_plan_payment_methods(conf))) is distinct from true then raise exception 'academy2_payment_configuration_changed' using errcode='PT409';end if;
 insert into academy2_access.manual_payment_selection_permits(actor_id,request_id,offering_id,transaction_id,method) values(auth.uid(),p_request,p_id,txid_current(),p_payment_method);
 result:=academy2_access.submit_public_intake_with_answers(p_id,false,p_request,p_name,p_terms,p_agree,p_price,p_class,p_answers);
 delete from academy2_access.manual_payment_selection_permits where actor_id=auth.uid() and request_id=p_request;
 if p_payment_method='external' then url:=conf#>>'{external_payment_urls,plan}';end if;
 return result||jsonb_build_object('payment_method',p_payment_method,'external_payment_url',url);
end$$;
revoke all on function academy2_access.submit_public_intake_payment(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.submit_public_intake_payment(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb,text) to authenticated;
create function public.academy2_submit_public_intake_payment(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid,p_answers jsonb,p_payment_method text) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.submit_public_intake_payment(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class,p_answers,p_payment_method)$$;
revoke all on function public.academy2_submit_public_intake_payment(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb,text) from public,anon,service_role;
grant execute on function public.academy2_submit_public_intake_payment(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb,text) to authenticated;
notify pgrst,'reload schema';
