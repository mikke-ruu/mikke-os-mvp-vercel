alter table public.mikkeos_implementation_messages
  add column if not exists response_summary text not null default '',
  add column if not exists response_detail jsonb not null default '{}'::jsonb;

alter table public.mikkeos_implementation_messages
  drop constraint if exists mikkeos_implementation_messages_response_detail_check;
alter table public.mikkeos_implementation_messages
  add constraint mikkeos_implementation_messages_response_detail_check
  check (jsonb_typeof(response_detail) = 'object' and pg_column_size(response_detail) <= 65536);

alter table public.mikkeos_implementation_items
  add column if not exists local_path text not null default '',
  add column if not exists local_branch text not null default '',
  add column if not exists local_head text not null default '',
  add column if not exists changed_files jsonb not null default '[]'::jsonb,
  add column if not exists preview_status text not null default 'not_started',
  add column if not exists preview_requested_action text not null default '',
  add column if not exists preview_url text not null default '',
  add column if not exists preview_port integer,
  add column if not exists preview_note text not null default '',
  add column if not exists preview_error text not null default '',
  add column if not exists preview_requested_at timestamptz,
  add column if not exists preview_started_at timestamptz;

alter table public.mikkeos_implementation_items
  drop constraint if exists mikkeos_implementation_items_changed_files_check,
  drop constraint if exists mikkeos_implementation_items_preview_status_check,
  drop constraint if exists mikkeos_implementation_items_preview_action_check,
  drop constraint if exists mikkeos_implementation_items_preview_port_check;
alter table public.mikkeos_implementation_items
  add constraint mikkeos_implementation_items_changed_files_check
    check (jsonb_typeof(changed_files) = 'array' and pg_column_size(changed_files) <= 32768),
  add constraint mikkeos_implementation_items_preview_status_check
    check (preview_status in ('not_started', 'queued', 'preparing', 'starting', 'ready', 'stale', 'stopping', 'stopped', 'failed')),
  add constraint mikkeos_implementation_items_preview_action_check
    check (preview_requested_action in ('', 'start', 'stop')),
  add constraint mikkeos_implementation_items_preview_port_check
    check (preview_port is null or preview_port between 3000 and 3999);

create index if not exists mikkeos_implementation_items_preview_queue_idx
  on public.mikkeos_implementation_items (preview_requested_at)
  where preview_status in ('queued', 'stopping') and archived_at is null;

create or replace function public.mikkeos_request_local_preview(
  p_item_id uuid,
  p_action text default 'start'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = caller_id
      and staff.is_active and staff.role in ('owner', 'admin')
  ) then
    raise exception 'HQ owner or admin access required' using errcode = '42501';
  end if;

  if p_action not in ('start', 'stop') then
    raise exception 'invalid preview action' using errcode = '22023';
  end if;

  update public.mikkeos_implementation_items item
  set preview_status = case when p_action = 'start' then 'queued' else 'stopping' end,
      preview_requested_action = p_action,
      preview_note = case when p_action = 'start' then 'ローカルUIの起動を受け付けました。' else 'ローカルUIの停止を受け付けました。' end,
      preview_error = '',
      preview_requested_at = now(),
      updated_by = caller_id,
      updated_at = now()
  where item.id = p_item_id
    and item.item_type = 'local_result'
    and item.archived_at is null
    and (p_action = 'stop' or item.local_path <> '');

  if not found then
    raise exception 'previewable local result not found' using errcode = '22023';
  end if;
  return true;
end;
$$;

create or replace function public.mikkeos_claim_local_preview(p_worker_secret text)
returns table (
  item_id uuid,
  project_id uuid,
  app_key text,
  local_path text,
  local_branch text,
  local_head text,
  requested_action text,
  current_url text,
  current_port integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary'
      and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  select item.id into claimed_id
  from public.mikkeos_implementation_items item
  where item.item_type = 'local_result'
    and item.archived_at is null
    and item.preview_status in ('queued', 'stopping')
  order by item.preview_requested_at asc nulls last
  for update skip locked
  limit 1;

  if claimed_id is null then return; end if;

  update public.mikkeos_implementation_items item
  set preview_status = case when item.preview_requested_action = 'stop' then 'stopping' else 'preparing' end,
      preview_note = case when item.preview_requested_action = 'stop' then 'ローカルUIを停止しています。' else '依存関係と起動環境を準備しています。' end,
      updated_at = now()
  where item.id = claimed_id;

  return query
  select item.id, item.project_id, coalesce(project.app_key, ''), item.local_path,
         item.local_branch, item.local_head, item.preview_requested_action,
         item.preview_url, item.preview_port
  from public.mikkeos_implementation_items item
  left join public.mikkeos_implementation_projects project on project.id = item.project_id
  where item.id = claimed_id;
end;
$$;

create or replace function public.mikkeos_finish_local_preview(
  p_worker_secret text,
  p_item_id uuid,
  p_status text,
  p_url text default '',
  p_port integer default null,
  p_note text default '',
  p_error text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  prior_url text;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary'
      and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;
  if p_status not in ('starting', 'ready', 'stopped', 'failed')
    or (p_port is not null and p_port not between 3000 and 3999) then
    raise exception 'invalid preview result' using errcode = '22023';
  end if;

  select item.project_id, item.preview_url into target_project_id, prior_url
  from public.mikkeos_implementation_items item
  where item.id = p_item_id and item.item_type = 'local_result'
  for update;
  if not found then return false; end if;

  update public.mikkeos_implementation_items
  set preview_status = p_status,
      preview_requested_action = '',
      preview_url = case when p_status in ('starting', 'ready') then left(coalesce(p_url, ''), 500) else '' end,
      preview_port = case when p_status in ('starting', 'ready') then p_port else null end,
      preview_note = left(coalesce(p_note, ''), 500),
      preview_error = left(coalesce(p_error, ''), 2000),
      preview_started_at = case when p_status = 'ready' then coalesce(preview_started_at, now()) when p_status in ('stopped', 'failed') then null else preview_started_at end,
      updated_at = now()
  where id = p_item_id;

  if p_status = 'ready' and target_project_id is not null then
    update public.mikkeos_implementation_projects
    set local_verify_url = left(coalesce(p_url, ''), 500), updated_at = now()
    where id = target_project_id;
  elsif p_status in ('stopped', 'failed') and target_project_id is not null then
    update public.mikkeos_implementation_projects
    set local_verify_url = '' , updated_at = now()
    where id = target_project_id and local_verify_url = prior_url;
  end if;
  return true;
end;
$$;

create or replace function public.mikkeos_record_conversation_detail(
  p_worker_secret text,
  p_user_message_id uuid,
  p_summary text default '',
  p_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  assistant_message_id uuid;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary'
      and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;
  if jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_detail, '{}'::jsonb)) > 65536 then
    raise exception 'invalid response detail' using errcode = '22023';
  end if;

  select response.id into assistant_message_id
  from public.mikkeos_implementation_messages source
  join public.mikkeos_implementation_messages response
    on response.conversation_id = source.conversation_id
   and response.role = 'assistant'
   and response.created_at >= source.created_at
  where source.id = p_user_message_id and source.role = 'user'
  order by response.created_at desc
  limit 1;
  if assistant_message_id is null then return false; end if;

  update public.mikkeos_implementation_messages
  set response_summary = left(coalesce(p_summary, ''), 1000),
      response_detail = coalesce(p_detail, '{}'::jsonb),
      updated_at = now()
  where id = assistant_message_id;
  return true;
end;
$$;

revoke all on function public.mikkeos_request_local_preview(uuid, text) from public, anon;
grant execute on function public.mikkeos_request_local_preview(uuid, text) to authenticated;

revoke all on function public.mikkeos_claim_local_preview(text) from public, anon, authenticated;
revoke all on function public.mikkeos_finish_local_preview(text, uuid, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.mikkeos_record_conversation_detail(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.mikkeos_claim_local_preview(text) to anon;
grant execute on function public.mikkeos_finish_local_preview(text, uuid, text, text, integer, text, text) to anon;
grant execute on function public.mikkeos_record_conversation_detail(text, uuid, text, jsonb) to anon;

create or replace function public.mikkeos_sync_local_inventory(
  p_worker_secret text,
  p_snapshots jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  target_project_id uuid;
  changed_count integer := 0;
  stable_key text;
  snapshot_files jsonb;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary' and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  if jsonb_typeof(coalesce(p_snapshots, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_snapshots, '[]'::jsonb)) > 80 then
    raise exception 'invalid inventory payload' using errcode = '22023';
  end if;

  for snapshot in select value from jsonb_array_elements(coalesce(p_snapshots, '[]'::jsonb))
  loop
    select id into target_project_id
    from public.mikkeos_implementation_projects
    where app_key = snapshot->>'app_key' and archived_at is null;
    if target_project_id is null then continue; end if;

    snapshot_files := case
      when jsonb_typeof(snapshot->'changed_files') = 'array' then snapshot->'changed_files'
      else '[]'::jsonb
    end;
    stable_key := 'worktree:' || left(encode(extensions.digest(
      coalesce(snapshot->>'branch', '') || '|' || coalesce(snapshot->>'path', ''), 'sha256'
    ), 'hex'), 48);

    insert into public.mikkeos_implementation_items as current_item (
      project_id, item_type, status, priority, title, result, evidence_ref, inventory_key,
      local_path, local_branch, local_head, changed_files
    ) values (
      target_project_id,
      'local_result',
      case when coalesce((snapshot->>'dirty')::boolean, false) then 'in_progress' else 'completed' end,
      'normal',
      left(case when coalesce((snapshot->>'dirty')::boolean, false) then 'ローカル作業中: ' else 'ローカルコミット済み: ' end || coalesce(snapshot->>'branch', 'detached'), 160),
      left(coalesce(snapshot->>'summary', ''), 8000),
      left('branch=' || coalesce(snapshot->>'branch', '') || ' / head=' || coalesce(snapshot->>'head', '') || ' / path=' || coalesce(snapshot->>'path', ''), 2000),
      stable_key,
      left(coalesce(snapshot->>'path', ''), 1000),
      left(coalesce(snapshot->>'branch', ''), 500),
      left(coalesce(snapshot->>'head', ''), 100),
      snapshot_files
    )
    on conflict (inventory_key) where inventory_key <> '' and archived_at is null do update
    set status = excluded.status,
        title = excluded.title,
        result = excluded.result,
        evidence_ref = excluded.evidence_ref,
        local_path = excluded.local_path,
        local_branch = excluded.local_branch,
        local_head = excluded.local_head,
        changed_files = excluded.changed_files,
        updated_at = now();

    update public.mikkeos_implementation_projects
    set local_state = case when coalesce((snapshot->>'dirty')::boolean, false) then 'in_progress' else 'implemented' end,
        local_evidence_ref = left('branch=' || coalesce(snapshot->>'branch', '') || ' / head=' || coalesce(snapshot->>'head', '') || ' / path=' || coalesce(snapshot->>'path', ''), 2000),
        branch_ref = coalesce(nullif(snapshot->>'branch', ''), branch_ref),
        updated_at = now()
    where id = target_project_id;
    changed_count := changed_count + 1;
  end loop;

  return changed_count;
end;
$$;
