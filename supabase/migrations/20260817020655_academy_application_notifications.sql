-- Delivery log for transactional Academy application mail.
-- The message body is deliberately not retained because it can contain
-- applicant contact details and payment instructions.
create table public.academy_application_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.academy_applications(id) on delete restrict,
  recipient_kind text not null check (recipient_kind in ('applicant', 'headquarters')),
  status text not null check (status in ('sending', 'sent', 'failed')),
  provider_message_id text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, recipient_kind)
);

alter table public.academy_application_notifications enable row level security;
revoke all on table public.academy_application_notifications from public, anon, authenticated;
grant select, insert, update on table public.academy_application_notifications to service_role;

create or replace function public.academy_list_application_notifications(p_application_id uuid)
returns table (
  recipient_kind text,
  status text,
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.recipient_kind, n.status, n.last_error, n.sent_at, n.updated_at
  from public.academy_application_notifications n
  join public.academy_applications a on a.id = n.application_id
  where n.application_id = p_application_id
    and private.academy_can_manage_headquarters(a.headquarters_id)
  order by n.recipient_kind;
$$;

revoke all on function public.academy_list_application_notifications(uuid) from public, anon;
grant execute on function public.academy_list_application_notifications(uuid) to authenticated;
