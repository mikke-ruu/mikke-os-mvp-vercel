alter table public.mikkeos_implementation_items
  add column if not exists dispatcher_attempts integer not null default 0
    check (dispatcher_attempts between 0 and 10),
  add column if not exists dispatcher_claimed_at timestamptz,
  add column if not exists dispatcher_last_error text not null default '';

create table if not exists private.mikkeos_dispatcher_credentials (
  credential_key text primary key,
  secret_sha256 text not null check (secret_sha256 ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

revoke all on private.mikkeos_dispatcher_credentials from public, anon, authenticated;

create or replace function public.mikkeos_claim_next_consultation(p_worker_secret text)
returns table (
  item_id uuid,
  project_id uuid,
  app_key text,
  app_name text,
  branch_ref text,
  priority text,
  title text,
  body text,
  attempt integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1
    from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary'
      and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  update public.mikkeos_implementation_items
  set status = 'open',
      task_ref = '',
      dispatcher_claimed_at = null,
      dispatcher_last_error = '前回のdispatcherが完了通知前に停止したため再受付しました。',
      updated_at = now()
  where item_type = 'consultation'
    and status = 'in_progress'
    and task_ref like 'dispatcher:%'
    and dispatcher_claimed_at < now() - interval '90 minutes';

  select candidate.id into claimed_id
  from public.mikkeos_implementation_items candidate
  where candidate.item_type = 'consultation'
    and candidate.status = 'open'
    and candidate.archived_at is null
    and candidate.dispatcher_attempts < 3
  order by
    case candidate.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
    candidate.created_at
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  update public.mikkeos_implementation_items claimed
  set status = 'in_progress',
      dispatcher_attempts = claimed.dispatcher_attempts + 1,
      dispatcher_claimed_at = now(),
      dispatcher_last_error = '',
      task_ref = 'dispatcher:' || claimed.id::text,
      updated_at = now()
  where claimed.id = claimed_id;

  return query
  select
    item.id,
    item.project_id,
    project.app_key,
    project.app_name,
    project.branch_ref,
    item.priority,
    item.title,
    item.body,
    item.dispatcher_attempts
  from public.mikkeos_implementation_items item
  left join public.mikkeos_implementation_projects project on project.id = item.project_id
  where item.id = claimed_id;
end;
$$;

create or replace function public.mikkeos_finish_consultation(
  p_worker_secret text,
  p_item_id uuid,
  p_status text,
  p_result text default '',
  p_question text default '',
  p_evidence_ref text default '',
  p_task_ref text default '',
  p_error text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1
    from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary'
      and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  if p_status not in ('open', 'waiting_user', 'completed') then
    raise exception 'invalid dispatcher status';
  end if;

  update public.mikkeos_implementation_items item
  set status = p_status,
      result = left(coalesce(p_result, ''), 8000),
      question = left(coalesce(p_question, ''), 2000),
      evidence_ref = left(coalesce(p_evidence_ref, ''), 2000),
      task_ref = left(coalesce(nullif(p_task_ref, ''), item.task_ref), 2000),
      dispatcher_claimed_at = null,
      dispatcher_last_error = left(coalesce(p_error, ''), 2000),
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where item.id = p_item_id
    and item.item_type = 'consultation'
    and item.status = 'in_progress'
    and item.task_ref like 'dispatcher:%';

  return found;
end;
$$;

revoke all on function public.mikkeos_claim_next_consultation(text) from public, anon, authenticated;
revoke all on function public.mikkeos_finish_consultation(text, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.mikkeos_claim_next_consultation(text) to anon;
grant execute on function public.mikkeos_finish_consultation(text, uuid, text, text, text, text, text, text) to anon;
