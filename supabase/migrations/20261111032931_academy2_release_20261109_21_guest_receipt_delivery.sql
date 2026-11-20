-- Release candidate only. Requires guest-intake foundation and target/ACL review.
begin;
create table academy2_access.guest_intake_budgets (
 key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,window_count integer not null,day_count integer not null,
 created_at timestamptz not null default clock_timestamp()
);
create index guest_intake_budgets_created on academy2_access.guest_intake_budgets(created_at);
create table academy2_access.guest_receipt_deliveries (
 application_id uuid primary key references academy2_access.guest_applications(id),
 state text not null check(state in('sending','sent','failed','unknown')),
 message jsonb not null,provider_id text,
 claimed_at timestamptz not null default clock_timestamp(),finished_at timestamptz
);
alter table academy2_access.guest_intake_budgets enable row level security;
alter table academy2_access.guest_receipt_deliveries enable row level security;
revoke all on academy2_access.guest_intake_budgets,academy2_access.guest_receipt_deliveries from public,anon,authenticated,service_role;

create function academy2_access.guest_intake_budget(p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp();w timestamptz;b academy2_access.guest_intake_budgets;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'guest_server_only' using errcode='42501';end if;
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'guest_invalid_budget' using errcode='22023';end if;
 w:=to_timestamp(floor(extract(epoch from t)/600)*600);
 insert into academy2_access.guest_intake_budgets(key_hash,window_start,window_count,day_count) values(p_key,w,1,1)
 on conflict(key_hash) do update set window_start=w,
 window_count=case when academy2_access.guest_intake_budgets.window_start=w then academy2_access.guest_intake_budgets.window_count+1 else 1 end,
 day_count=academy2_access.guest_intake_budgets.day_count+1 returning * into b;
 if b.window_count>60 or b.day_count>500 then raise exception 'guest_rate_limit' using errcode='PT429';end if;
 -- Remove expired pseudonymous counters when the endpoint is used; no raw address is stored.
 delete from academy2_access.guest_intake_budgets where created_at<t-interval '2 days';
 return jsonb_build_object('allowed',true);
end $$;

create function academy2_access.claim_guest_receipt(p_id uuid,p_session text,p_message jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;d academy2_access.guest_receipt_deliveries;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'guest_server_only' using errcode='42501';end if;
 select * into a from academy2_access.guest_applications where id=p_id and session_hash=p_session for update;
 if not found then raise exception 'guest_receipt_unavailable' using errcode='42501';end if;
 if a.receipt_state<>'queued' then return jsonb_build_object('claimed',false,'state',a.receipt_state);end if;
 if jsonb_typeof(p_message) is distinct from 'object' or octet_length(p_message::text)>60000
 or exists(select 1 from jsonb_object_keys(p_message) k where k not in('to','subject','text','html'))
 or p_message->>'to' is distinct from a.email
 or jsonb_typeof(p_message->'subject') is distinct from 'string' or length(p_message->>'subject') not between 1 and 240
 or p_message->>'subject' ~ E'[\r\n]'
 or jsonb_typeof(p_message->'text') is distinct from 'string' or length(p_message->>'text') not between 1 and 20000
 or jsonb_typeof(p_message->'html') is distinct from 'string' or length(p_message->>'html') not between 1 and 40000
 then raise exception 'guest_invalid_mail' using errcode='22023';end if;
 insert into academy2_access.guest_receipt_deliveries(application_id,state,message) values(a.id,'sending',p_message)
 on conflict(application_id) do nothing returning * into d;
 if d.application_id is null then return jsonb_build_object('claimed',false,'state','unknown');end if;
 update academy2_access.guest_applications set receipt_state='sending' where id=a.id;
 return jsonb_build_object('claimed',true,'state','sending','message',d.message);
end $$;

create function academy2_access.finish_guest_receipt(p_id uuid,p_session text,p_state text,p_provider text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.guest_applications;d academy2_access.guest_receipt_deliveries;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'guest_server_only' using errcode='42501';end if;
 if p_state is null or p_state not in('sent','failed','unknown') or length(coalesce(p_provider,''))>200
 or (p_state='sent' and nullif(p_provider,'') is null) then raise exception 'guest_invalid_outcome' using errcode='22023';end if;
 select * into a from academy2_access.guest_applications where id=p_id and session_hash=p_session for update;
 if not found then raise exception 'guest_receipt_unavailable' using errcode='42501';end if;
 select * into d from academy2_access.guest_receipt_deliveries where application_id=a.id for update;
 if d.application_id is null then raise exception 'guest_receipt_not_claimed' using errcode='22023';end if;
 if d.state='sending' then
  update academy2_access.guest_receipt_deliveries set state=p_state,provider_id=case when p_state='sent' then p_provider end,finished_at=clock_timestamp() where application_id=a.id;
  update academy2_access.guest_applications set receipt_state=p_state where id=a.id;
  return jsonb_build_object('state',p_state);
 end if;
 -- Terminal outcomes never reset a job for automatic redelivery.
 return jsonb_build_object('state',d.state);
end $$;

create function public.academy2_guest_intake_budget(p_key text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.guest_intake_budget(p_key)$$;
create function public.academy2_claim_guest_receipt(p_id uuid,p_session text,p_message jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.claim_guest_receipt(p_id,p_session,p_message)$$;
create function public.academy2_finish_guest_receipt(p_id uuid,p_session text,p_state text,p_provider text default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.finish_guest_receipt(p_id,p_session,p_state,p_provider)$$;
revoke all on function academy2_access.guest_intake_budget(text),academy2_access.claim_guest_receipt(uuid,text,jsonb),academy2_access.finish_guest_receipt(uuid,text,text,text),public.academy2_guest_intake_budget(text),public.academy2_claim_guest_receipt(uuid,text,jsonb),public.academy2_finish_guest_receipt(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.guest_intake_budget(text),academy2_access.claim_guest_receipt(uuid,text,jsonb),academy2_access.finish_guest_receipt(uuid,text,text,text),public.academy2_guest_intake_budget(text),public.academy2_claim_guest_receipt(uuid,text,jsonb),public.academy2_finish_guest_receipt(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
