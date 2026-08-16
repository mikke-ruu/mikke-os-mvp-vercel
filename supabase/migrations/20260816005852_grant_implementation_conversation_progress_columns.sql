-- The v2 send RPC is SECURITY INVOKER and updates these progress fields.
-- Keep the grant column-scoped so RLS remains the authoritative row boundary.
grant update (progress_stage, progress_note, progress_updated_at)
  on public.mikkeos_implementation_conversations
  to authenticated;
