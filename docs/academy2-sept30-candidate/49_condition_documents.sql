-- Production candidate; review and isolated validation required before approval.
-- Inert, immutable headquarters-authored condition documents. No grants/contracts/payments are issued.
create table if not exists academy2_access.plan_condition_documents (
 id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 kind text not null check(kind in('completion','skill','commercial','instructor','manual','monthly_exit')),
 title text not null check(length(btrim(title)) between 1 and 200),version text not null check(length(btrim(version)) between 1 and 100),
 body text not null check(length(btrim(body)) between 1 and 20000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index if not exists plan_condition_documents_hq_kind on academy2_access.plan_condition_documents(headquarters_id,kind,created_at desc);
alter table academy2_access.plan_condition_documents enable row level security;
revoke all on academy2_access.plan_condition_documents from public,anon,authenticated,service_role;
create or replace function academy2_access.plan_condition_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'academy2_condition_document_immutable' using errcode='42501';end$$;
drop trigger if exists plan_condition_immutable on academy2_access.plan_condition_documents;
create trigger plan_condition_immutable before update or delete on academy2_access.plan_condition_documents for each row execute function academy2_access.plan_condition_immutable();
revoke all on function academy2_access.plan_condition_immutable() from public,anon,authenticated,service_role;
create or replace function academy2_access.plan_conditions(p_hq uuid,p_kind text) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(d)-'created_by' order by d.created_at desc),'[]') from academy2_access.plan_condition_documents d where d.headquarters_id=p_hq and d.kind=p_kind);
end$$;
create or replace function academy2_access.register_plan_condition(p_hq uuid,p_id uuid,p_kind text,p_title text,p_version text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$declare d academy2_access.plan_condition_documents;begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_id is null or p_kind not in('completion','skill','commercial','instructor','manual','monthly_exit') or p_kind is null or coalesce(length(btrim(p_title)),0) not between 1 and 200 or coalesce(length(btrim(p_version)),0) not between 1 and 100 or coalesce(length(btrim(p_body)),0) not between 1 and 20000 then raise exception 'academy2_invalid_condition_document' using errcode='22023';end if;
 insert into academy2_access.plan_condition_documents(id,headquarters_id,kind,title,version,body,created_by) values(p_id,p_hq,p_kind,btrim(p_title),btrim(p_version),btrim(p_body),auth.uid()) on conflict(id) do nothing;
 select * into d from academy2_access.plan_condition_documents where id=p_id;
 if d.headquarters_id<>p_hq or d.created_by<>auth.uid() then raise exception 'academy2_condition_document_scope' using errcode='42501';end if;
 if d.kind<>p_kind or d.title<>btrim(p_title) or d.version<>btrim(p_version) or d.body<>btrim(p_body) then raise exception 'academy2_condition_document_retry_changed' using errcode='PT409';end if;
 return to_jsonb(d)-'created_by';
end$$;
create or replace function academy2_access.validate_plan_condition_references(p_hq uuid,p_config jsonb,p_previous jsonb) returns void language plpgsql stable security definer set search_path='' as $$declare entry record;ref text;begin
 for entry in select * from (values
 ('after','completion_condition_id','completion'),('after','skill_definition_id','skill'),('after','required_skill_condition_id','skill'),('after','commercial_condition_id','commercial'),('after','instructor_condition_id','instructor'),('after','instructor_manual_id','manual'),('monthly','exit_policy_id','monthly_exit'),('monthly','completion_condition_id','completion')) as refs(section,key,kind) loop
 ref:=p_config#>>array[entry.section,entry.key];
 if nullif(ref,'') is not null and ref is distinct from (p_previous#>>array[entry.section,entry.key]) and not exists(select 1 from academy2_access.plan_condition_documents d where d.id::text=ref and d.headquarters_id=p_hq and d.kind=entry.kind) then raise exception 'academy2_condition_document_unavailable' using errcode='42501';end if;
 end loop;
end$$;
revoke all on function academy2_access.plan_conditions(uuid,text),academy2_access.register_plan_condition(uuid,uuid,text,text,text,text),academy2_access.validate_plan_condition_references(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create or replace function public.academy2_plan_conditions(p_headquarters_id uuid,p_kind text) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.plan_conditions(p_headquarters_id,p_kind)$$;
create or replace function public.academy2_register_plan_condition(p_headquarters_id uuid,p_id uuid,p_kind text,p_title text,p_version text,p_body text) returns jsonb language sql security definer set search_path='' as $$select academy2_access.register_plan_condition(p_headquarters_id,p_id,p_kind,p_title,p_version,p_body)$$;
revoke all on function public.academy2_plan_conditions(uuid,text),public.academy2_register_plan_condition(uuid,uuid,text,text,text,text) from public,anon,service_role;
grant execute on function public.academy2_plan_conditions(uuid,text),public.academy2_register_plan_condition(uuid,uuid,text,text,text,text) to authenticated;
do $patch$declare d text;marker text:='-- Configuration is inert draft data';begin
 d:=pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure);
 d:=replace(d,'perform academy2_access.validate_plan_condition_references(p_hq,p_configuration);','perform academy2_access.validate_plan_condition_references(p_hq,p_configuration,(select old_d.configuration from academy2_access.sales_plan_drafts old_d where old_d.id=p_id and old_d.headquarters_id=p_hq));');
 if position('validate_plan_condition_references' in d)=0 then
  if position(marker in d)=0 then raise exception 'academy2_unrecognized_draft_condition_hook';end if;
  execute replace(d,marker,'perform academy2_access.validate_plan_condition_references(p_hq,p_configuration,(select old_d.configuration from academy2_access.sales_plan_drafts old_d where old_d.id=p_id and old_d.headquarters_id=p_hq));'||chr(10)||marker);
 else execute d;end if;
end$patch$;
notify pgrst,'reload schema';
