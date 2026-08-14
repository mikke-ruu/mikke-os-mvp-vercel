-- Phase 1: add the minimum cross-app classification fields to the existing
-- Activity Log table. Both columns stay nullable so existing Fund/HQ rows are
-- unaffected.

alter table public.activity_logs
  add column if not exists ended_at date,
  add column if not exists subject_type_key text;
