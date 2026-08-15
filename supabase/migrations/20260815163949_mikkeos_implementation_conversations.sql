create table public.mikkeos_implementation_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.mikkeos_implementation_projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  status text not null default 'active'
    check (status in ('active', 'queued', 'responding', 'executing', 'waiting_user', 'archived')),
  codex_thread_id text not null default '' check (char_length(codex_thread_id) <= 200),
  branch_ref text not null default '' check (char_length(branch_ref) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_response_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mikkeos_implementation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mikkeos_implementation_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  mode text not null default 'discussion' check (mode in ('discussion', 'execution')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  content text not null check (char_length(trim(content)) between 1 and 12000),
  evidence_ref text not null default '' check (char_length(evidence_ref) <= 4000),
  dispatcher_attempts integer not null default 0 check (dispatcher_attempts between 0 and 10),
  dispatcher_claimed_at timestamptz,
  dispatcher_last_error text not null default '' check (char_length(dispatcher_last_error) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mikkeos_implementation_conversations_project_recent_idx
  on public.mikkeos_implementation_conversations(project_id, last_message_at desc)
  where archived_at is null;

create index mikkeos_implementation_messages_conversation_recent_idx
  on public.mikkeos_implementation_messages(conversation_id, created_at);

create index mikkeos_implementation_messages_pending_idx
  on public.mikkeos_implementation_messages(created_at)
  where role = 'user' and status = 'pending';

create unique index mikkeos_implementation_messages_one_active_user_turn_idx
  on public.mikkeos_implementation_messages(conversation_id)
  where role = 'user' and status in ('pending', 'in_progress');

alter table public.mikkeos_implementation_conversations enable row level security;
alter table public.mikkeos_implementation_messages enable row level security;

create policy "HQ owners read implementation conversations"
on public.mikkeos_implementation_conversations for select to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin')
));

create policy "HQ owners read implementation messages"
on public.mikkeos_implementation_messages for select to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin')
));

create policy "HQ owners create implementation conversations"
on public.mikkeos_implementation_conversations for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin')
  )
);

create policy "HQ owners update implementation conversation activity"
on public.mikkeos_implementation_conversations for update to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin')
))
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin')
  )
);

create policy "HQ owners create user implementation messages"
on public.mikkeos_implementation_messages for insert to authenticated
with check (
  role = 'user'
  and status = 'pending'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.mikkeos_implementation_conversations conversation
    where conversation.id = conversation_id
      and conversation.archived_at is null
  )
);

revoke all on public.mikkeos_implementation_conversations, public.mikkeos_implementation_messages
  from public, anon, authenticated;
grant select on public.mikkeos_implementation_conversations, public.mikkeos_implementation_messages
  to authenticated;
grant insert (project_id, title, status, created_by, updated_by)
  on public.mikkeos_implementation_conversations to authenticated;
grant update (status, updated_by, last_message_at, updated_at)
  on public.mikkeos_implementation_conversations to authenticated;
grant insert (conversation_id, role, mode, status, content, created_by)
  on public.mikkeos_implementation_messages to authenticated;

create or replace function public.mikkeos_start_implementation_conversation(
  p_project_id uuid,
  p_title text,
  p_content text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_conversation_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = caller_id
      and staff.is_active
      and staff.role in ('owner', 'admin')
  ) then
    raise exception 'HQ owner or admin access required' using errcode = '42501';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.mikkeos_implementation_projects project
    where project.id = p_project_id and project.archived_at is null
  ) then
    raise exception 'implementation project not found' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160
    or char_length(trim(coalesce(p_content, ''))) not between 1 and 12000 then
    raise exception 'invalid conversation content' using errcode = '22023';
  end if;

  insert into public.mikkeos_implementation_conversations (
    project_id, title, status, created_by, updated_by
  ) values (
    p_project_id, trim(p_title), 'queued', caller_id, caller_id
  ) returning id into new_conversation_id;

  insert into public.mikkeos_implementation_messages (
    conversation_id, role, mode, status, content, created_by
  ) values (
    new_conversation_id, 'user', 'discussion', 'pending', trim(p_content), caller_id
  );

  return new_conversation_id;
end;
$$;

create or replace function public.mikkeos_send_implementation_message(
  p_conversation_id uuid,
  p_mode text,
  p_content text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_message_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = caller_id
      and staff.is_active
      and staff.role in ('owner', 'admin')
  ) then
    raise exception 'HQ owner or admin access required' using errcode = '42501';
  end if;

  if p_mode not in ('discussion', 'execution')
    or char_length(trim(coalesce(p_content, ''))) not between 1 and 12000 then
    raise exception 'invalid message content' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.mikkeos_implementation_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.archived_at is null
  ) then
    raise exception 'active conversation not found' using errcode = '22023';
  end if;

  insert into public.mikkeos_implementation_messages (
    conversation_id, role, mode, status, content, created_by
  ) values (
    p_conversation_id, 'user', p_mode, 'pending', trim(p_content), caller_id
  ) returning id into new_message_id;

  update public.mikkeos_implementation_conversations
  set status = 'queued',
      updated_by = caller_id,
      last_message_at = now(),
      updated_at = now()
  where id = p_conversation_id;

  return new_message_id;
exception
  when unique_violation then
    raise exception 'Codexの返答を待ってから次のメッセージを送ってください。' using errcode = '55000';
end;
$$;

create or replace function public.mikkeos_claim_next_conversation_message(p_worker_secret text)
returns table (
  message_id uuid,
  conversation_id uuid,
  conversation_title text,
  message_mode text,
  message_content text,
  attempt integer,
  codex_thread_id text,
  app_key text,
  app_name text,
  source_branch text,
  project_snapshot jsonb,
  gate_snapshot jsonb,
  visible_history jsonb
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

  update public.mikkeos_implementation_messages message
  set status = 'pending',
      dispatcher_claimed_at = null,
      dispatcher_last_error = '前回のdispatcherが応答保存前に停止したため再受付しました。',
      updated_at = now()
  where message.role = 'user'
    and message.status = 'in_progress'
    and message.dispatcher_claimed_at < now() - interval '90 minutes';

  update public.mikkeos_implementation_conversations conversation
  set status = 'queued', updated_at = now()
  where exists (
    select 1 from public.mikkeos_implementation_messages message
    where message.conversation_id = conversation.id
      and message.role = 'user'
      and message.status = 'pending'
  ) and conversation.status in ('responding', 'executing');

  select candidate.id into claimed_id
  from public.mikkeos_implementation_messages candidate
  join public.mikkeos_implementation_conversations conversation
    on conversation.id = candidate.conversation_id
  where candidate.role = 'user'
    and candidate.status = 'pending'
    and candidate.dispatcher_attempts < 3
    and conversation.archived_at is null
  order by candidate.created_at
  for update of candidate skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  update public.mikkeos_implementation_messages claimed
  set status = 'in_progress',
      dispatcher_attempts = claimed.dispatcher_attempts + 1,
      dispatcher_claimed_at = now(),
      dispatcher_last_error = '',
      updated_at = now()
  where claimed.id = claimed_id;

  update public.mikkeos_implementation_conversations conversation
  set status = case message.mode when 'execution' then 'executing' else 'responding' end,
      updated_at = now()
  from public.mikkeos_implementation_messages message
  where message.id = claimed_id and conversation.id = message.conversation_id;

  return query
  select
    message.id,
    conversation.id,
    conversation.title,
    message.mode,
    message.content,
    message.dispatcher_attempts,
    conversation.codex_thread_id,
    coalesce(project.app_key, 'mikkeos'),
    coalesce(project.app_name, 'mikkeOS全体'),
    coalesce(nullif(project.branch_ref, ''), 'master'),
    jsonb_build_object(
      'status', project.status,
      'phase', project.phase,
      'current_focus', project.current_focus,
      'public_state', project.public_state,
      'verification_note', project.verification_note,
      'verify_path', project.verify_path,
      'branch_ref', project.branch_ref
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'gate', gate.gate_key,
        'status', gate.status,
        'summary', gate.summary,
        'evidence_ref', gate.evidence_ref
      ) order by gate.gate_key)
      from public.mikkeos_implementation_gates gate
      where gate.project_id = conversation.project_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', history.role,
        'mode', history.mode,
        'content', history.content,
        'created_at', history.created_at
      ) order by history.created_at)
      from (
        select prior.role, prior.mode, prior.content, prior.created_at
        from public.mikkeos_implementation_messages prior
        where prior.conversation_id = conversation.id
          and prior.id <> message.id
          and prior.status = 'completed'
        order by prior.created_at desc
        limit 30
      ) history
    ), '[]'::jsonb)
  from public.mikkeos_implementation_messages message
  join public.mikkeos_implementation_conversations conversation
    on conversation.id = message.conversation_id
  left join public.mikkeos_implementation_projects project
    on project.id = conversation.project_id
  where message.id = claimed_id;
end;
$$;

create or replace function public.mikkeos_finish_conversation_message(
  p_worker_secret text,
  p_message_id uuid,
  p_status text,
  p_reply text default '',
  p_evidence_ref text default '',
  p_codex_thread_id text default '',
  p_branch_ref text default '',
  p_error text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_conversation_id uuid;
  target_mode text;
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

  if p_status not in ('active', 'waiting_user', 'retry', 'failed') then
    raise exception 'invalid conversation dispatcher status' using errcode = '22023';
  end if;

  select message.conversation_id, message.mode
  into target_conversation_id, target_mode
  from public.mikkeos_implementation_messages message
  where message.id = p_message_id
    and message.role = 'user'
    and message.status = 'in_progress'
  for update;

  if target_conversation_id is null then
    return false;
  end if;

  if p_status = 'retry' then
    update public.mikkeos_implementation_messages
    set status = 'pending',
        dispatcher_claimed_at = null,
        dispatcher_last_error = left(coalesce(p_error, ''), 2000),
        updated_at = now()
    where id = p_message_id;

    update public.mikkeos_implementation_conversations
    set status = 'queued', updated_at = now()
    where id = target_conversation_id;
    return true;
  end if;

  update public.mikkeos_implementation_messages
  set status = case when p_status = 'failed' then 'failed' else 'completed' end,
      dispatcher_claimed_at = null,
      dispatcher_last_error = left(coalesce(p_error, ''), 2000),
      updated_at = now()
  where id = p_message_id;

  insert into public.mikkeos_implementation_messages (
    conversation_id, role, mode, status, content, evidence_ref
  ) values (
    target_conversation_id,
    'assistant',
    target_mode,
    case when p_status = 'failed' then 'failed' else 'completed' end,
    left(coalesce(nullif(trim(p_reply), ''), '応答を完了できませんでした。'), 12000),
    left(coalesce(p_evidence_ref, ''), 4000)
  );

  update public.mikkeos_implementation_conversations
  set status = case when p_status = 'waiting_user' then 'waiting_user' else 'active' end,
      codex_thread_id = left(coalesce(nullif(p_codex_thread_id, ''), codex_thread_id), 200),
      branch_ref = left(coalesce(nullif(p_branch_ref, ''), branch_ref), 300),
      last_response_at = now(),
      last_message_at = now(),
      updated_at = now()
  where id = target_conversation_id;

  return true;
end;
$$;

revoke all on function public.mikkeos_start_implementation_conversation(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.mikkeos_send_implementation_message(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.mikkeos_claim_next_conversation_message(text)
  from public, anon, authenticated;
revoke all on function public.mikkeos_finish_conversation_message(text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.mikkeos_start_implementation_conversation(uuid, text, text)
  to authenticated;
grant execute on function public.mikkeos_send_implementation_message(uuid, text, text)
  to authenticated;
grant execute on function public.mikkeos_claim_next_conversation_message(text)
  to anon;
grant execute on function public.mikkeos_finish_conversation_message(text, uuid, text, text, text, text, text, text)
  to anon;
