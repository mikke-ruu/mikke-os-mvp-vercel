-- Persist the receipt capability before rendering an email. Private outbox only.
begin;
create table academy2_access.guest_material_link_outbox(
 application_id uuid primary key references academy2_access.guest_applications(id),
 access_path text not null,created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.guest_material_link_outbox enable row level security;
revoke all on academy2_access.guest_material_link_outbox from public,anon,authenticated,service_role;
create function academy2_access.store_guest_material_path(p_application uuid,p_session text,p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;prior text;path text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'guest_server_only' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=p_application and session_hash=p_session for update;
 if a.id is null or not academy2_access.guest_receipt_token_matches(p_application,p_token) then raise exception 'guest_application_unavailable' using errcode='42501';end if;
 path:='/academy/guest-materials?application='||a.id::text||'#receive='||p_token;
 insert into academy2_access.guest_material_link_outbox(application_id,access_path) values(a.id,path) on conflict do nothing;
 select access_path into prior from academy2_access.guest_material_link_outbox where application_id=a.id;
 if prior is distinct from path then raise exception 'guest_material_path_unavailable' using errcode='42501';end if;
 return true;
end$$;
create function public.academy2_store_guest_material_path(p_application_id uuid,p_session text,p_receipt_token text) returns boolean
language sql security invoker set search_path='' as $$select academy2_access.store_guest_material_path(p_application_id,p_session,p_receipt_token)$$;
revoke all on function academy2_access.store_guest_material_path(uuid,text,text),public.academy2_store_guest_material_path(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.store_guest_material_path(uuid,text,text),public.academy2_store_guest_material_path(uuid,text,text) to service_role;
do $guard$
declare definition text:=pg_get_functiondef('academy2_access.guest_material_receipt_path(uuid)'::regprocedure);
begin
 if position('substring(d.message' in definition)=0 or position('material_access_path' in definition)>0 then raise exception 'guest_material_receipt_path_changed';end if;
end $guard$;
create or replace function academy2_access.guest_material_receipt_path(p_application uuid) returns text
language sql stable security definer set search_path='' as $$
 select '/academy/guest-materials?application='||p_application::text||'#receive='||x.token
 from academy2_access.guest_applications a
 left join academy2_access.guest_material_link_outbox o on o.application_id=a.id
 left join academy2_access.guest_receipt_deliveries d on d.application_id=a.id
 cross join lateral(select substring(coalesce(o.access_path,d.message->>'text') from '/academy/guest-materials[?]application='||p_application::text||'#receive=([a-f0-9]{64})') token) x
 where a.id=p_application and academy2_access.guest_receipt_token_matches(p_application,x.token);
$$;
revoke all on function academy2_access.guest_material_receipt_path(uuid) from public,anon,authenticated,service_role;
do $patch$
declare definition text;marker text:=$old$update academy2_access.guest_participation_mail set state='sending',$old$;
 addition text:=$new$if j.payload->>'materialsEnabled'='true' then
  if academy2_access.guest_material_receipt_path(j.application_id) is null then return jsonb_build_object('outcome','queued');end if;
  update academy2_access.guest_participation_mail set payload=jsonb_set(payload,'{guestAccessPath}',to_jsonb(academy2_access.guest_material_receipt_path(j.application_id))) where id=p_job returning * into j;
 end if;
 update academy2_access.guest_participation_mail set state='sending',$new$;
begin
 definition:=pg_get_functiondef('public.academy2_claim_guest_participation_mail(uuid)'::regprocedure);
 if position(marker in definition)=0 or position('guest_material_receipt_path' in definition)>0 then raise exception 'guest_participation_claim_changed';end if;
 execute replace(definition,marker,addition);
end $patch$;
create function academy2_access.prepare_guest_material_link(p_application uuid,p_session text,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prepared jsonb;
begin
 prepared:=academy2_access.prepare_guest_material_token(p_application,p_session,encode(sha256(convert_to(p_token,'UTF8')),'hex'));
 if prepared->>'enabled'='true' then
  if prepared->>'prepared' is distinct from 'true' then raise exception 'guest_material_token_conflict' using errcode='42501';end if;
  perform academy2_access.store_guest_material_path(p_application,p_session,p_token);
 end if;
 return prepared;
end$$;
create function public.academy2_prepare_guest_material_link(p_application_id uuid,p_session text,p_receipt_token text) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.prepare_guest_material_link(p_application_id,p_session,p_receipt_token)$$;
revoke all on function academy2_access.prepare_guest_material_link(uuid,text,text),public.academy2_prepare_guest_material_link(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.prepare_guest_material_link(uuid,text,text),public.academy2_prepare_guest_material_link(uuid,text,text) to service_role;
create function academy2_access.redact_guest_material_link(p_value jsonb) returns jsonb
language sql immutable set search_path='' as $$select regexp_replace(p_value::text,'#receive=[a-fA-F0-9]{64}','#receive=[受講者専用]','g')::jsonb$$;
revoke all on function academy2_access.redact_guest_material_link(jsonb) from public,anon,authenticated,service_role;
do $redact$
declare definition text;marker text:=$old$'receiptMessage',receipt,'participationMessage',message,'participation',payload,$old$;
 addition text:=$new$'receiptMessage',academy2_access.redact_guest_material_link(receipt),'participationMessage',academy2_access.redact_guest_material_link(message),'participation',payload-'guestAccessPath',$new$;
begin
 definition:=pg_get_functiondef('public.academy2_application_mail_content(uuid,uuid)'::regprocedure);
 if position(marker in definition)=0 or position('redact_guest_material_link' in definition)>0 then raise exception 'guest_mail_content_changed';end if;
 execute replace(definition,marker,addition);
end $redact$;
do $pending$
declare definition text;marker text:=$old$from academy2_access.guest_participation_mail where state='queued'$old$;
 addition text:=$new$from academy2_access.guest_participation_mail where (state='queued' and (payload->>'materialsEnabled' is distinct from 'true' or academy2_access.guest_material_receipt_path(application_id) is not null))$new$;
begin
 definition:=pg_get_functiondef('public.academy2_pending_participation_mail(integer)'::regprocedure);
 if position(marker in definition)=0 or position('guest_material_receipt_path' in definition)>0 then raise exception 'guest_pending_mail_changed';end if;
 execute replace(definition,marker,addition);
end $pending$;
notify pgrst,'reload schema';
commit;
