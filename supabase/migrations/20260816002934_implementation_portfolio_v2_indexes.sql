create index if not exists mikkeos_implementation_attachments_conversation_idx
  on public.mikkeos_implementation_attachments (conversation_id);

create index if not exists mikkeos_implementation_attachments_created_by_idx
  on public.mikkeos_implementation_attachments (created_by);

create index if not exists mikkeos_implementation_conversations_created_by_idx
  on public.mikkeos_implementation_conversations (created_by);

create index if not exists mikkeos_implementation_conversations_updated_by_idx
  on public.mikkeos_implementation_conversations (updated_by);

create index if not exists mikkeos_implementation_items_origin_project_idx
  on public.mikkeos_implementation_items (origin_project_id);

create index if not exists mikkeos_implementation_items_parent_idx
  on public.mikkeos_implementation_items (parent_item_id);

create index if not exists mikkeos_implementation_items_source_conversation_idx
  on public.mikkeos_implementation_items (source_conversation_id);

create index if not exists mikkeos_implementation_items_source_message_idx
  on public.mikkeos_implementation_items (source_message_id);

create index if not exists mikkeos_implementation_messages_created_by_idx
  on public.mikkeos_implementation_messages (created_by);
