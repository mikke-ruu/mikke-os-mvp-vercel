import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "../../../.local-tools/academy-db-validation/node_modules/@electric-sql/pglite/dist/index.js";

const migrationUrl = new URL("../migrations/20260908070053_community_academy_release_access_contract.sql", import.meta.url);
const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
const db = new PGlite();
await db.waitReady;

const OWNER = "10000000-0000-4000-8000-000000000001";
const INSTRUCTOR = "10000000-0000-4000-8000-000000000002";
const OUTSIDER = "10000000-0000-4000-8000-000000000003";
const HQ = "20000000-0000-4000-8000-000000000001";
const OTHER_HQ = "20000000-0000-4000-8000-000000000002";
const COMMUNITY = "30000000-0000-4000-8000-000000000001";
const OTHER_COMMUNITY = "30000000-0000-4000-8000-000000000002";
const MAPPING = "40000000-0000-4000-8000-000000000001";
const INSTRUCTOR_ROW = "50000000-0000-4000-8000-000000000001";
const ROOM = "60000000-0000-4000-8000-000000000001";
const ADDED_ROOM = "60000000-0000-4000-8000-000000000002";

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create schema private;
  create schema community_private;
  create schema extensions;
  grant usage on schema community_private to authenticated;

  create function public.gen_random_uuid() returns uuid language sql volatile
  as $$
    select (
      pg_catalog.substr(v,1,8) || '-' || pg_catalog.substr(v,9,4) || '-4' ||
      pg_catalog.substr(v,14,3) || '-8' || pg_catalog.substr(v,18,3) || '-' ||
      pg_catalog.substr(v,21,12)
    )::uuid
    from (select pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text) v) generated
  $$;
  create function extensions.gen_random_uuid() returns uuid language sql volatile
  as $$ select public.gen_random_uuid() $$;
  create function auth.uid() returns uuid language sql stable
  as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

  create table auth.users (id uuid primary key);
  create table public.academy_headquarters (
    id uuid primary key,
    owner_user_id uuid not null references auth.users(id),
    access_mode text not null
  );
  create table public.academy_instructors (
    id uuid primary key,
    headquarters_id uuid not null references public.academy_headquarters(id),
    user_id uuid references auth.users(id),
    is_active boolean not null,
    registration_status text not null
  );
  create table public.community_communities (
    id uuid primary key,
    slug text not null,
    name text not null,
    status text not null,
    owner_user_id uuid references auth.users(id)
  );
  create table public.community_memberships (
    id uuid primary key default public.gen_random_uuid(),
    community_id uuid not null references public.community_communities(id),
    user_id uuid not null references auth.users(id),
    role text not null,
    status text not null,
    access_scope text not null,
    unique (community_id, user_id)
  );
  create table public.community_entitlement_definitions (
    community_id uuid not null references public.community_communities(id),
    key text not null,
    name text not null,
    status text not null,
    primary key (community_id, key)
  );
  create table public.community_access_source_mappings (
    id uuid primary key,
    community_id uuid not null references public.community_communities(id),
    provider_type text not null,
    provider_owner_key text not null,
    source_product_key text not null,
    entitlement_key text not null,
    status text not null,
    created_by_user_id uuid not null references auth.users(id)
  );
  create table public.community_rooms (
    id uuid primary key,
    community_id uuid not null references public.community_communities(id),
    title text not null,
    access_type text not null,
    is_archived boolean not null default false
  );
  create table public.community_room_entitlement_rules (
    community_id uuid not null,
    room_id uuid not null references public.community_rooms(id),
    entitlement_key text not null,
    primary key (room_id, entitlement_key)
  );
  create table public.community_member_entitlements (
    id uuid primary key default public.gen_random_uuid(),
    community_id uuid not null,
    user_id uuid not null,
    entitlement_key text not null,
    source text not null,
    source_reference text not null,
    status text not null,
    starts_at timestamptz not null,
    ends_at timestamptz
  );
  create table public.community_academy_access_invitations (
    id uuid primary key default public.gen_random_uuid(),
    mapping_id uuid not null references public.community_access_source_mappings(id),
    community_id uuid not null references public.community_communities(id),
    user_id uuid not null references auth.users(id),
    entitlement_key text not null,
    source_reference text not null,
    academy_role text not null,
    status text not null default 'pending',
    starts_at timestamptz not null default pg_catalog.now(),
    ends_at timestamptz,
    expires_at timestamptz,
    accepted_at timestamptz,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now(),
    constraint community_academy_access_invitations_status_check
      check (status in ('pending', 'accepted', 'revoked', 'expired')),
    unique (mapping_id, user_id, source_reference)
  );
  create table public.community_academy_entitlement_claims (
    id uuid primary key default public.gen_random_uuid(),
    invitation_id uuid not null references public.community_academy_access_invitations(id),
    mapping_id uuid not null,
    community_id uuid not null,
    user_id uuid not null,
    entitlement_key text not null,
    source_reference text not null,
    academy_role text not null,
    status text not null,
    starts_at timestamptz not null,
    ends_at timestamptz,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
  );
  create table community_private.test_contracts (
    community_id uuid primary key,
    actor_user_id uuid not null,
    status text not null,
    current_period_start timestamptz not null,
    current_period_end timestamptz not null,
    write_allowed boolean not null,
    read_allowed boolean not null
  );

  create function community_private.community_owner_write_allowed(uuid,timestamptz)
  returns boolean language sql stable security definer set search_path=''
  as $$ select exists(select 1 from community_private.test_contracts c where c.community_id=$1 and c.write_allowed) $$;
  create function community_private.community_owner_read_allowed(uuid,uuid,timestamptz)
  returns boolean language sql stable security definer set search_path=''
  as $$ select exists(select 1 from community_private.test_contracts c where c.community_id=$1 and c.actor_user_id=$2 and c.read_allowed) $$;
  create function community_private.community_platform_access_window(uuid,timestamptz)
  returns table(actor_user_id uuid,status text,current_period_start timestamptz,current_period_end timestamptz,write_allowed boolean,owner_read_until timestamptz,anonymize_after timestamptz)
  language sql stable security definer set search_path=''
  as $$ select c.actor_user_id,c.status,c.current_period_start,c.current_period_end,c.write_allowed,c.current_period_end + interval '90 days',c.current_period_end + interval '90 days' from community_private.test_contracts c where c.community_id=$1 $$;
  create function community_private.is_staff(uuid) returns boolean
  language sql stable security definer set search_path=''
  as $$ select exists(select 1 from public.community_communities c where c.id=$1 and c.owner_user_id=(select auth.uid())) $$;
  create function private.academy_headquarters_role(uuid,uuid) returns text
  language sql stable security definer set search_path=''
  as $$ select case when exists(select 1 from public.academy_headquarters h where h.id=$1 and h.owner_user_id=$2) then 'owner' end $$;
  create function private.academy_can_manage_headquarters(uuid) returns boolean
  language sql stable security definer set search_path=''
  as $$ select coalesce(private.academy_headquarters_role($1,(select auth.uid())) in ('owner','administrator'),false) $$;
  create function private.academy_headquarters_access_mode(uuid) returns text
  language sql stable security definer set search_path=''
  as $$ select h.access_mode from public.academy_headquarters h where h.id=$1 $$;
  create function community_private.community_assert_new_membership_capacity(uuid,uuid,timestamptz)
  returns void language plpgsql security definer set search_path=''
  as $$ begin return; end $$;
  create function community_private.refresh_academy_subscription_entitlement(uuid,uuid,text)
  returns void language plpgsql security definer set search_path=''
  as $$
  begin
    if not exists (
      select 1 from public.community_member_entitlements e
      where e.community_id=$1 and e.user_id=$2 and e.status='active'
        and e.source <> 'academy_subscription'
    ) then
      update public.community_memberships set status='left'
      where community_id=$1 and user_id=$2 and access_scope='linked_rooms';
    end if;
  end $$;
  create function public.community_accept_academy_invitation_pre_capacity(uuid,text,text,text,text,boolean,boolean,boolean)
  returns uuid language plpgsql security definer set search_path=''
  as $$
  declare v public.community_academy_access_invitations;
  begin
    select * into v from public.community_academy_access_invitations where id=$1 for update;
    insert into public.community_memberships(community_id,user_id,role,status,access_scope)
    values(v.community_id,v.user_id,'member','active','linked_rooms')
    on conflict(community_id,user_id) do update set status='active';
    insert into public.community_academy_entitlement_claims(
      invitation_id,mapping_id,community_id,user_id,entitlement_key,source_reference,
      academy_role,status,starts_at,ends_at
    ) values(v.id,v.mapping_id,v.community_id,v.user_id,v.entitlement_key,v.source_reference,v.academy_role,'active',v.starts_at,v.ends_at);
    update public.community_academy_access_invitations
    set status='accepted',accepted_at=pg_catalog.now() where id=v.id;
    return v.id;
  end $$;
  create function community_private.can_access_room(uuid) returns boolean language sql as $$ select false $$;
  create function community_private.guard_academy_invitation_identity() returns trigger language plpgsql as $$ begin return new; end $$;
  create trigger community_academy_access_invitations_identity_guard before update on public.community_academy_access_invitations for each row execute function community_private.guard_academy_invitation_identity();
`);

await db.exec(migration);

async function setActor(userId, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select pg_catalog.set_config('request.jwt.claim.sub',$1,false)", [userId]);
  await db.query("select pg_catalog.set_config('request.jwt.claim.role',$1,false)", [role]);
  await db.query("select pg_catalog.set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: userId, role, is_anonymous: false })]);
  await db.exec(`set role ${role}`);
}

async function value(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0]?.value;
}

assert.equal(await value("select count(*)::int value from community_private.academy_community_invitation_policies"), 0, "production policy must not be seeded");

await db.exec(`
  insert into auth.users(id) values ('${OWNER}'),('${INSTRUCTOR}'),('${OUTSIDER}');
  insert into public.academy_headquarters(id,owner_user_id,access_mode) values
    ('${HQ}','${OWNER}','paid'),('${OTHER_HQ}','${OUTSIDER}','paid');
  insert into public.academy_instructors(id,headquarters_id,user_id,is_active,registration_status)
    values('${INSTRUCTOR_ROW}','${HQ}','${INSTRUCTOR}',true,'registered');
  insert into public.community_communities(id,slug,name,status,owner_user_id) values
    ('${COMMUNITY}','release-community','Release Community','active','${OWNER}'),
    ('${OTHER_COMMUNITY}','other-community','Other Community','active','${OUTSIDER}');
  insert into community_private.test_contracts(community_id,actor_user_id,status,current_period_start,current_period_end,write_allowed,read_allowed)
    values('${COMMUNITY}','${OWNER}','active',now()-interval '1 day',now()+interval '29 days',true,true),
          ('${OTHER_COMMUNITY}','${OUTSIDER}','active',now()-interval '1 day',now()+interval '29 days',true,true);
  insert into public.community_memberships(community_id,user_id,role,status,access_scope) values
    ('${COMMUNITY}','${OWNER}','owner','active','community'),
    ('${COMMUNITY}','${INSTRUCTOR}','member','active','community');
  insert into public.community_entitlement_definitions(community_id,key,name,status)
    values
      ('${COMMUNITY}','academy-room','Academy room','active'),
      ('${COMMUNITY}','existing-manual','Existing manual right','active');
  insert into public.community_access_source_mappings(id,community_id,provider_type,provider_owner_key,source_product_key,entitlement_key,status,created_by_user_id)
    values('${MAPPING}','${COMMUNITY}','academy_subscription','${HQ}','course:first','academy-room','active','${OWNER}');
  insert into public.community_rooms(id,community_id,title,access_type,is_archived) values
    ('${ROOM}','${COMMUNITY}','Invited room','entitlement',false),
    ('${ADDED_ROOM}','${COMMUNITY}','Later room','entitlement',false);
  insert into public.community_room_entitlement_rules(community_id,room_id,entitlement_key)
    values('${COMMUNITY}','${ROOM}','academy-room');
  insert into public.community_member_entitlements(community_id,user_id,entitlement_key,source,source_reference,status,starts_at)
    values('${COMMUNITY}','${INSTRUCTOR}','existing-manual','manual','existing-manual','active',now()-interval '1 day');
  insert into community_private.academy_community_invitation_policies(key,status,inviter_authority,invitation_ttl,allow_during_academy_trial)
    values
      ('test_owner_paid','active','community_owner',interval '14 days',false),
      ('test_legacy_trial_flag','active','community_owner',interval '7 days',true);
`);

await setActor(OWNER);
const overview = await value("select public.academy_get_community_release_overview($1,$2) value", [HQ, COMMUNITY]);
assert.equal(overview.contract.kind, "available");
assert.equal(overview.activeMemberCount, 2);
assert.equal(overview.invitationCount, 0);

await assert.rejects(
  db.query("select public.academy_get_community_release_overview($1,$2)", [OTHER_HQ, COMMUNITY]),
  /Academy headquarters management is required/
);
await assert.rejects(
  db.query("select public.academy_get_community_release_overview($1,$2)", [HQ, OTHER_COMMUNITY]),
  /Community owner authority is required/
);

await db.exec("reset role");
await db.exec(`update public.academy_headquarters set access_mode='trial_active' where id='${HQ}'`);
await setActor(OWNER);
await assert.rejects(
  db.query("select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6)", [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_legacy_trial_flag"]),
  /Current paid Academy access is required/
);
await db.exec("reset role");
await db.exec(`update public.academy_headquarters set access_mode='paid' where id='${HQ}'`);
await setActor(OWNER);

await assert.rejects(
  db.query("select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6)", [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ADDED_ROOM], "test_owner_paid"]),
  /Requested Room scope is not allowed/
);

const first = await value(
  "select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6) value",
  [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_owner_paid"]
);
const duplicate = await value(
  "select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6) value",
  [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_owner_paid"]
);
assert.equal(first.reused, false);
assert.equal(duplicate.reused, true);
assert.equal(duplicate.id, first.id);

await setActor(OUTSIDER);
await assert.rejects(
  db.query("select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6)", [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_owner_paid"]),
  /Academy headquarters management is required/
);

await db.exec("reset role");
await db.exec("update community_private.academy_community_invitation_policies set status='retired' where key='test_owner_paid'");
await setActor(INSTRUCTOR);
await assert.rejects(
  db.query("select public.community_accept_academy_access_invitation($1,'Instructor','Instructor','09000000000','',true,true,true)", [first.id]),
  /Current Academy Community invitation policy is required/
);
await db.exec("reset role");
await db.exec("update community_private.academy_community_invitation_policies set status='active' where key='test_owner_paid'");
await db.exec(`update public.academy_headquarters set access_mode='blocked' where id='${HQ}'`);
await setActor(INSTRUCTOR);
await assert.rejects(
  db.query("select public.community_accept_academy_access_invitation($1,'Instructor','Instructor','09000000000','',true,true,true)", [first.id]),
  /Current paid Academy access is required/
);
await db.exec("reset role");
await db.exec(`update public.academy_headquarters set access_mode='paid' where id='${HQ}'`);
await setActor(INSTRUCTOR);
await value(
  "select public.community_accept_academy_access_invitation($1,'Instructor','Instructor','09000000000','',true,true,true) value",
  [first.id]
);
await db.exec("reset role");
await db.exec(`insert into public.community_room_entitlement_rules(community_id,room_id,entitlement_key) values('${COMMUNITY}','${ADDED_ROOM}','academy-room')`);
await setActor(INSTRUCTOR);
assert.equal(await value("select community_private.can_access_room($1) value", [ROOM]), true, "snapshotted room is accessible");
assert.equal(await value("select community_private.can_access_room($1) value", [ADDED_ROOM]), false, "later room expansion is denied");

await setActor(OWNER);
assert.equal(await value("select public.academy_cancel_community_instructor_invitation($1,$2,$3) value", [HQ, COMMUNITY, first.id]), "revoked");
await db.exec("reset role");
assert.equal(await value("select status value from public.community_memberships where community_id=$1 and user_id=$2", [COMMUNITY, INSTRUCTOR]), "active");
assert.equal(await value("select count(*)::int value from public.community_member_entitlements where community_id=$1 and user_id=$2 and source='manual' and status='active'", [COMMUNITY, INSTRUCTOR]), 1, "manual right is preserved");

await setActor(OWNER);
const second = await value(
  "select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6) value",
  [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_owner_paid"]
);
assert.notEqual(second.id, first.id, "reissue keeps history");
await setActor(INSTRUCTOR);
assert.equal(await value("select public.community_decline_my_academy_access_invitation($1) value", [second.id]), "declined");

await setActor(OWNER);
const third = await value(
  "select public.academy_issue_community_instructor_invitation($1,$2,$3,$4,$5,$6) value",
  [HQ, COMMUNITY, MAPPING, INSTRUCTOR_ROW, [ROOM], "test_owner_paid"]
);
await db.exec("reset role");
await db.query("update public.community_academy_access_invitations set expires_at=now()-interval '1 second' where id=$1", [third.id]);
await setActor(OWNER, "service_role");
assert.equal(await value("select public.community_expire_academy_access_invitations(now()) value"), 1);
await db.exec("reset role");
assert.equal(await value("select status value from public.community_academy_access_invitations where id=$1", [third.id]), "expired");

await db.close();
console.log("community_academy_release_access_contract_pglite_ok");
