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
  ) and not exists (
    select 1 from public.mikkeos_implementation_messages active
    where active.conversation_id = conversation.id
      and active.role = 'user'
      and active.status = 'in_progress'
  ) and conversation.status in ('responding', 'executing');

  select candidate.id into claimed_id
  from public.mikkeos_implementation_messages candidate
  join public.mikkeos_implementation_conversations conversation
    on conversation.id = candidate.conversation_id
  where candidate.role = 'user'
    and candidate.status = 'pending'
    and candidate.dispatcher_attempts < 3
    and conversation.archived_at is null
    and not exists (
      select 1
      from public.mikkeos_implementation_messages active
      where active.conversation_id = candidate.conversation_id
        and active.role = 'user'
        and active.status = 'in_progress'
    )
  order by candidate.created_at
  for update of conversation, candidate skip locked
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

revoke all on function public.mikkeos_claim_next_conversation_message(text)
from public, authenticated, service_role;
revoke all on function public.mikkeos_claim_next_conversation_message(text)
from anon;
grant execute on function public.mikkeos_claim_next_conversation_message(text)
to anon;
