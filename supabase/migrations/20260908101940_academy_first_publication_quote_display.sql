-- Immutable server quote display evidence. No production catalog seed.
alter table academy_publication_private.policies add column consent_revision text;
create table academy_publication_private.quote_display_catalog (
 policy_version text not null references academy_publication_private.policies(version),
 pricing_revision text not null check(length(trim(pricing_revision))>0),
 plan_key text not null check(plan_key in ('small','medium','large')),
 plan_name text not null check(length(trim(plan_name)) between 1 and 120),
 discount_description text not null check(length(trim(discount_description)) between 1 and 500),
 consent_revision text not null check(length(trim(consent_revision))>0),
 primary key(policy_version,pricing_revision,plan_key)
);
alter table academy_publication_private.quote_display_catalog enable row level security;
revoke all on academy_publication_private.quote_display_catalog from public,anon,authenticated,service_role;
create trigger academy_quote_display_catalog_immutable before update or delete on academy_publication_private.quote_display_catalog
for each row execute function academy_publication_private.immutable_history();
alter table academy_publication_private.quotes add column plan_key text;
alter table academy_publication_private.quotes add column plan_name text;
alter table academy_publication_private.quotes add column discount_description text;
alter table academy_publication_private.quotes add column consent_revision text;
alter table academy_publication_private.enrollments add column plan_key text;
alter table academy_publication_private.enrollments add column plan_name text;
alter table academy_publication_private.enrollments add column discount_description text;
alter table academy_publication_private.enrollments add column consent_revision text;

create function academy_publication_private.snapshot_quote_display() returns trigger
language plpgsql security definer set search_path='' as $$
declare p academy_publication_private.policies%rowtype; d academy_publication_private.quote_display_catalog%rowtype;
begin
 if tg_op='UPDATE' then
  if (new.plan_key,new.plan_name,new.discount_description,new.consent_revision) is distinct from (old.plan_key,old.plan_name,old.discount_description,old.consent_revision) then raise exception 'quote_display_immutable'; end if;
  return new;
 end if;
 select * into p from academy_publication_private.policies where version=new.policy_version;
 new.plan_key:=case when new.instructor_count<=20 then 'small' when new.instructor_count<=50 then 'medium' when new.instructor_count<=200 then 'large' else null end;
 select * into d from academy_publication_private.quote_display_catalog where policy_version=new.policy_version and pricing_revision=p.pricing_revision and plan_key=new.plan_key;
 if d.plan_key is null or p.consent_revision is null or d.consent_revision is distinct from p.consent_revision then raise exception 'quote_display_metadata_required'; end if;
 new.plan_name:=d.plan_name;new.discount_description:=d.discount_description;new.consent_revision:=d.consent_revision;
 return new;
end $$;
create trigger academy_publication_quote_display before insert or update on academy_publication_private.quotes
for each row execute function academy_publication_private.snapshot_quote_display();

create function academy_publication_private.snapshot_consent_display() returns trigger
language plpgsql security definer set search_path='' as $$
declare q academy_publication_private.quotes%rowtype;
begin
 if tg_op='UPDATE' and new.quote_id=old.quote_id then
  if (new.plan_key,new.plan_name,new.discount_description,new.consent_revision) is distinct from (old.plan_key,old.plan_name,old.discount_description,old.consent_revision) then raise exception 'consent_display_immutable'; end if;
  return new;
 end if;
 select * into q from academy_publication_private.quotes where id=new.quote_id;
 if q.plan_name is null or q.discount_description is null or q.consent_revision is null then raise exception 'quote_display_metadata_required'; end if;
 new.plan_key:=q.plan_key;new.plan_name:=q.plan_name;new.discount_description:=q.discount_description;new.consent_revision:=q.consent_revision;
 return new;
end $$;
create trigger academy_publication_consent_display before insert or update on academy_publication_private.enrollments
for each row execute function academy_publication_private.snapshot_consent_display();
revoke all on function academy_publication_private.snapshot_quote_display(),academy_publication_private.snapshot_consent_display() from public,anon,authenticated,service_role;

do $$ declare source text; begin
 source:=pg_get_functiondef('academy_publication_private.quote(uuid,text)'::regprocedure);
 if position('''expires_at'',q.expires_at)' in source)=0 then raise exception 'unexpected_quote_projection'; end if;
 source:=replace(source,'''expires_at'',q.expires_at)',
  '''expires_at'',q.expires_at,''plan_key'',q.plan_key,''plan_name'',q.plan_name,''discount_description'',q.discount_description,''consent_revision'',q.consent_revision)');
 execute source;
 source:=pg_get_functiondef('academy_publication_private.command_before_runtime(uuid,text,uuid,uuid,boolean,text,bigint)'::regprocedure);
 if position('if q.pricing_revision is distinct from p.pricing_revision' in source)=0 then raise exception 'unexpected_prepare_validation'; end if;
 source:=replace(source,'if q.pricing_revision is distinct from p.pricing_revision',
  'if q.plan_name is null or q.discount_description is null or q.consent_revision is null or q.consent_revision is distinct from p.consent_revision or q.pricing_revision is distinct from p.pricing_revision');
 execute source;
 source:=pg_get_functiondef('public.academy_first_publication_setup_complete(uuid,text,text,text)'::regprocedure);
 if position('''expiresAt'',q.expires_at)' in source)=0 then raise exception 'unexpected_setup_quote_projection'; end if;
 source:=replace(source,'''expiresAt'',q.expires_at)',
  '''expiresAt'',q.expires_at,''planKey'',q.plan_key,''planName'',q.plan_name,''discountDescription'',q.discount_description,''consentRevision'',q.consent_revision)');
 source:=replace(source,'and pricing_revision=q.pricing_revision)',
  'and pricing_revision=q.pricing_revision and consent_revision=q.consent_revision and q.plan_name is not null and q.discount_description is not null)');
 execute source;
end $$;
