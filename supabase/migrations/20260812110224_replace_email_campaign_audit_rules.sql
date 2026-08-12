drop rule if exists mikkeos_email_campaigns_audit_insert on public.mikkeos_email_campaigns;
drop rule if exists mikkeos_email_campaigns_audit_update on public.mikkeos_email_campaigns;
drop rule if exists mikkeos_email_campaigns_audit_delete on public.mikkeos_email_campaigns;

create or replace function private.audit_mikkeos_email_campaign_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_entity_id uuid;
  audit_status text;
  audit_campaign_type text;
begin
  if tg_op = 'DELETE' then
    audit_entity_id := old.id;
    audit_status := old.status;
    audit_campaign_type := old.campaign_type;
  else
    audit_entity_id := new.id;
    audit_status := new.status;
    audit_campaign_type := new.campaign_type;
  end if;

  insert into public.mikkeos_hq_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    (select auth.uid()),
    lower(tg_op),
    'mikkeos_email_campaigns',
    audit_entity_id,
    jsonb_build_object('status', audit_status, 'campaign_type', audit_campaign_type)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_mikkeos_email_campaign_change()
  from public, anon, authenticated;

drop trigger if exists audit_mikkeos_email_campaign_change
  on public.mikkeos_email_campaigns;
create trigger audit_mikkeos_email_campaign_change
after insert or update or delete on public.mikkeos_email_campaigns
for each row execute function private.audit_mikkeos_email_campaign_change();

notify pgrst, 'reload schema';
