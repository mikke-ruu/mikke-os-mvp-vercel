revoke all on table public.mikkeos_hq_staff_members from public, anon;
revoke all on table public.mikkeos_hq_inquiries from public, anon;
revoke all on table public.mikkeos_hq_audit_logs from public, anon;
revoke all on sequence public.mikkeos_hq_audit_logs_id_seq from public, anon;

grant select on table public.mikkeos_hq_staff_members to authenticated;
grant select, insert, update, delete on table public.mikkeos_hq_inquiries to authenticated;
grant select, insert on table public.mikkeos_hq_audit_logs to authenticated;
grant usage, select on sequence public.mikkeos_hq_audit_logs_id_seq to authenticated;
