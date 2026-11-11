-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-setup-bank-preference.local.sql
-- Local candidate only. Not a production migration and not applied automatically.
-- Generate a migration with the official Supabase CLI once available.
begin;
create table academy2_access.setup_bank_preferences(
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 use_bank boolean not null, revision integer not null check(revision>0),
 saved_by uuid not null references auth.users(id), saved_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.setup_bank_preferences enable row level security;
revoke all on academy2_access.setup_bank_preferences from public,anon,authenticated,service_role;
create function academy2_access.setup_bank_preference(p_hq uuid,p_expected integer default null,p_use_bank boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r academy2_access.setup_bank_preferences; actor uuid:=auth.uid(); role_name text;
begin
 if actor is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 role_name:=academy2_access.my_role(p_hq);
 if (role_name in('owner','administrator')) is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null then
  if p_use_bank is not null then raise exception 'invalid_read' using errcode='22023';end if;
 else
  if role_name is distinct from 'administrator' then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if p_expected<0 or p_use_bank is null then raise exception 'invalid_preference' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hq::text||':setup_bank',1047));
 end if;
 select * into r from academy2_access.setup_bank_preferences where headquarters_id=p_hq;
 if p_expected is not null then
  if r.revision=p_expected+1 and r.use_bank=p_use_bank and r.saved_by=actor then return jsonb_build_object('useBank',r.use_bank,'revision',r.revision);end if;
  if coalesce(r.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  insert into academy2_access.setup_bank_preferences(headquarters_id,use_bank,revision,saved_by) values(p_hq,p_use_bank,p_expected+1,actor)
   on conflict(headquarters_id) do update set use_bank=excluded.use_bank,revision=excluded.revision,saved_by=excluded.saved_by,saved_at=clock_timestamp();
  insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,actor,'settings.setup_bank.saved',p_hq);
  select * into r from academy2_access.setup_bank_preferences where headquarters_id=p_hq;
 end if;
 return jsonb_build_object('useBank',r.use_bank,'revision',coalesce(r.revision,0));
end $$;
create function public.academy2_setup_bank_preference(p_hq uuid,p_expected integer default null,p_use_bank boolean default null) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.setup_bank_preference(p_hq,p_expected,p_use_bank)$$;
revoke all on function academy2_access.setup_bank_preference(uuid,integer,boolean),public.academy2_setup_bank_preference(uuid,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function academy2_access.setup_bank_preference(uuid,integer,boolean),public.academy2_setup_bank_preference(uuid,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
-- Recovery: roll back only this new feature UI first. Retain preference rows and all bank/account data.
-- Does not alter any existing settings, payment guards, application, consent or course table.
