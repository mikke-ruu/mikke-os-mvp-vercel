alter table public.mikkeos_implementation_projects
  add column if not exists roadmap_stage text not null default 'idea'
    check (roadmap_stage in ('idea', 'prototype', 'local_build', 'local_ready', 'release_ready', 'released', 'operating', 'paused')),
  add column if not exists next_action text not null default '',
  add column if not exists local_state text not null default 'none'
    check (local_state in ('none', 'planned', 'in_progress', 'implemented', 'tested')),
  add column if not exists local_verify_url text not null default '',
  add column if not exists local_evidence_ref text not null default '',
  add column if not exists production_url text not null default '',
  add column if not exists release_target_date date,
  add column if not exists app_menu_state text not null default 'not_listed'
    check (app_menu_state in ('not_listed', 'planned', 'ready', 'listed')),
  add column if not exists homepage_state text not null default 'not_listed'
    check (homepage_state in ('not_listed', 'planned', 'ready', 'listed'));

alter table public.mikkeos_implementation_items
  drop constraint if exists mikkeos_implementation_items_item_type_check;

alter table public.mikkeos_implementation_items
  add constraint mikkeos_implementation_items_item_type_check
    check (item_type in (
      'consultation', 'approval', 'result', 'note',
      'request', 'proposal', 'local_result', 'production_result', 'handoff'
    )),
  add column if not exists origin_project_id uuid references public.mikkeos_implementation_projects(id) on delete set null,
  add column if not exists source_conversation_id uuid references public.mikkeos_implementation_conversations(id) on delete set null,
  add column if not exists source_message_id uuid references public.mikkeos_implementation_messages(id) on delete set null,
  add column if not exists parent_item_id uuid references public.mikkeos_implementation_items(id) on delete set null,
  add column if not exists inventory_key text not null default '',
  add column if not exists local_verify_url text not null default '',
  add column if not exists production_url text not null default '';

create unique index if not exists mikkeos_implementation_items_inventory_key_idx
  on public.mikkeos_implementation_items(inventory_key)
  where inventory_key <> '' and archived_at is null;

create index if not exists mikkeos_implementation_items_lane_idx
  on public.mikkeos_implementation_items(project_id, item_type, status, updated_at desc)
  where archived_at is null;

alter table public.mikkeos_implementation_conversations
  add column if not exists progress_stage text not null default '',
  add column if not exists progress_note text not null default '',
  add column if not exists progress_updated_at timestamptz;

alter table public.mikkeos_implementation_messages
  add column if not exists decision_question text not null default '',
  add column if not exists recommended_execution text not null default '';

create table if not exists public.mikkeos_implementation_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mikkeos_implementation_conversations(id) on delete cascade,
  message_id uuid references public.mikkeos_implementation_messages(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 600),
  file_name text not null check (char_length(file_name) between 1 and 240),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  worker_url text not null default '',
  worker_url_expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists mikkeos_implementation_attachments_message_idx
  on public.mikkeos_implementation_attachments(message_id, created_at);

alter table public.mikkeos_implementation_attachments enable row level security;

drop policy if exists "HQ owners manage implementation attachments"
  on public.mikkeos_implementation_attachments;
create policy "HQ owners manage implementation attachments"
on public.mikkeos_implementation_attachments for all to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active and staff.role in ('owner', 'admin')
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active and staff.role in ('owner', 'admin')
  )
);

revoke all on public.mikkeos_implementation_attachments from public, anon;
grant select, insert, update, delete on public.mikkeos_implementation_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mikkeos-implementation-attachments',
  'mikkeos-implementation-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "HQ owners read implementation attachment objects" on storage.objects;
create policy "HQ owners read implementation attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'mikkeos-implementation-attachments'
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active and staff.role in ('owner', 'admin')
  )
);

drop policy if exists "HQ owners add implementation attachment objects" on storage.objects;
create policy "HQ owners add implementation attachment objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mikkeos-implementation-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active and staff.role in ('owner', 'admin')
  )
);

drop policy if exists "HQ owners remove implementation attachment objects" on storage.objects;
create policy "HQ owners remove implementation attachment objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mikkeos-implementation-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active and staff.role in ('owner', 'admin')
  )
);

create or replace function public.mikkeos_create_implementation_conversation(
  p_project_id uuid,
  p_title text
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
      and staff.is_active and staff.role in ('owner', 'admin')
  ) then
    raise exception 'HQ owner or admin access required' using errcode = '42501';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.mikkeos_implementation_projects project
    where project.id = p_project_id and project.archived_at is null
  ) then
    raise exception 'implementation project not found' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160 then
    raise exception 'invalid conversation title' using errcode = '22023';
  end if;

  insert into public.mikkeos_implementation_conversations (
    project_id, title, status, created_by, updated_by
  ) values (
    p_project_id, trim(p_title), 'active', caller_id, caller_id
  ) returning id into new_conversation_id;

  return new_conversation_id;
end;
$$;

create or replace function public.mikkeos_send_implementation_message_v2(
  p_conversation_id uuid,
  p_mode text,
  p_content text,
  p_attachment_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_message_id uuid;
  requested_attachments integer := coalesce(cardinality(p_attachment_ids), 0);
  owned_attachments integer;
begin
  if caller_id is null or not exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = caller_id
      and staff.is_active and staff.role in ('owner', 'admin')
  ) then
    raise exception 'HQ owner or admin access required' using errcode = '42501';
  end if;

  if p_mode not in ('discussion', 'execution')
    or char_length(trim(coalesce(p_content, ''))) not between 1 and 12000
    or requested_attachments > 3 then
    raise exception 'invalid message content' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.mikkeos_implementation_conversations conversation
    where conversation.id = p_conversation_id and conversation.archived_at is null
  ) then
    raise exception 'active conversation not found' using errcode = '22023';
  end if;

  select count(*) into owned_attachments
  from public.mikkeos_implementation_attachments attachment
  where attachment.id = any(coalesce(p_attachment_ids, array[]::uuid[]))
    and attachment.conversation_id = p_conversation_id
    and attachment.created_by = caller_id
    and attachment.message_id is null
    and attachment.worker_url_expires_at > now();

  if owned_attachments <> requested_attachments then
    raise exception 'invalid or expired attachment' using errcode = '22023';
  end if;

  insert into public.mikkeos_implementation_messages (
    conversation_id, role, mode, status, content, created_by
  ) values (
    p_conversation_id, 'user', p_mode, 'pending', trim(p_content), caller_id
  ) returning id into new_message_id;

  update public.mikkeos_implementation_attachments
  set message_id = new_message_id
  where id = any(coalesce(p_attachment_ids, array[]::uuid[]));

  update public.mikkeos_implementation_conversations
  set status = 'queued', progress_stage = 'queued', progress_note = '相談を受け付けました。',
      progress_updated_at = now(), updated_by = caller_id,
      last_message_at = now(), updated_at = now()
  where id = p_conversation_id;

  return new_message_id;
exception
  when unique_violation then
    raise exception 'Codexの返答を待ってから次のメッセージを送ってください。' using errcode = '55000';
end;
$$;

create or replace function public.mikkeos_set_conversation_progress(
  p_worker_secret text,
  p_conversation_id uuid,
  p_stage text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary' and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  if p_stage not in ('queued', 'preparing', 'inspecting', 'planning', 'composing', 'saving') then
    raise exception 'invalid progress stage' using errcode = '22023';
  end if;

  update public.mikkeos_implementation_conversations
  set progress_stage = p_stage,
      progress_note = left(coalesce(p_note, ''), 240),
      progress_updated_at = now(), updated_at = now()
  where id = p_conversation_id and archived_at is null;
  return found;
end;
$$;

create or replace function public.mikkeos_get_message_attachments(
  p_worker_secret text,
  p_message_id uuid
)
returns table (attachment_id uuid, file_name text, mime_type text, worker_url text, worker_url_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary' and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  return query
  select attachment.id, attachment.file_name, attachment.mime_type, attachment.worker_url, attachment.worker_url_expires_at
  from public.mikkeos_implementation_attachments attachment
  where attachment.message_id = p_message_id
  order by attachment.created_at;
end;
$$;

create or replace function public.mikkeos_record_conversation_outcomes(
  p_worker_secret text,
  p_message_id uuid,
  p_decision_question text default '',
  p_recommended_execution text default '',
  p_updates jsonb default '[]'::jsonb,
  p_handoffs jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_conversation_id uuid;
  source_project_id uuid;
  assistant_message_id uuid;
  entry jsonb;
  target_project_id uuid;
  lane text;
begin
  if p_worker_secret is null or char_length(p_worker_secret) < 32 or not exists (
    select 1 from private.mikkeos_dispatcher_credentials credential
    where credential.credential_key = 'primary' and credential.is_active
      and credential.secret_sha256 = encode(extensions.digest(p_worker_secret, 'sha256'), 'hex')
  ) then
    raise exception 'dispatcher authentication failed' using errcode = '28000';
  end if;

  select message.conversation_id, conversation.project_id
  into source_conversation_id, source_project_id
  from public.mikkeos_implementation_messages message
  join public.mikkeos_implementation_conversations conversation on conversation.id = message.conversation_id
  where message.id = p_message_id and message.role = 'user';

  if source_conversation_id is null then
    return false;
  end if;

  select response.id into assistant_message_id
  from public.mikkeos_implementation_messages response
  where response.conversation_id = source_conversation_id
    and response.role = 'assistant'
    and response.created_at >= (select created_at from public.mikkeos_implementation_messages where id = p_message_id)
  order by response.created_at desc limit 1;

  update public.mikkeos_implementation_messages
  set decision_question = left(coalesce(p_decision_question, ''), 1000),
      recommended_execution = left(coalesce(p_recommended_execution, ''), 12000),
      updated_at = now()
  where id = assistant_message_id;

  for entry in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    lane := entry->>'lane';
    if lane not in ('request', 'proposal', 'local_result', 'production_result') then
      continue;
    end if;
    select id into target_project_id
    from public.mikkeos_implementation_projects
    where app_key = coalesce(nullif(entry->>'app_key', ''), (select app_key from public.mikkeos_implementation_projects where id = source_project_id))
      and archived_at is null;
    target_project_id := coalesce(target_project_id, source_project_id);

    insert into public.mikkeos_implementation_items (
      project_id, origin_project_id, source_conversation_id, source_message_id,
      item_type, status, priority, title, body, result, evidence_ref,
      local_verify_url, production_url
    ) values (
      target_project_id, source_project_id, source_conversation_id, p_message_id,
      lane,
      case when lane in ('local_result', 'production_result') then 'completed' else 'open' end,
      'normal', left(coalesce(nullif(entry->>'title', ''), 'Codexからの更新'), 160),
      left(coalesce(entry->>'summary', ''), 8000),
      case when lane in ('local_result', 'production_result') then left(coalesce(entry->>'summary', ''), 8000) else '' end,
      left(coalesce(entry->>'evidence_ref', ''), 2000),
      left(coalesce(entry->>'local_verify_url', ''), 2000),
      left(coalesce(entry->>'production_url', ''), 2000)
    );
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(p_handoffs, '[]'::jsonb))
  loop
    select id into target_project_id
    from public.mikkeos_implementation_projects
    where app_key = entry->>'app_key' and archived_at is null;
    if target_project_id is null then
      continue;
    end if;

    insert into public.mikkeos_implementation_items (
      project_id, origin_project_id, source_conversation_id, source_message_id,
      item_type, status, priority, title, body, task_ref
    ) values (
      target_project_id, source_project_id, source_conversation_id, p_message_id,
      'handoff', 'open', 'normal',
      left(coalesce(nullif(entry->>'title', ''), '他アプリからの連携依頼'), 160),
      left(coalesce(entry->>'request', ''), 8000),
      left(coalesce(entry->>'room', ''), 2000)
    );
  end loop;

  update public.mikkeos_implementation_conversations
  set progress_stage = '', progress_note = '', progress_updated_at = now(), updated_at = now()
  where id = source_conversation_id;

  return true;
end;
$$;

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

    stable_key := 'worktree:' || left(encode(extensions.digest(
      coalesce(snapshot->>'branch', '') || '|' || coalesce(snapshot->>'path', ''), 'sha256'
    ), 'hex'), 48);

    insert into public.mikkeos_implementation_items (
      project_id, item_type, status, priority, title, result, evidence_ref, inventory_key
    ) values (
      target_project_id,
      'local_result',
      case when coalesce((snapshot->>'dirty')::boolean, false) then 'in_progress' else 'completed' end,
      'normal',
      left(case when coalesce((snapshot->>'dirty')::boolean, false) then 'ローカル作業中: ' else 'ローカルコミット済み: ' end || coalesce(snapshot->>'branch', 'detached'), 160),
      left(coalesce(snapshot->>'summary', ''), 8000),
      left('branch=' || coalesce(snapshot->>'branch', '') || ' / head=' || coalesce(snapshot->>'head', '') || ' / path=' || coalesce(snapshot->>'path', ''), 2000),
      stable_key
    )
    on conflict (inventory_key) where inventory_key <> '' and archived_at is null do update
    set status = excluded.status,
        title = excluded.title,
        result = excluded.result,
        evidence_ref = excluded.evidence_ref,
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

revoke all on function public.mikkeos_create_implementation_conversation(uuid, text) from public, anon;
revoke all on function public.mikkeos_send_implementation_message_v2(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.mikkeos_create_implementation_conversation(uuid, text) to authenticated;
grant execute on function public.mikkeos_send_implementation_message_v2(uuid, text, text, uuid[]) to authenticated;

revoke all on function public.mikkeos_set_conversation_progress(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.mikkeos_get_message_attachments(text, uuid) from public, anon, authenticated;
revoke all on function public.mikkeos_record_conversation_outcomes(text, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mikkeos_sync_local_inventory(text, jsonb) from public, anon, authenticated;
grant execute on function public.mikkeos_set_conversation_progress(text, uuid, text, text) to anon;
grant execute on function public.mikkeos_get_message_attachments(text, uuid) to anon;
grant execute on function public.mikkeos_record_conversation_outcomes(text, uuid, text, text, jsonb, jsonb) to anon;
grant execute on function public.mikkeos_sync_local_inventory(text, jsonb) to anon;

update public.mikkeos_implementation_projects set
  roadmap_stage = case
    when app_key in ('marketnote', 'story', 'manager', 'mikkeos') then 'operating'
    when app_key = 'academy' then 'local_ready'
    when app_key in ('community', 'team-works', 'library', 'page') then 'local_build'
    when app_key = 'desk' then 'paused'
    else 'prototype'
  end,
  local_state = case
    when app_key in ('academy', 'marketnote', 'community', 'story', 'manager', 'team-works', 'library', 'page', 'mikkeos') then 'implemented'
    else 'in_progress'
  end,
  next_action = case app_key
    when 'academy' then 'クラス・講師依頼UIを最新masterへ統合し、認証後画面を確認する。'
    when 'marketnote' then '自動サマリーv2を最新masterへ統合し、STORY連携の本人選択フローを設計する。'
    when 'community' then '未統合UIを回収し、限定テストと一般公開のゲートを分けて検証する。'
    when 'story' then 'MarketNoteの本人選択Activityを公開スナップショットへ繋ぐ。'
    when 'manager' then 'モック/localStorage表示を実Activity Logへ段階的に置き換える。'
    when 'mikkeos' then '開発管制室でローカル・本番・連携依頼を自動追跡する。'
    else current_focus
  end,
  production_url = case when verify_path <> '' then 'https://app.mikke-os.com' || verify_path else '' end,
  app_menu_state = case when public_state = 'public' then 'listed' when public_state = 'partial' then 'ready' else 'not_listed' end,
  homepage_state = case when app_key in ('marketnote', 'story') then 'listed' when public_state = 'public' then 'planned' else 'not_listed' end,
  updated_at = now();

update public.mikkeos_implementation_items item
set item_type = 'production_result',
    production_url = coalesce(nullif(item.production_url, ''), project.production_url),
    updated_at = now()
from public.mikkeos_implementation_projects project
where item.project_id = project.id
  and item.item_type = 'result'
  and item.status = 'completed'
  and (item.evidence_ref ilike '%PR #%'
    or item.evidence_ref ilike '%merge%'
    or item.evidence_ref ilike '%app.mikke-os.com%');

insert into public.mikkeos_implementation_items (
  project_id, item_type, status, priority, title, body, inventory_key
)
select project.id, 'request', 'open', 'high',
  'mikkeOS全体を一つの開発管制室で進めたい',
  '全体の現在地、ロードマップ、ローカル成果、本番成果、アプリ間連携を一画面で把握し、部屋へ文章を運ばず自動で作業を進める。',
  'control-room-v2-user-goal-20260816'
from public.mikkeos_implementation_projects project
where project.app_key = 'mikkeos'
on conflict (inventory_key) where inventory_key <> '' and archived_at is null do nothing;

insert into public.mikkeos_implementation_items (
  project_id, item_type, status, priority, title, body, evidence_ref, inventory_key
)
select project.id, 'proposal', 'open', 'normal',
  '次の一手: ' || project.app_name,
  project.next_action,
  'mikkeOS control-room inventory 2026-08-16',
  'control-room-v2-next-' || project.app_key
from public.mikkeos_implementation_projects project
where project.next_action <> ''
on conflict (inventory_key) where inventory_key <> '' and archived_at is null do update
set body = excluded.body, updated_at = now();

insert into public.mikkeos_implementation_items (
  project_id, item_type, status, priority, title, result, evidence_ref, inventory_key
)
select project.id, 'local_result', 'completed', 'high', seed.title, seed.result, seed.evidence_ref, seed.inventory_key
from public.mikkeos_implementation_projects project
join (values
  ('academy', 'クラス・講師依頼UI', 'オーナーと講師のクラス・講師依頼フローを専用ブランチで実装し、型チェックに成功。master・本番は未反映。', 'branch codex/academy-release-20260815 / lint pass', 'local-academy-class-request-20260816'),
  ('marketnote', 'イベント種類別の自動サマリーv2', 'イベント種類ごとに実績集計対象を設定するローカル実装。最新masterへの統合、migration、本番確認が必要。', 'commit e100194 / branch codex/marketnote-auto-summary-v2', 'local-marketnote-auto-summary-v2-20260816'),
  ('community', 'Community UI polish候補', '未統合のUI改善差分がローカルにあり、担当範囲と公開ゲートを分けて回収・検証する必要がある。', '2026-08-15 inventory / branch codex/community-platform-plans', 'local-community-polish-20260816')
) as seed(app_key, title, result, evidence_ref, inventory_key) on seed.app_key = project.app_key
on conflict (inventory_key) where inventory_key <> '' and archived_at is null do update
set result = excluded.result, evidence_ref = excluded.evidence_ref, updated_at = now();

insert into public.mikkeos_implementation_items (
  project_id, item_type, status, priority, title, result, evidence_ref, production_url, inventory_key
)
select project.id, 'production_result', 'completed', 'normal',
  project.app_name || ' 現行ルート',
  project.verification_note,
  'mikkeOS implementation inventory 2026-08-16',
  project.production_url,
  'production-route-' || project.app_key || '-20260816'
from public.mikkeos_implementation_projects project
where project.public_state = 'public' and project.production_url <> ''
on conflict (inventory_key) where inventory_key <> '' and archived_at is null do update
set result = excluded.result, production_url = excluded.production_url, updated_at = now();
