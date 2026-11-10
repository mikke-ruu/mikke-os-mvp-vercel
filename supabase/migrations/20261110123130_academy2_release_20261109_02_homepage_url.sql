-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-homepage-url.local.sql
-- LOCAL CANDIDATE ONLY. No production migration/history or automatic application.
-- Existing HQ identity and published/draft documents remain unchanged.
begin;
create table academy2_access.homepage_url_aliases(
 handle text primary key check(handle=lower(btrim(handle)) and length(handle) between 1 and 100),headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table academy2_access.homepage_url_preferences(
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 preferred_handle text not null,revision integer not null check(revision>0),
 saved_by uuid not null references auth.users(id),saved_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.homepage_url_aliases enable row level security;
alter table academy2_access.homepage_url_preferences enable row level security;
revoke all on academy2_access.homepage_url_aliases,academy2_access.homepage_url_preferences from public,anon,authenticated,service_role;
-- Share URL-name reservation with existing/new HQ identity writes. No alias is transferred.
create function academy2_access.guard_homepage_url_alias() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(btrim(new.handle));
begin
 perform pg_advisory_xact_lock(hashtextextended(normalized,20261102));
 if exists(select 1 from academy2_access.homepage_url_aliases a where a.handle=normalized and a.headquarters_id<>new.id)
 then raise exception 'academy2_homepage_url_taken' using errcode='23505';end if;
 return new;
end $$;
revoke all on function academy2_access.guard_homepage_url_alias() from public,anon,authenticated,service_role;
create trigger academy2_homepage_url_alias_guard before insert or update of handle on public.academy_headquarters for each row execute function academy2_access.guard_homepage_url_alias();
create function academy2_access.homepage_url_settings(p_hq uuid,p_expected_revision integer default null,p_expected_canonical text default null,p_handle text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();h public.academy_headquarters;r academy2_access.homepage_url_preferences;requested text;role_name text;
begin
 role_name:=academy2_access.my_role(p_hq);
 if actor is null or not coalesce(academy2_access.can(p_hq,'pages.edit'),false) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected_revision is null then
  if p_handle is not null or p_expected_canonical is not null then raise exception 'invalid_read' using errcode='22023';end if;
  select * into h from public.academy_headquarters where id=p_hq;
 else
  -- Same identity-write rule as the existing homepage editor.
  if role_name is distinct from 'administrator' then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if p_expected_revision<0 or p_expected_canonical is null or p_handle is null then raise exception 'invalid_url' using errcode='22023';end if;
  select * into h from public.academy_headquarters where id=p_hq for update;
 end if;
 if not found then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into r from academy2_access.homepage_url_preferences where headquarters_id=p_hq;
 if p_expected_revision is not null then
  if h.handle is distinct from p_expected_canonical or coalesce(r.revision,0)<>p_expected_revision then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  if coalesce(r.revision,0)>0 then raise exception 'academy2_homepage_url_already_set' using errcode='PT409';end if;
  requested:=lower(btrim(p_handle));
  if requested!~'^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$' or requested=any(array['admin','api','new','edit','settings','setup','login','logout','create','preview','support','academy','site','null','undefined'])
  then raise exception 'academy2_homepage_url_invalid' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(requested,20261102));
  if exists(select 1 from public.academy_headquarters other where lower(btrim(other.handle))=requested and other.id<>p_hq)
   or exists(select 1 from academy2_access.homepage_url_aliases a where a.handle=requested and a.headquarters_id<>p_hq)
  then raise exception 'academy2_homepage_url_taken' using errcode='23505';end if;
  if requested<>lower(btrim(h.handle)) then
   insert into academy2_access.homepage_url_aliases(handle,headquarters_id,created_by) values(requested,p_hq,actor) on conflict(handle) do nothing;
  end if;
  insert into academy2_access.homepage_url_preferences(headquarters_id,preferred_handle,revision,saved_by) values(p_hq,requested,p_expected_revision+1,actor)
   on conflict(headquarters_id) do update set preferred_handle=excluded.preferred_handle,revision=excluded.revision,saved_by=excluded.saved_by,saved_at=clock_timestamp();
  insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,actor,'homepage.url.saved',p_hq);
  select * into r from academy2_access.homepage_url_preferences where headquarters_id=p_hq;
 end if;
 return jsonb_build_object('headquartersId',p_hq,'canonicalHandle',h.handle,'preferredHandle',coalesce(r.preferred_handle,h.handle),'revision',coalesce(r.revision,0),'canEdit',role_name='administrator' and coalesce(r.revision,0)=0);
end $$;
create function public.academy2_homepage_url_settings(p_hq uuid,p_expected_revision integer default null,p_expected_canonical text default null,p_handle text default null) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.homepage_url_settings(p_hq,p_expected_revision,p_expected_canonical,p_handle)$$;
revoke all on function academy2_access.homepage_url_settings(uuid,integer,text,text),public.academy2_homepage_url_settings(uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.homepage_url_settings(uuid,integer,text,text),public.academy2_homepage_url_settings(uuid,integer,text,text) to authenticated;
-- Resolve only aliases whose canonical public read already exposes the same HQ.
-- Never return private HQ identifiers, draft documents, memberships or alias lists.
create function academy2_access.resolve_homepage_url(p_handle text) returns text
language plpgsql stable security definer set search_path='' as $$
declare h public.academy_headquarters;page jsonb;
begin
 if p_handle is null or length(p_handle)>100 then return null;end if;
 select headquarters.* into h from academy2_access.homepage_url_aliases a join public.academy_headquarters headquarters on headquarters.id=a.headquarters_id
  join academy2_access.tenants t on t.headquarters_id=headquarters.id and t.runtime_enabled
  where a.handle=lower(btrim(p_handle));
 if not found then return null;end if;
 page:=public.academy2_public_homepage(h.handle);
 if page->>'mode'='academy2' and page#>>'{headquarters,id}'=h.id::text and page#>>'{headquarters,handle}'=h.handle then return h.handle;end if;
 return null;
end $$;
create function public.academy2_resolve_homepage_url(p_handle text) returns text
language sql security invoker set search_path='' as $$select academy2_access.resolve_homepage_url(p_handle)$$;
revoke all on function academy2_access.resolve_homepage_url(text),public.academy2_resolve_homepage_url(text) from public,anon,authenticated,service_role;
grant usage on schema academy2_access to anon;
grant execute on function academy2_access.resolve_homepage_url(text),public.academy2_resolve_homepage_url(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
-- Recovery: disable new URL editor first, retain aliases for existing links.
-- Do not drop reservation trigger or reassign aliases while saved URLs are in use.
