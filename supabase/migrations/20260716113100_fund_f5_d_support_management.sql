-- Fund F5-d: make owner support/payment/fulfillment management database-owned
-- without breaking existing claims, participations, or public progress.

alter table public.fund_supports
  add column public_name text not null default '',
  add column is_anonymous boolean not null default false;

update public.fund_supports
set source_local_id = 'fund_support_db_' || replace(id::text, '-', '')
where source_local_id is null or btrim(source_local_id) = '';

update public.fund_supports
set plan_source_id = nullif(btrim(plan_source_id), ''),
    supporter_name = btrim(supporter_name),
    supporter_email = nullif(btrim(supporter_email), ''),
    comment = btrim(coalesce(comment, '')),
    source = coalesce(nullif(btrim(source), ''), 'manual'),
    completed_at = case
      when fulfillment_status = 'completed' then coalesce(completed_at, updated_at, now())
      else null
    end,
    cancelled_at = case
      when payment_status = 'cancelled' or fulfillment_status = 'cancelled'
        then coalesce(cancelled_at, updated_at, now())
      else null
    end;

alter table public.fund_supports
  alter column source_local_id set not null,
  alter column comment set default '',
  alter column comment set not null,
  add constraint fund_supports_source_local_id_length_check
    check (char_length(source_local_id) between 1 and 160),
  add constraint fund_supports_plan_source_id_length_check
    check (plan_source_id is null or char_length(plan_source_id) between 1 and 160),
  add constraint fund_supports_supporter_name_length_check
    check (char_length(supporter_name) between 1 and 160),
  add constraint fund_supports_supporter_email_length_check
    check (supporter_email is null or char_length(supporter_email) <= 320),
  add constraint fund_supports_public_name_length_check
    check (char_length(public_name) <= 80),
  add constraint fund_supports_comment_length_check
    check (char_length(comment) <= 5000),
  add constraint fund_supports_source_length_check
    check (char_length(source) between 1 and 160),
  add constraint fund_supports_completion_state_check
    check (
      (fulfillment_status = 'completed' and completed_at is not null)
      or (fulfillment_status <> 'completed' and completed_at is null)
    ),
  add constraint fund_supports_cancellation_state_check
    check (
      ((payment_status = 'cancelled' or fulfillment_status = 'cancelled') and cancelled_at is not null)
      or ((payment_status <> 'cancelled' and fulfillment_status <> 'cancelled') and cancelled_at is null)
    );

drop index if exists public.fund_supports_project_source_local_id_unique_idx;
create unique index fund_supports_project_source_local_id_unique_idx
  on public.fund_supports (project_id, source_local_id);

create or replace function private.prepare_fund_support()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.source_local_id := btrim(new.source_local_id);
  new.plan_source_id := nullif(btrim(new.plan_source_id), '');
  new.supporter_name := btrim(new.supporter_name);
  new.supporter_email := nullif(btrim(new.supporter_email), '');
  new.public_name := btrim(coalesce(new.public_name, ''));
  new.comment := btrim(coalesce(new.comment, ''));
  new.source := coalesce(nullif(btrim(new.source), ''), 'manual');

  if tg_op = 'UPDATE' then
    new.project_id := old.project_id;
    new.source_local_id := old.source_local_id;
    new.created_at := old.created_at;
    new.completed_at := case
      when new.fulfillment_status = 'completed' then coalesce(old.completed_at, new.completed_at, now())
      else null
    end;
    new.cancelled_at := case
      when new.payment_status = 'cancelled' or new.fulfillment_status = 'cancelled'
        then coalesce(old.cancelled_at, new.cancelled_at, now())
      else null
    end;
  else
    new.created_at := now();
    new.completed_at := case when new.fulfillment_status = 'completed' then coalesce(new.completed_at, now()) else null end;
    new.cancelled_at := case
      when new.payment_status = 'cancelled' or new.fulfillment_status = 'cancelled'
        then coalesce(new.cancelled_at, now())
      else null
    end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.prepare_fund_support() from public, anon, authenticated;

drop trigger if exists set_fund_supports_updated_at on public.fund_supports;
drop trigger if exists prepare_fund_support_before_write on public.fund_supports;
create trigger prepare_fund_support_before_write
before insert or update on public.fund_supports
for each row execute function private.prepare_fund_support();

alter table public.fund_supports enable row level security;
alter table public.fund_supports force row level security;

revoke all on table public.fund_supports from public, anon, authenticated;
grant select, insert, update, delete on table public.fund_supports to authenticated;
grant all on table public.fund_supports to service_role;

create or replace function public.save_fund_support(
  p_owner_profile_id uuid,
  p_project_source_local_id text,
  p_support jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_project_id uuid;
  v_support_id uuid;
  v_source_local_id text := nullif(btrim(p_support ->> 'id'), '');
  v_supporter_name text := nullif(btrim(p_support ->> 'supporterName'), '');
  v_supported_at text := nullif(btrim(p_support ->> 'supportedAt'), '');
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_project_source_local_id), '') is null
    or v_source_local_id is null
    or v_supporter_name is null
    or v_supported_at is null then
    raise exception 'Project id, support id, supporter name, and supported date are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_owner_profile_id and user_id = v_actor_user_id
  ) then
    raise exception 'Owner profile does not belong to the authenticated user' using errcode = '42501';
  end if;

  select id into v_project_id
  from public.fund_projects
  where owner_user_id = v_actor_user_id
    and owner_profile_id = p_owner_profile_id
    and source_local_id = btrim(p_project_source_local_id);

  if v_project_id is null then
    raise exception 'Fund project was not found for the authenticated owner' using errcode = '42501';
  end if;

  select id into v_support_id
  from public.fund_supports
  where project_id = v_project_id and source_local_id = v_source_local_id;

  if v_support_id is null then
    insert into public.fund_supports (
      project_id, source_local_id, plan_source_id,
      supporter_name, supporter_email, public_name, is_anonymous, comment,
      support_type, amount, quantity, payment_status, fulfillment_status,
      record_status, source, supported_at
    ) values (
      v_project_id, v_source_local_id, nullif(btrim(p_support ->> 'planId'), ''),
      v_supporter_name, nullif(btrim(p_support ->> 'supporterEmail'), ''),
      coalesce(p_support ->> 'publicName', ''),
      coalesce((p_support ->> 'isAnonymous')::boolean, false),
      coalesce(p_support ->> 'comment', ''),
      p_support ->> 'supportType', nullif(p_support ->> 'amount', '')::numeric,
      (p_support ->> 'quantity')::integer, p_support ->> 'paymentStatus',
      p_support ->> 'fulfillmentStatus', p_support ->> 'recordStatus',
      coalesce(nullif(btrim(p_support ->> 'source'), ''), 'manual'),
      v_supported_at::timestamptz
    ) returning id into v_support_id;
  else
    update public.fund_supports
    set plan_source_id = nullif(btrim(p_support ->> 'planId'), ''),
        supporter_name = v_supporter_name,
        supporter_email = nullif(btrim(p_support ->> 'supporterEmail'), ''),
        public_name = coalesce(p_support ->> 'publicName', ''),
        is_anonymous = coalesce((p_support ->> 'isAnonymous')::boolean, false),
        comment = coalesce(p_support ->> 'comment', ''),
        support_type = p_support ->> 'supportType',
        amount = nullif(p_support ->> 'amount', '')::numeric,
        quantity = (p_support ->> 'quantity')::integer,
        payment_status = p_support ->> 'paymentStatus',
        fulfillment_status = p_support ->> 'fulfillmentStatus',
        record_status = p_support ->> 'recordStatus',
        source = coalesce(nullif(btrim(p_support ->> 'source'), ''), 'manual'),
        supported_at = v_supported_at::timestamptz
    where id = v_support_id;
  end if;

  return v_support_id;
end;
$$;

revoke all on function public.save_fund_support(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_fund_support(uuid, text, jsonb) to authenticated, service_role;

comment on table public.fund_supports is
  'Owner-private Fund support, payment, and fulfillment source of truth. Supporters read consent-bound fund_participations instead.';

notify pgrst, 'reload schema';
