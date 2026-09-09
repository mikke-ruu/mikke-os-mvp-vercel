-- Media Free manual retention operations.
-- This migration does not enable a release flag and does not schedule a worker.
-- All mutable operations are available only through service_role RPCs.

create table private.media_ops_operators (
  user_id uuid primary key,
  operator_name text not null check (char_length(btrim(operator_name)) between 1 and 120),
  operator_role text not null check (operator_role in ('final_decider','technical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.media_deletion_cases (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('article','site')),
  target_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  article_id uuid,
  requested_by uuid not null,
  identity_verification_ref text not null check (char_length(btrim(identity_verification_ref)) between 1 and 500),
  status text not null check (status in ('recoverable','restored','purging','purged','failed')),
  requested_at timestamptz not null default clock_timestamp(),
  recoverable_until timestamptz not null,
  purge_due_at timestamptz not null,
  public_hidden_at timestamptz not null,
  restored_at timestamptz,
  purge_prepared_at timestamptz,
  purge_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(purge_manifest)='array'),
  purged_at timestamptz,
  failure_code text,
  closed_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_kind='article' and article_id=target_id) or (target_kind='site' and article_id is null and site_id=target_id)),
  check (recoverable_until=requested_at+interval '30 days'),
  check (purge_due_at=recoverable_until)
);
create unique index media_deletion_one_open_target
  on private.media_deletion_cases(target_kind,target_id)
  where status in ('recoverable','purging','failed');
create index media_deletion_due_idx on private.media_deletion_cases(purge_due_at)
  where status in ('recoverable','failed');

create table private.media_report_cases (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null check (char_length(btrim(canonical_url)) between 1 and 2048),
  reason_category text not null check (reason_category in ('rights','privacy','impersonation','illegal','security','other')),
  evidence_ref text not null check (char_length(btrim(evidence_ref)) between 1 and 1000),
  status text not null default 'open' check (status in ('open','triage','hold_publication','owner_response','restored','removed','appealed','closed')),
  opened_by uuid not null,
  final_decider uuid,
  final_decision text,
  received_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((closed_at is null and retain_until is null) or retain_until=closed_at+interval '3 years')
);

create table private.media_holds (
  id uuid primary key default gen_random_uuid(),
  report_case_id uuid references private.media_report_cases(id) on delete restrict,
  target_kind text not null check (target_kind in ('article','site')),
  target_id uuid not null,
  site_id uuid not null,
  article_id uuid,
  hold_kind text not null check (hold_kind in ('legal','privacy','security')),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  evidence_ref text not null check (char_length(btrim(evidence_ref)) between 1 and 1000),
  status text not null default 'active' check (status in ('active','released')),
  placed_by uuid not null,
  placed_at timestamptz not null default clock_timestamp(),
  last_reviewed_by uuid,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null,
  released_by uuid,
  released_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_kind='article' and article_id=target_id) or (target_kind='site' and article_id is null and site_id=target_id)),
  check (next_review_at=coalesce(last_reviewed_at,placed_at)+interval '90 days'),
  check ((status='active' and released_at is null and released_by is null and retain_until is null)
    or (status='released' and released_at is not null and released_by is not null
      and retain_until=released_at+interval '3 years'))
);
create unique index media_hold_one_active_kind_target
  on private.media_holds(target_kind,target_id,hold_kind) where status='active';
create index media_hold_review_due_idx on private.media_holds(next_review_at) where status='active';

create table private.media_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{1,80}$'),
  owner_id uuid,
  site_id uuid,
  article_id uuid,
  report_case_id uuid,
  deletion_case_id uuid,
  actor_kind text not null check (actor_kind in ('owner','operator','system')),
  actor_id uuid,
  legal_version text,
  document_sha256 text check (document_sha256 is null or document_sha256 ~ '^[a-f0-9]{64}$'),
  revision_hash text check (revision_hash is null or revision_hash ~ '^[a-f0-9]{64}$'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  occurred_at timestamptz not null default clock_timestamp(),
  retention_anchor_at timestamptz,
  retain_until timestamptz,
  check ((retention_anchor_at is null and retain_until is null)
    or retain_until=retention_anchor_at+interval '3 years')
);
create index media_audit_owner_open_idx on private.media_audit_events(owner_id) where retain_until is null;
create index media_audit_retention_due_idx on private.media_audit_events(retain_until) where retain_until is not null;

create table private.media_operation_logs (
  id uuid primary key default gen_random_uuid(),
  log_kind text not null check (log_kind in ('access','authentication','operation','error','security')),
  owner_id uuid,
  route text not null default '' check (char_length(route)<=500),
  action text not null check (char_length(btrim(action)) between 1 and 120),
  result text not null check (char_length(btrim(result)) between 1 and 120),
  network_address inet,
  user_agent text not null default '' check (char_length(user_agent)<=1000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  occurred_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at=occurred_at+interval '90 days')
);
create index media_operation_logs_due_idx on private.media_operation_logs(expires_at);

create table private.media_retention_runs (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('daily_check','log_purge','audit_purge','content_purge','hold_review','provider_check')),
  operator_id uuid not null,
  result text not null check (result in ('ok','failed')),
  due_count integer not null default 0 check (due_count>=0),
  affected_count integer not null default 0 check (affected_count>=0),
  evidence_digest text check (evidence_digest is null or evidence_digest ~ '^[a-f0-9]{64}$'),
  note text not null default '' check (char_length(note)<=2000),
  ran_at timestamptz not null default clock_timestamp(),
  retain_until timestamptz not null default (clock_timestamp()+interval '3 years')
);

alter table private.media_ops_operators enable row level security;
alter table private.media_deletion_cases enable row level security;
alter table private.media_report_cases enable row level security;
alter table private.media_holds enable row level security;
alter table private.media_audit_events enable row level security;
alter table private.media_operation_logs enable row level security;
alter table private.media_retention_runs enable row level security;
revoke all on private.media_ops_operators,private.media_deletion_cases,private.media_report_cases,
  private.media_holds,private.media_audit_events,private.media_operation_logs,private.media_retention_runs
  from public,anon,authenticated,service_role;

alter table private.media_private_images add column site_id uuid;
update private.media_private_images p set site_id=(
  select s.id from public.media_sites s
  where s.owner_id=p.owner_id and s.publishing_policy='direct_owner'
  order by s.created_at,s.id limit 1
) where p.site_id is null;
do $$ begin
  if exists(select 1 from private.media_private_images where site_id is null) then
    raise exception 'MEDIA_PRIVATE_IMAGE_SITE_BACKFILL_REQUIRED';
  end if;
end $$;
alter table private.media_private_images alter column site_id set not null;
alter table private.media_private_images add constraint media_private_images_site_fk
  foreign key(site_id) references public.media_sites(id) on delete restrict;
create index media_private_images_site_idx on private.media_private_images(site_id);

create or replace function private.media_assign_private_image_site()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.site_id is null then
    select s.id into new.site_id from public.media_sites s
    where s.owner_id=new.owner_id and s.publishing_policy='direct_owner' and s.deleted_at is null
    order by s.created_at,s.id limit 1;
  end if;
  if new.site_id is null or not exists(
    select 1 from public.media_sites s where s.id=new.site_id and s.owner_id=new.owner_id
  ) then raise exception 'MEDIA_PRIVATE_IMAGE_SITE_REQUIRED'; end if;
  return new;
end $$;
create trigger media_private_image_assign_site before insert on private.media_private_images
for each row execute function private.media_assign_private_image_site();

create table private.media_purge_authorizations (
  transaction_id bigint not null,
  deletion_case_id uuid not null references private.media_deletion_cases(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key(transaction_id,deletion_case_id)
);
alter table private.media_purge_authorizations enable row level security;
revoke all on private.media_purge_authorizations from public,anon,authenticated,service_role;

create or replace function private.media_ops_actor_role(p_actor uuid)
returns text language sql stable security definer set search_path='' as $$
  select o.operator_role from private.media_ops_operators o
  where o.user_id=p_actor and o.is_active;
$$;

create or replace function private.media_ops_target(p_kind text,p_target uuid)
returns table(owner_id uuid,site_id uuid,article_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_kind='article' then
    return query select s.owner_id,s.id,a.id from public.media_articles a
      join public.media_sites s on s.id=a.site_id where a.id=p_target;
  elsif p_kind='site' then
    return query select s.owner_id,s.id,null::uuid from public.media_sites s where s.id=p_target;
  else
    raise exception 'MEDIA_OPS_TARGET_INVALID';
  end if;
end $$;

create or replace function private.media_ops_hide_target(p_kind text,p_target uuid,p_deleted boolean,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_site uuid; v_version uuid; r record;
begin
  select t.site_id into v_site from private.media_ops_target(p_kind,p_target) t;
  if v_site is null then raise exception 'MEDIA_OPS_TARGET_NOT_FOUND'; end if;
  if p_kind='article' then
    select current_published_version_id into v_version from public.media_articles where id=p_target for update;
    if v_version is not null then
      insert into public.media_publication_outbox(site_id,article_id,version_id,event_type)
        values(v_site,p_target,v_version,'unpublished');
    end if;
    update public.media_articles set status='unpublished',current_published_version_id=null,
      moderation_hold=case when p_deleted then moderation_hold else true end,
      deleted_at=case when p_deleted then p_at else deleted_at end,updated_at=p_at where id=p_target;
  else
    for r in select id,current_published_version_id from public.media_articles
      where site_id=p_target and current_published_version_id is not null for update loop
      insert into public.media_publication_outbox(site_id,article_id,version_id,event_type)
        values(p_target,r.id,r.current_published_version_id,'unpublished');
    end loop;
    update public.media_articles set status='unpublished',current_published_version_id=null,updated_at=p_at
      where site_id=p_target and current_published_version_id is not null;
    update public.media_sites set is_published=false,
      moderation_hold=case when p_deleted then moderation_hold else true end,
      deleted_at=case when p_deleted then p_at else deleted_at end,updated_at=p_at where id=p_target;
  end if;
end $$;

create or replace function private.media_record_terms_audit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.media_audit_events(event_type,owner_id,actor_kind,actor_id,legal_version,document_sha256,details,occurred_at)
    values('terms_accepted',new.owner_id,'owner',new.owner_id,new.terms_version,new.document_sha256,
      jsonb_build_object('acceptedAt',new.accepted_at,'documents',new.legal_documents),new.accepted_at);
  return new;
end $$;
create trigger media_terms_audit after insert or update on public.media_terms_acceptances
for each row execute function private.media_record_terms_audit();

create or replace function private.media_record_publication_audit()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.media_sites where id=new.site_id;
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,actor_kind,actor_id,revision_hash,details,occurred_at)
    values(case new.event_type when 'published' then 'article_published' else 'article_unpublished' end,
      v_owner,new.site_id,new.article_id,'owner',v_owner,new.revision_hash,
      jsonb_build_object('versionId',new.version_id,'outboxId',new.id),new.occurred_at);
  return new;
end $$;
create trigger media_publication_audit after insert on public.media_publication_outbox
for each row execute function private.media_record_publication_audit();

create or replace function private.media_version_purge_allowed(p_version uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.media_purge_authorizations x
    join private.media_deletion_cases c on c.id=x.deletion_case_id and c.status='purging'
    join public.media_article_versions v on v.id=p_version
    where x.transaction_id=txid_current()
      and ((c.target_kind='article' and v.article_id=c.article_id)
        or (c.target_kind='site' and v.site_id=c.site_id))
  );
$$;
create or replace function private.media_reject_version_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.media_version_purge_allowed(old.id) then return old; end if;
  raise exception 'MEDIA_PUBLISHED_VERSION_IMMUTABLE';
end $$;

create or replace function public.media_ops_request_removal(
  p_target_kind text,p_target_id uuid,p_actor uuid,p_identity_verification_ref text
) returns uuid language plpgsql security definer set search_path='' as $$
declare t record; v_case uuid; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  select * into t from private.media_ops_target(p_target_kind,p_target_id);
  if not found then raise exception 'MEDIA_OPS_TARGET_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('media-removal:'||p_target_kind||':'||p_target_id::text,0));
  select id into v_case from private.media_deletion_cases where target_kind=p_target_kind and target_id=p_target_id
    and status in ('recoverable','purging','failed');
  if found then return v_case; end if;
  insert into private.media_deletion_cases(target_kind,target_id,owner_id,site_id,article_id,requested_by,
    identity_verification_ref,status,requested_at,recoverable_until,purge_due_at,public_hidden_at)
    values(p_target_kind,p_target_id,t.owner_id,t.site_id,t.article_id,p_actor,btrim(p_identity_verification_ref),
      'recoverable',v_now,v_now+interval '30 days',v_now+interval '30 days',v_now) returning id into v_case;
  perform private.media_ops_hide_target(p_target_kind,p_target_id,true,v_now);
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,deletion_case_id,actor_kind,actor_id,details)
    values('deletion_requested',t.owner_id,t.site_id,t.article_id,v_case,'operator',p_actor,
      jsonb_build_object('targetKind',p_target_kind,'recoverableUntil',v_now+interval '30 days'));
  return v_case;
end $$;

create or replace function public.media_ops_restore_removal(p_case_id uuid,p_actor uuid,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare c private.media_deletion_cases%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  select * into c from private.media_deletion_cases where id=p_case_id for update;
  if not found or c.status<>'recoverable' then raise exception 'MEDIA_REMOVAL_NOT_RECOVERABLE'; end if;
  if v_now>c.recoverable_until then raise exception 'MEDIA_REMOVAL_RECOVERY_EXPIRED'; end if;
  if exists(select 1 from private.media_holds h where h.status='active'
    and ((h.target_kind=c.target_kind and h.target_id=c.target_id) or (h.target_kind='site' and h.target_id=c.site_id)))
    then raise exception 'MEDIA_REMOVAL_HOLD_ACTIVE'; end if;
  if c.target_kind='article' then
    update public.media_articles set deleted_at=null,status='unpublished',current_published_version_id=null,updated_at=v_now
      where id=c.article_id;
  else
    update public.media_sites set deleted_at=null,is_published=false,updated_at=v_now where id=c.site_id;
  end if;
  update private.media_deletion_cases set status='restored',restored_at=v_now,closed_at=v_now,retain_until=v_now+interval '3 years',
    updated_at=v_now where id=p_case_id;
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,deletion_case_id,actor_kind,actor_id,details,
    retention_anchor_at,retain_until)
    values('deletion_restored',c.owner_id,c.site_id,c.article_id,c.id,'operator',p_actor,
      jsonb_build_object('note',left(coalesce(p_note,''),2000)),v_now,v_now+interval '3 years');
end $$;

create or replace function public.media_ops_prepare_purge(p_case_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.media_deletion_cases%rowtype; v_manifest jsonb; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  select * into c from private.media_deletion_cases where id=p_case_id for update;
  if not found or c.status not in ('recoverable','failed') then raise exception 'MEDIA_PURGE_NOT_AVAILABLE'; end if;
  if v_now<c.purge_due_at then raise exception 'MEDIA_PURGE_NOT_DUE'; end if;
  if exists(select 1 from private.media_holds h where h.status='active'
    and ((h.target_kind=c.target_kind and h.target_id=c.target_id) or (h.target_kind='site' and h.target_id=c.site_id)))
    then raise exception 'MEDIA_PURGE_HOLD_ACTIVE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('assetId',p.asset_id,'bucket',p.bucket,'storagePath',a.storage_path,
    'storageObjectId',p.storage_object_id,'contentSha256',p.registered_sha256) order by p.asset_id),'[]'::jsonb)
    into v_manifest from private.media_private_images p join public.mikke_media_assets a on a.id=p.asset_id
    where p.site_id=c.site_id and (c.target_kind='site' or exists(
      select 1 from public.media_article_version_assets va join public.media_article_versions v on v.id=va.version_id
      where va.asset_id=p.asset_id and v.article_id=c.article_id))
    and not exists(
      select 1 from public.media_article_version_assets va join public.media_article_versions v on v.id=va.version_id
      join public.media_articles ar on ar.id=v.article_id
      where va.asset_id=p.asset_id and ar.id<>coalesce(c.article_id,'00000000-0000-0000-0000-000000000000'::uuid)
        and (c.target_kind='article' or ar.site_id<>c.site_id))
    and (c.target_kind='site' or not exists(
      select 1 from public.media_articles ar where ar.id<>c.article_id
        and (ar.cover_image_asset_id=p.asset_id or exists(
          select 1 from jsonb_array_elements(ar.draft_blocks) b
          where b->>'type'='image' and b->>'imageAssetId'=p.asset_id::text
        ))));
  update private.media_deletion_cases set status='purging',purge_prepared_at=v_now,purge_manifest=v_manifest,
    failure_code=null,updated_at=v_now where id=c.id;
  return v_manifest;
end $$;

create or replace function public.media_ops_complete_purge(p_case_id uuid,p_actor uuid,p_evidence_digest text)
returns void language plpgsql security definer set search_path='' as $$
declare c private.media_deletion_cases%rowtype; v_now timestamptz:=clock_timestamp(); v_asset uuid;
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  if p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$' then raise exception 'MEDIA_PURGE_EVIDENCE_REQUIRED'; end if;
  select * into c from private.media_deletion_cases where id=p_case_id for update;
  if not found or c.status<>'purging' then raise exception 'MEDIA_PURGE_NOT_PREPARED'; end if;
  if exists(select 1 from private.media_holds h where h.status='active'
    and ((h.target_kind=c.target_kind and h.target_id=c.target_id) or (h.target_kind='site' and h.target_id=c.site_id)))
    then raise exception 'MEDIA_PURGE_HOLD_ACTIVE'; end if;
  if exists(select 1 from jsonb_array_elements(c.purge_manifest) m
    join storage.objects o on o.bucket_id=m->>'bucket' and o.name=m->>'storagePath')
    then raise exception 'MEDIA_PURGE_STORAGE_REMAINS'; end if;
  insert into private.media_purge_authorizations(transaction_id,deletion_case_id) values(txid_current(),c.id);
  if c.target_kind='article' then
    delete from public.media_publication_outbox where article_id=c.article_id;
    delete from private.media_public_image_tokens t using public.media_article_versions v
      where t.version_id=v.id and v.article_id=c.article_id;
    delete from private.media_reviewed_publications r using public.media_article_versions v
      where r.version_id=v.id and v.article_id=c.article_id;
    delete from public.media_article_publication_attestations x using public.media_article_versions v
      where x.version_id=v.id and v.article_id=c.article_id;
    delete from public.media_article_version_assets x using public.media_article_versions v
      where x.version_id=v.id and v.article_id=c.article_id;
    delete from public.media_published_slugs where article_id=c.article_id;
    delete from public.media_article_versions where article_id=c.article_id;
    delete from public.media_articles where id=c.article_id;
  else
    delete from public.media_publication_outbox where site_id=c.site_id;
    delete from private.media_public_image_tokens t using public.media_article_versions v
      where t.version_id=v.id and v.site_id=c.site_id;
    delete from private.media_reviewed_publications r using public.media_article_versions v
      where r.version_id=v.id and v.site_id=c.site_id;
    delete from public.media_article_publication_attestations x using public.media_article_versions v
      where x.version_id=v.id and v.site_id=c.site_id;
    delete from public.media_article_version_assets x using public.media_article_versions v
      where x.version_id=v.id and v.site_id=c.site_id;
    delete from public.media_published_slugs where site_id=c.site_id;
    delete from public.media_article_versions where site_id=c.site_id;
    delete from public.media_articles where site_id=c.site_id;
    delete from public.media_categories where site_id=c.site_id;
  end if;
  for v_asset in select (m->>'assetId')::uuid from jsonb_array_elements(c.purge_manifest) m loop
    delete from private.media_private_images where asset_id=v_asset;
    delete from public.mikke_media_assets where id=v_asset;
  end loop;
  if c.target_kind='site' then delete from public.media_sites where id=c.site_id; end if;
  delete from private.media_purge_authorizations
    where transaction_id=txid_current() and deletion_case_id=c.id;
  update private.media_deletion_cases set status='purged',purged_at=v_now,closed_at=v_now,retain_until=v_now+interval '3 years',
    updated_at=v_now where id=c.id;
  update private.media_audit_events set retention_anchor_at=v_now,retain_until=v_now+interval '3 years'
    where retain_until is null and c.target_kind='site'
      and (site_id=c.site_id or (site_id is null and owner_id=c.owner_id));
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,deletion_case_id,actor_kind,actor_id,details,
    retention_anchor_at,retain_until)
    values('content_purged',c.owner_id,c.site_id,c.article_id,c.id,'operator',p_actor,
      jsonb_build_object('evidenceDigest',p_evidence_digest,'storageObjectCount',jsonb_array_length(c.purge_manifest)),
      v_now,v_now+interval '3 years');
  insert into private.media_retention_runs(run_kind,operator_id,result,due_count,affected_count,evidence_digest)
    values('content_purge',p_actor,'ok',1,1,p_evidence_digest);
end $$;

create or replace function public.media_ops_open_report(
  p_canonical_url text,p_reason_category text,p_evidence_ref text,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  insert into private.media_report_cases(canonical_url,reason_category,evidence_ref,opened_by)
    values(btrim(p_canonical_url),p_reason_category,btrim(p_evidence_ref),p_actor) returning id into v_id;
  insert into private.media_audit_events(event_type,report_case_id,actor_kind,actor_id,details)
    values('report_opened',v_id,'operator',p_actor,jsonb_build_object('reasonCategory',p_reason_category));
  return v_id;
end $$;

create or replace function public.media_ops_apply_hold(
  p_report_case_id uuid,p_target_kind text,p_target_id uuid,p_hold_kind text,p_reason text,p_evidence_ref text,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare t record; v_id uuid; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  if p_report_case_id is not null and not exists(select 1 from private.media_report_cases where id=p_report_case_id)
    then raise exception 'MEDIA_REPORT_CASE_NOT_FOUND'; end if;
  select * into t from private.media_ops_target(p_target_kind,p_target_id);
  if not found then raise exception 'MEDIA_OPS_TARGET_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('media-hold:'||p_target_kind||':'||p_target_id::text,0));
  insert into private.media_holds(report_case_id,target_kind,target_id,site_id,article_id,hold_kind,reason,evidence_ref,
    placed_by,placed_at,next_review_at) values(p_report_case_id,p_target_kind,p_target_id,t.site_id,t.article_id,p_hold_kind,
      btrim(p_reason),btrim(p_evidence_ref),p_actor,v_now,v_now+interval '90 days') returning id into v_id;
  perform private.media_ops_hide_target(p_target_kind,p_target_id,false,v_now);
  if p_report_case_id is not null then update private.media_report_cases set status='hold_publication',updated_at=v_now where id=p_report_case_id; end if;
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,report_case_id,actor_kind,actor_id,details)
    values('hold_applied',t.owner_id,t.site_id,t.article_id,p_report_case_id,'operator',p_actor,
      jsonb_build_object('holdId',v_id,'holdKind',p_hold_kind,'nextReviewAt',v_now+interval '90 days'));
  return v_id;
end $$;

create or replace function public.media_ops_review_hold(p_hold_id uuid,p_decision text,p_note text,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare h private.media_holds%rowtype; v_now timestamptz:=clock_timestamp(); v_owner uuid;
begin
  if private.media_ops_actor_role(p_actor)<>'final_decider' then raise exception 'MEDIA_FINAL_DECIDER_REQUIRED'; end if;
  if p_decision not in ('continue','release') then raise exception 'MEDIA_HOLD_DECISION_INVALID'; end if;
  select * into h from private.media_holds where id=p_hold_id for update;
  if not found or h.status<>'active' then raise exception 'MEDIA_HOLD_NOT_ACTIVE'; end if;
  select owner_id into v_owner from private.media_ops_target(h.target_kind,h.target_id);
  if p_decision='continue' then
    update private.media_holds set last_reviewed_by=p_actor,last_reviewed_at=v_now,next_review_at=v_now+interval '90 days',
      updated_at=v_now where id=h.id;
  else
    update private.media_holds set status='released',last_reviewed_by=p_actor,last_reviewed_at=v_now,
      next_review_at=v_now+interval '90 days',released_by=p_actor,released_at=v_now,
      retain_until=v_now+interval '3 years',updated_at=v_now where id=h.id;
    if h.target_kind='article' then
      update public.media_articles set moderation_hold=false,status='unpublished',current_published_version_id=null,updated_at=v_now
        where id=h.article_id;
    else
      update public.media_sites set moderation_hold=false,is_published=false,updated_at=v_now where id=h.site_id;
    end if;
  end if;
  insert into private.media_audit_events(event_type,owner_id,site_id,article_id,report_case_id,actor_kind,actor_id,details)
    values('hold_'||p_decision,v_owner,h.site_id,h.article_id,h.report_case_id,'operator',p_actor,
      jsonb_build_object('holdId',h.id,'note',left(coalesce(p_note,''),2000)));
  insert into private.media_retention_runs(run_kind,operator_id,result,due_count,affected_count,note)
    values('hold_review',p_actor,'ok',1,1,left(coalesce(p_note,''),2000));
end $$;

create or replace function public.media_ops_close_report(
  p_report_case_id uuid,p_decision text,p_final_status text,p_actor uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor)<>'final_decider' then raise exception 'MEDIA_FINAL_DECIDER_REQUIRED'; end if;
  if p_final_status not in ('restored','removed','closed') then raise exception 'MEDIA_REPORT_STATUS_INVALID'; end if;
  update private.media_report_cases set status=p_final_status,final_decider=p_actor,final_decision=left(p_decision,2000),
    closed_at=v_now,retain_until=v_now+interval '3 years',updated_at=v_now
    where id=p_report_case_id and closed_at is null;
  if not found then raise exception 'MEDIA_REPORT_CASE_NOT_OPEN'; end if;
  update private.media_audit_events set retention_anchor_at=v_now,retain_until=v_now+interval '3 years'
    where report_case_id=p_report_case_id and retain_until is null;
  insert into private.media_audit_events(event_type,report_case_id,actor_kind,actor_id,details,retention_anchor_at,retain_until)
    values('report_closed',p_report_case_id,'operator',p_actor,jsonb_build_object('decision',left(p_decision,2000)),
      v_now,v_now+interval '3 years');
end $$;

create or replace function public.media_ops_write_log(
  p_log_kind text,p_owner_id uuid,p_route text,p_action text,p_result text,p_network_address inet,
  p_user_agent text,p_details jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_now timestamptz:=clock_timestamp();
begin
  insert into private.media_operation_logs(log_kind,owner_id,route,action,result,network_address,user_agent,details,occurred_at,expires_at)
    values(p_log_kind,p_owner_id,coalesce(p_route,''),p_action,p_result,p_network_address,coalesce(p_user_agent,''),
      coalesce(p_details,'{}'::jsonb),v_now,v_now+interval '90 days') returning id into v_id;
  return v_id;
end $$;

create or replace function public.media_ops_purge_expired_logs(p_actor uuid,p_evidence_digest text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  if p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$' then raise exception 'MEDIA_OPS_EVIDENCE_REQUIRED'; end if;
  delete from private.media_operation_logs where expires_at<=v_now;
  get diagnostics v_count=row_count;
  insert into private.media_retention_runs(run_kind,operator_id,result,due_count,affected_count,evidence_digest)
    values('log_purge',p_actor,'ok',v_count,v_count,p_evidence_digest);
  return v_count;
end $$;

create or replace function public.media_ops_daily_check(p_actor uuid,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_delete integer; v_logs integer; v_holds integer;
begin
  if private.media_ops_actor_role(p_actor) is null then raise exception 'MEDIA_OPS_ACTOR_REQUIRED'; end if;
  select count(*) into v_delete from private.media_deletion_cases where status in ('recoverable','failed') and purge_due_at<=v_now;
  select count(*) into v_logs from private.media_operation_logs where expires_at<=v_now;
  select count(*) into v_holds from private.media_holds where status='active' and next_review_at<=v_now;
  insert into private.media_retention_runs(run_kind,operator_id,result,due_count,affected_count,note)
    values('daily_check',p_actor,'ok',v_delete+v_logs+v_holds,0,left(coalesce(p_note,''),2000));
  return jsonb_build_object('deletionsDue',v_delete,'logsDue',v_logs,'holdsOverdue',v_holds,'checkedAt',v_now);
end $$;

create or replace function public.media_ops_anchor_owner_audit(p_owner_id uuid,p_actor uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor)<>'final_decider' then raise exception 'MEDIA_FINAL_DECIDER_REQUIRED'; end if;
  update private.media_audit_events set retention_anchor_at=v_now,retain_until=v_now+interval '3 years'
    where owner_id=p_owner_id and retain_until is null;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.media_ops_purge_expired_audit(p_actor uuid,p_evidence_digest text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_part integer; v_now timestamptz:=clock_timestamp();
begin
  if private.media_ops_actor_role(p_actor)<>'final_decider' then raise exception 'MEDIA_FINAL_DECIDER_REQUIRED'; end if;
  if p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$' then raise exception 'MEDIA_OPS_EVIDENCE_REQUIRED'; end if;
  delete from private.media_audit_events a where a.retain_until<=v_now and not exists(
    select 1 from private.media_holds h where h.status='active'
      and (h.report_case_id=a.report_case_id or h.site_id=a.site_id or (h.article_id is not null and h.article_id=a.article_id)));
  get diagnostics v_count=row_count;
  delete from private.media_holds where status='released' and retain_until<=v_now;
  get diagnostics v_part=row_count; v_count:=v_count+v_part;
  delete from private.media_report_cases r where r.retain_until<=v_now
    and not exists(select 1 from private.media_holds h where h.report_case_id=r.id);
  get diagnostics v_part=row_count; v_count:=v_count+v_part;
  delete from private.media_deletion_cases where retain_until<=v_now;
  get diagnostics v_part=row_count; v_count:=v_count+v_part;
  delete from private.media_retention_runs where retain_until<=v_now;
  get diagnostics v_part=row_count; v_count:=v_count+v_part;
  insert into private.media_retention_runs(run_kind,operator_id,result,due_count,affected_count,evidence_digest)
    values('audit_purge',p_actor,'ok',v_count,v_count,p_evidence_digest);
  return v_count;
end $$;

revoke execute on function private.media_ops_actor_role(uuid),private.media_ops_target(text,uuid),
  private.media_ops_hide_target(text,uuid,boolean,timestamptz),private.media_record_terms_audit(),
  private.media_record_publication_audit(),private.media_version_purge_allowed(uuid),private.media_assign_private_image_site(),
  public.media_ops_request_removal(text,uuid,uuid,text),public.media_ops_restore_removal(uuid,uuid,text),
  public.media_ops_prepare_purge(uuid,uuid),public.media_ops_complete_purge(uuid,uuid,text),
  public.media_ops_open_report(text,text,text,uuid),public.media_ops_apply_hold(uuid,text,uuid,text,text,text,uuid),
  public.media_ops_review_hold(uuid,text,text,uuid),public.media_ops_close_report(uuid,text,text,uuid),
  public.media_ops_write_log(text,uuid,text,text,text,inet,text,jsonb),
  public.media_ops_purge_expired_logs(uuid,text),public.media_ops_daily_check(uuid,text),
  public.media_ops_anchor_owner_audit(uuid,uuid),public.media_ops_purge_expired_audit(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.media_ops_request_removal(text,uuid,uuid,text),
  public.media_ops_restore_removal(uuid,uuid,text),public.media_ops_prepare_purge(uuid,uuid),
  public.media_ops_complete_purge(uuid,uuid,text),public.media_ops_open_report(text,text,text,uuid),
  public.media_ops_apply_hold(uuid,text,uuid,text,text,text,uuid),public.media_ops_review_hold(uuid,text,text,uuid),
  public.media_ops_close_report(uuid,text,text,uuid),public.media_ops_write_log(text,uuid,text,text,text,inet,text,jsonb),
  public.media_ops_purge_expired_logs(uuid,text),public.media_ops_daily_check(uuid,text),
  public.media_ops_anchor_owner_audit(uuid,uuid),public.media_ops_purge_expired_audit(uuid,text)
  to service_role;
