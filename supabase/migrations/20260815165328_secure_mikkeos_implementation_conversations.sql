alter function public.mikkeos_start_implementation_conversation(uuid, text, text)
  security invoker;
alter function public.mikkeos_send_implementation_message(uuid, text, text)
  security invoker;

drop policy if exists "HQ owners create implementation conversations"
  on public.mikkeos_implementation_conversations;
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

drop policy if exists "HQ owners update implementation conversation activity"
  on public.mikkeos_implementation_conversations;
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

drop policy if exists "HQ owners create user implementation messages"
  on public.mikkeos_implementation_messages;
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

grant insert (project_id, title, status, created_by, updated_by)
  on public.mikkeos_implementation_conversations to authenticated;
grant update (status, updated_by, last_message_at, updated_at)
  on public.mikkeos_implementation_conversations to authenticated;
grant insert (conversation_id, role, mode, status, content, created_by)
  on public.mikkeos_implementation_messages to authenticated;
