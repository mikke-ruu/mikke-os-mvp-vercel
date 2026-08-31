-- Server-only checkout preparation, NOT payment collection or access grants.
-- Prerequisites: auth.users(id,is_anonymous), anon/authenticated/service_role.
-- The authenticated server must authorize current ownership, existing paid
-- subscriptions, product/resource/plan, current policy approval and price BEFORE
-- calling these RPCs. Actor args are trusted only because browser roles cannot
-- EXECUTE. Quote JSON is a validated server-owned snapshot, never browser input.
-- No expiry job clears pending scopes: reconciliation is a separate future gate.
create schema platform_billing_private;
revoke all on schema platform_billing_private from public,anon,authenticated,service_role;

create function platform_billing_private.exact_keys(v jsonb,keys text[]) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'object' then return false; end if;
 return v ?& keys and (select count(*) from jsonb_object_keys(v))=cardinality(keys);
end $$;
create function platform_billing_private.token(v text) returns boolean
language sql immutable set search_path='' as $$ select coalesce(v ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$',false) $$;
create function platform_billing_private.require_actor(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Check actual SQL role, not writable user_metadata nor an invented JWT role.
 if (session_user <> 'service_role' and coalesce(current_setting('role',true),'') <> 'service_role')
  or p_actor is null or not exists(select 1 from auth.users u where u.id=p_actor and u.is_anonymous is false) then
  raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN';
 end if;
end $$;

create function platform_billing_private.assert_quote(p_actor uuid,q jsonb) returns void
language plpgsql set search_path='' as $$
declare item jsonb; key text; amount numeric; dt date; ts timestamptz;
begin
 if not platform_billing_private.exact_keys(q,array['quoteId','revision','purchaseIntent','scope','currency','taxIncluded','dueNow','nextPayment','merchant','policies','issuedAt','expiresAt'])
  or jsonb_typeof(q->'quoteId') is distinct from 'string' or not platform_billing_private.token(q->>'quoteId')
  or jsonb_typeof(q->'revision') is distinct from 'number'
  or (q->>'revision')::numeric not between 1 and 9007199254740991
  or trunc((q->>'revision')::numeric)<>(q->>'revision')::numeric
  or q->>'purchaseIntent' is distinct from 'explicit_paid_start'
  or q->>'currency' is distinct from 'JPY' or q->'taxIncluded' is distinct from 'true'::jsonb then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
 end if;
 item:=q->'scope';
 if not platform_billing_private.exact_keys(item,array['ownerUserId','productKey','resourceId','planKey','requestId'])
  or item->>'ownerUserId' is distinct from p_actor::text
  or not platform_billing_private.token(item->>'productKey') or not platform_billing_private.token(item->>'planKey')
  or not platform_billing_private.token(item->>'requestId')
  or (item->'resourceId' is distinct from 'null'::jsonb and (jsonb_typeof(item->'resourceId') is distinct from 'string' or not platform_billing_private.token(item->>'resourceId'))) then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
 end if;
 foreach key in array array['ownerUserId','productKey','planKey','requestId'] loop
  if jsonb_typeof(item->key) is distinct from 'string' then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end if;
 end loop;
 if item->>'productKey' not in ('academy_platform','community_platform')
  or item->>'requestId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or (item->'resourceId' is distinct from 'null'::jsonb and item->>'resourceId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
 end if;
 foreach key in array array['dueNow','nextPayment'] loop
  item:=q->key;
  if not platform_billing_private.exact_keys(item,array['totalYen','dueOn']) or jsonb_typeof(item->'totalYen') is distinct from 'number'
   or jsonb_typeof(item->'dueOn') is distinct from 'string' or (item->>'dueOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
   raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
  end if;
  amount:=(item->>'totalYen')::numeric;
  if amount not between 0 and 9007199254740991 or trunc(amount)<>amount then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end if;
  begin dt:=(item->>'dueOn')::date; exception when others then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end;
  if not isfinite(dt) or to_char(dt,'YYYY-MM-DD')<>item->>'dueOn' then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end if;
 end loop;
 if q#>>'{nextPayment,dueOn}' <= q#>>'{dueNow,dueOn}' then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end if;
 item:=q->'merchant';
 if not platform_billing_private.exact_keys(item,array['merchantId','legalName','address','contactUrl']) or jsonb_typeof(item->'merchantId') is distinct from 'string' or not platform_billing_private.token(item->>'merchantId')
  or jsonb_typeof(item->'legalName') is distinct from 'string' or char_length(btrim(item->>'legalName')) not between 1 and 300
  or jsonb_typeof(item->'address') is distinct from 'string' or char_length(btrim(item->>'address')) not between 1 and 500
  or item->>'legalName' is distinct from btrim(item->>'legalName') or item->>'address' is distinct from btrim(item->>'address')
  or item->>'legalName' ~ '[[:cntrl:]]' or item->>'address' ~ '[[:cntrl:]]'
  or jsonb_typeof(item->'contactUrl') is distinct from 'string' or char_length(item->>'contactUrl')>2048 or item->>'contactUrl' !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$' then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
 end if;
 item:=q->'policies';
 if not platform_billing_private.exact_keys(item,array['approved','approvalId','revision','terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'])
  or item->'approved' is distinct from 'true'::jsonb or jsonb_typeof(item->'approvalId') is distinct from 'string' or not platform_billing_private.token(item->>'approvalId')
  or jsonb_typeof(item->'revision') is distinct from 'number' or (item->>'revision')::numeric not between 1 and 9007199254740991
  or trunc((item->>'revision')::numeric)<>(item->>'revision')::numeric then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
 end if;
 foreach key in array array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'] loop
  item:=q->'policies'->key;
  if not platform_billing_private.exact_keys(item,array['version','url']) or jsonb_typeof(item->'version') is distinct from 'string' or not platform_billing_private.token(item->>'version')
   or jsonb_typeof(item->'url') is distinct from 'string' or char_length(item->>'url')>2048
   or item->>'url' !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$' then
   raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
  end if;
 end loop;
 foreach key in array array['issuedAt','expiresAt'] loop
  if jsonb_typeof(q->key) is distinct from 'string' or q->>key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then
   raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
  end if;
  begin ts:=(q->>key)::timestamptz; exception when others then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end;
  if not isfinite(ts) or to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>q->>key then
   raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE';
  end if;
 end loop;
 if (q->>'expiresAt')::timestamptz <= (q->>'issuedAt')::timestamptz then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_QUOTE'; end if;
end $$;

create table platform_billing_private.scopes (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete restrict,
 product_key text not null check(platform_billing_private.token(product_key)),
 resource_id text check(resource_id is null or platform_billing_private.token(resource_id)),
 created_at timestamptz not null default clock_timestamp(), unique(id,owner_user_id,product_key)
);
create unique index platform_billing_scope_identity_idx on platform_billing_private.scopes(owner_user_id,product_key,coalesce(resource_id,''));
create table platform_billing_private.quotes (
 quote_id text primary key check(platform_billing_private.token(quote_id)), scope_id uuid not null,
 owner_user_id uuid not null references auth.users(id) on delete restrict, product_key text not null,
 resource_id text, plan_key text not null, request_id text not null, revision bigint not null,
 payload jsonb not null, issued_at timestamptz not null, expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(scope_id,owner_user_id,product_key) references platform_billing_private.scopes(id,owner_user_id,product_key) on delete restrict,
 unique(owner_user_id,product_key,request_id),
 unique(quote_id,scope_id,owner_user_id,product_key,request_id,revision),
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at),
 check(jsonb_typeof(payload)='object' and (payload->>'quoteId') is not distinct from quote_id
  and (payload#>>'{scope,ownerUserId}') is not distinct from owner_user_id::text
  and (payload#>>'{scope,productKey}') is not distinct from product_key
  and (payload#>>'{scope,resourceId}') is not distinct from resource_id
  and (payload#>>'{scope,planKey}') is not distinct from plan_key
  and (payload#>>'{scope,requestId}') is not distinct from request_id
  and (payload->>'revision')::bigint is not distinct from revision
  and (payload->>'issuedAt')::timestamptz is not distinct from issued_at
  and (payload->>'expiresAt')::timestamptz is not distinct from expires_at)
);
create index platform_billing_quote_scope_idx on platform_billing_private.quotes(scope_id);
create table platform_billing_private.attempts (
 id uuid primary key default gen_random_uuid(), scope_id uuid not null unique,
 owner_user_id uuid not null references auth.users(id) on delete restrict, product_key text not null,
 resource_id text, plan_key text not null, request_id text not null,
 quote_id text not null, quote_revision bigint not null, consent jsonb not null,
 status text not null default 'prepared' check(status in ('prepared','provider_ready','uncertain')),
 provider_idempotency_key text not null unique,
 provider_session_id text unique check(provider_session_id is null or provider_session_id ~ '^cs_test_[A-Za-z0-9]+$'),
 provider_result_hash text check(provider_result_hash is null or provider_result_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 foreign key(quote_id,scope_id,owner_user_id,product_key,request_id,quote_revision)
  references platform_billing_private.quotes(quote_id,scope_id,owner_user_id,product_key,request_id,revision) on delete restrict,
 unique(owner_user_id,product_key,request_id),
 check(provider_idempotency_key='platform-checkout-'||id::text),
 check((status='provider_ready' and provider_session_id is not null and provider_result_hash is not null)
  or (status in ('prepared','uncertain') and provider_session_id is null and provider_result_hash is null))
);
create index platform_billing_attempt_quote_idx on platform_billing_private.attempts(quote_id);

create function platform_billing_private.immutable_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'UPDATE' or tg_table_name<>'attempts' then raise exception using errcode='42501',message='PLATFORM_BILLING_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['status','provider_session_id','provider_result_hash','updated_at']) is distinct from
    (to_jsonb(old)-array['status','provider_session_id','provider_result_hash','updated_at'])
  or old.status='provider_ready'
  or new.status not in ('uncertain','provider_ready')
  or new.updated_at<old.updated_at then raise exception using errcode='42501',message='PLATFORM_BILLING_IMMUTABLE'; end if;
 return new;
end $$;
create trigger platform_billing_scope_immutable before update or delete on platform_billing_private.scopes for each row execute function platform_billing_private.immutable_guard();
create trigger platform_billing_scope_no_truncate before truncate on platform_billing_private.scopes for each statement execute function platform_billing_private.immutable_guard();
create trigger platform_billing_quote_immutable before update or delete on platform_billing_private.quotes for each row execute function platform_billing_private.immutable_guard();
create trigger platform_billing_quote_no_truncate before truncate on platform_billing_private.quotes for each statement execute function platform_billing_private.immutable_guard();
create trigger platform_billing_attempt_immutable before update or delete on platform_billing_private.attempts for each row execute function platform_billing_private.immutable_guard();
create trigger platform_billing_attempt_no_truncate before truncate on platform_billing_private.attempts for each statement execute function platform_billing_private.immutable_guard();
alter table platform_billing_private.scopes enable row level security;
alter table platform_billing_private.quotes enable row level security;
alter table platform_billing_private.attempts enable row level security;
revoke all on table platform_billing_private.scopes,platform_billing_private.quotes,platform_billing_private.attempts from public,anon,authenticated,service_role;

create function platform_billing_private.attempt_result(a platform_billing_private.attempts,p_created boolean default null) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('attempt_id',a.id,'quote_id',a.quote_id,'quote_revision',a.quote_revision,'status',a.status,
 'provider_idempotency_key',a.provider_idempotency_key,'provider_session_id',a.provider_session_id,'provider_result_hash',a.provider_result_hash)
 || case when p_created is null then '{}'::jsonb else jsonb_build_object('created',p_created) end
$$;

create function public.platform_billing_quote_save(p_actor_user_id uuid,p_quote jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_scope uuid; v_existing platform_billing_private.quotes%rowtype; v_now timestamptz;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 perform platform_billing_private.assert_quote(p_actor_user_id,p_quote);
 insert into platform_billing_private.scopes(owner_user_id,product_key,resource_id)
 values(p_actor_user_id,p_quote#>>'{scope,productKey}',p_quote#>>'{scope,resourceId}') on conflict do nothing;
 select s.id into v_scope from platform_billing_private.scopes s where s.owner_user_id=p_actor_user_id
  and s.product_key=p_quote#>>'{scope,productKey}' and s.resource_id is not distinct from p_quote#>>'{scope,resourceId}' for update;
 v_now:=clock_timestamp();
 if (p_quote->>'issuedAt')::timestamptz>v_now or (p_quote->>'expiresAt')::timestamptz<=v_now
  or (p_quote#>>'{dueNow,dueOn}')::date<(v_now at time zone 'Asia/Tokyo')::date then
  raise exception using errcode='22023',message='PLATFORM_BILLING_QUOTE_EXPIRED';
 end if;
 select * into v_existing from platform_billing_private.quotes q
 where q.quote_id=p_quote->>'quoteId' or (q.owner_user_id=p_actor_user_id and q.product_key=p_quote#>>'{scope,productKey}' and q.request_id=p_quote#>>'{scope,requestId}')
 order by q.quote_id limit 1;
 if found then
  if v_existing.owner_user_id is distinct from p_actor_user_id or v_existing.payload is distinct from p_quote then
   raise exception using errcode='23505',message='PLATFORM_BILLING_IDEMPOTENCY_CONFLICT';
  end if;
  perform 1 from platform_billing_private.quotes where quote_id=v_existing.quote_id and scope_id=v_scope for update;
  return jsonb_build_object('quote_id',v_existing.quote_id,'revision',v_existing.revision);
 end if;
 begin
  insert into platform_billing_private.quotes(quote_id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,revision,payload,issued_at,expires_at)
  values(p_quote->>'quoteId',v_scope,p_actor_user_id,p_quote#>>'{scope,productKey}',p_quote#>>'{scope,resourceId}',p_quote#>>'{scope,planKey}',p_quote#>>'{scope,requestId}',(p_quote->>'revision')::bigint,p_quote,(p_quote->>'issuedAt')::timestamptz,(p_quote->>'expiresAt')::timestamptz);
 exception when unique_violation then raise exception using errcode='23505',message='PLATFORM_BILLING_IDEMPOTENCY_CONFLICT'; end;
 return jsonb_build_object('quote_id',p_quote->>'quoteId','revision',(p_quote->>'revision')::bigint);
end $$;

create function public.platform_billing_attempt_reserve(p_actor_user_id uuid,p_quote_id text,p_consent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q platform_billing_private.quotes%rowtype; a platform_billing_private.attempts%rowtype; v_scope uuid; v_now timestamptz; v_id uuid:=gen_random_uuid();
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 select scope_id into v_scope from platform_billing_private.quotes where quote_id=p_quote_id and owner_user_id=p_actor_user_id;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into q from platform_billing_private.quotes where quote_id=p_quote_id and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 v_now:=clock_timestamp();
 if q.issued_at>v_now or q.expires_at<=v_now or (q.payload#>>'{dueNow,dueOn}')::date<(v_now at time zone 'Asia/Tokyo')::date then
  raise exception using errcode='22023',message='PLATFORM_BILLING_QUOTE_EXPIRED';
 end if;
 if not platform_billing_private.exact_keys(p_consent,array['quoteId','revision','termsVersion','accepted'])
  or p_consent->'accepted' is distinct from 'true'::jsonb
  or p_consent->'quoteId' is distinct from q.payload->'quoteId'
  or p_consent->'revision' is distinct from q.payload->'revision'
  or p_consent->'termsVersion' is distinct from q.payload#>'{policies,terms,version}' then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_CONSENT';
 end if;
 select * into a from platform_billing_private.attempts where owner_user_id=p_actor_user_id and product_key=q.product_key and request_id=q.request_id for update;
 if found then
  if a.quote_id is distinct from q.quote_id or a.quote_revision is distinct from q.revision or a.consent is distinct from p_consent
   or a.scope_id is distinct from v_scope then raise exception using errcode='23505',message='PLATFORM_BILLING_IDEMPOTENCY_CONFLICT'; end if;
  return platform_billing_private.attempt_result(a,false);
 end if;
 if exists(select 1 from platform_billing_private.attempts where scope_id=v_scope) then
  raise exception using errcode='23505',message='PLATFORM_BILLING_SCOPE_PENDING';
 end if;
 insert into platform_billing_private.attempts(id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,quote_id,quote_revision,consent,provider_idempotency_key)
 values(v_id,v_scope,p_actor_user_id,q.product_key,q.resource_id,q.plan_key,q.request_id,q.quote_id,q.revision,p_consent,'platform-checkout-'||v_id::text) returning * into a;
 return platform_billing_private.attempt_result(a,true);
end $$;

create function public.platform_billing_attempt_mark_ready(p_actor_user_id uuid,p_attempt_id uuid,p_provider_session_id text,p_provider_result_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a platform_billing_private.attempts%rowtype; v_scope uuid; v_quote text;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 if p_provider_session_id is null or p_provider_session_id !~ '^cs_test_[A-Za-z0-9]+$' or char_length(p_provider_session_id)>255
  or p_provider_result_hash is null or p_provider_result_hash !~ '^[0-9a-f]{64}$' then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_PROVIDER_RESULT';
 end if;
 select scope_id,quote_id into v_scope,v_quote from platform_billing_private.attempts where id=p_attempt_id and owner_user_id=p_actor_user_id;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id for update;
 perform 1 from platform_billing_private.quotes where quote_id=v_quote and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into a from platform_billing_private.attempts where id=p_attempt_id and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 if a.status='provider_ready' then
  if a.provider_session_id is distinct from p_provider_session_id or a.provider_result_hash is distinct from p_provider_result_hash then
   raise exception using errcode='23505',message='PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT';
  end if;
  return platform_billing_private.attempt_result(a);
 end if;
 begin
  update platform_billing_private.attempts set status='provider_ready',provider_session_id=p_provider_session_id,provider_result_hash=p_provider_result_hash,updated_at=clock_timestamp()
  where id=p_attempt_id returning * into a;
 exception when unique_violation then raise exception using errcode='23505',message='PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT'; end;
 return platform_billing_private.attempt_result(a);
end $$;

create function public.platform_billing_attempt_mark_uncertain(p_actor_user_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a platform_billing_private.attempts%rowtype; v_scope uuid; v_quote text;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 select scope_id,quote_id into v_scope,v_quote from platform_billing_private.attempts where id=p_attempt_id and owner_user_id=p_actor_user_id;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id for update;
 perform 1 from platform_billing_private.quotes where quote_id=v_quote and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into a from platform_billing_private.attempts where id=p_attempt_id and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 if a.status in ('provider_ready','uncertain') then return platform_billing_private.attempt_result(a); end if;
 update platform_billing_private.attempts set status='uncertain',updated_at=clock_timestamp() where id=p_attempt_id returning * into a;
 return platform_billing_private.attempt_result(a);
end $$;

create function public.platform_billing_quote_get(p_actor_user_id uuid,p_quote_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 select payload into q from platform_billing_private.quotes where quote_id=p_quote_id and owner_user_id=p_actor_user_id;
 return q;
end $$;

revoke all on all functions in schema platform_billing_private from public,anon,authenticated,service_role;
revoke all on function public.platform_billing_quote_save(uuid,jsonb),public.platform_billing_quote_get(uuid,text),public.platform_billing_attempt_reserve(uuid,text,jsonb),public.platform_billing_attempt_mark_ready(uuid,uuid,text,text),public.platform_billing_attempt_mark_uncertain(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.platform_billing_quote_save(uuid,jsonb),public.platform_billing_quote_get(uuid,text),public.platform_billing_attempt_reserve(uuid,text,jsonb),public.platform_billing_attempt_mark_ready(uuid,uuid,text,text),public.platform_billing_attempt_mark_uncertain(uuid,uuid) to service_role;
