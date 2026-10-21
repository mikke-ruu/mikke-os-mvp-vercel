// Run with PGLITE_MODULE pointing at an isolated @electric-sql/pglite installation.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
(async()=>{
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
create table public.team_works_organizations(id uuid primary key,owner_user_id uuid,name text);
create table public.team_works_projects(id uuid primary key,organization_id uuid,style text default 'operations',status text default 'active', title text,description text,contract_started_on date,contract_ended_on date);
create table public.team_works_organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,source_local_id text,display_name text,role text,status text,unique(organization_id,source_local_id));
create unique index active_role on public.team_works_organization_members(organization_id,user_id,role) where status<>'archived';
create table public.team_works_partners(id uuid primary key,organization_id uuid,display_name text,email text,status text);
create table public.team_works_clients(like public.team_works_partners including all);
create table public.team_works_project_partners(project_id uuid,organization_id uuid,partner_id uuid,status text check(status in ('invited','active','paused','archived')),updated_at timestamptz,primary key(project_id,partner_id));
create table public.team_works_project_clients(project_id uuid,organization_id uuid,client_id uuid,status text check(status in ('invited','active','paused','archived')),updated_at timestamptz,primary key(project_id,client_id));
create table public.team_works_project_members(project_id uuid,organization_id uuid,organization_member_id uuid,project_role text,primary key(project_id,organization_member_id));
create table public.team_works_member_invites(id uuid primary key default gen_random_uuid(),project_id uuid,organization_id uuid,email text,role text,status text default 'pending',updated_at timestamptz);
create table public.team_works_project_partner_settings(project_id uuid,organization_member_id uuid,status text default 'active',hourly_wage numeric,primary key(project_id,organization_member_id),foreign key(project_id,organization_member_id) references public.team_works_project_members);
create table public.team_works_project_partner_offers(project_id uuid,organization_member_id uuid,status text default 'pending' check(status in ('pending','accepted','declined','removed')),updated_at timestamptz,primary key(project_id,organization_member_id),foreign key(project_id,organization_member_id) references public.team_works_project_members);
create function private.team_works_is_org_staff(target_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.team_works_organizations o where o.id=target_organization_id and o.owner_user_id=auth.uid()) or exists(select 1 from public.team_works_organization_members m where m.organization_id=target_organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','manager'))$$;
create function private.team_works_is_project_staff(target_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.team_works_projects p join public.team_works_organizations o on o.id=p.organization_id where p.id=target_project_id and o.owner_user_id=auth.uid()) or exists(select 1 from public.team_works_project_members pm join public.team_works_organization_members m on m.id=pm.organization_member_id where pm.project_id=target_project_id and m.user_id=auth.uid() and m.status='active' and pm.project_role in ('owner','manager'))$$;
create function public.team_works_find_active_member(target_organization_id uuid,target_role text,target_email text) returns table(member_id uuid,display_name text) language sql security definer set search_path='' as $$select m.id,m.display_name from public.team_works_organization_members m join auth.users u on u.id=m.user_id where private.team_works_is_org_staff(target_organization_id) and m.organization_id=target_organization_id and m.role=target_role and m.status='active' and lower(u.email)=lower(target_email)$$;
grant usage on schema public,private,auth to authenticated;
grant select,insert,update on all tables in schema public to authenticated;
`);
// Mirror the production staff policies relevant to these mutations.
for(const table of ['team_works_projects','team_works_organization_members','team_works_partners','team_works_clients','team_works_project_partners','team_works_project_clients','team_works_project_members','team_works_member_invites']) {
 await db.exec(`alter table public.${table} enable row level security; create policy staff on public.${table} to authenticated using(private.team_works_is_org_staff(organization_id)) with check(private.team_works_is_org_staff(organization_id));`);
}
for(const table of ['team_works_project_partner_settings','team_works_project_partner_offers']) {
 await db.exec(`alter table public.${table} enable row level security; create policy staff on public.${table} to authenticated using(private.team_works_is_project_staff(project_id)) with check(private.team_works_is_project_staff(project_id));`);
}
await db.exec(`insert into auth.users(id,email) values('${id(1)}','owner@example.test'),('${id(2)}','manager@example.test'),('${id(3)}','worker@example.test'),('${id(4)}','client@example.test'),('${id(5)}','outsider@example.test');
insert into team_works_organizations values('${id(10)}','${id(1)}','A'),('${id(11)}','${id(5)}','B');
insert into team_works_projects(id,organization_id) values('${id(20)}','${id(10)}'),('${id(21)}','${id(10)}'),('${id(22)}','${id(11)}');
insert into team_works_organization_members(id,organization_id,user_id,role,status) values('${id(30)}','${id(10)}','${id(2)}','manager','active');
insert into team_works_partners values('${id(40)}','${id(10)}','Worker','worker@example.test','active');
insert into team_works_clients values('${id(41)}','${id(10)}','Client','client@example.test','active');
insert into team_works_project_partners values('${id(20)}','${id(10)}','${id(40)}','invited',now()),('${id(21)}','${id(10)}','${id(40)}','invited',now());
insert into team_works_project_clients values('${id(20)}','${id(10)}','${id(41)}','invited',now());
insert into team_works_member_invites(project_id,organization_id,email,role) values('${id(20)}','${id(10)}','worker@example.test','worker'),('${id(21)}','${id(10)}','worker@example.test','worker'),('${id(20)}','${id(10)}','client@example.test','client_user');`);
const asUser=async(n,sql)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(n)}',false);`);try{return await db.query(sql)}finally{await db.exec('reset role')}};
const scalar=async(sql)=>(await db.query(sql)).rows[0].value;
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260726180000_team_works_r6_activation_hotfix.sql'),'utf8'));
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260726170000_team_works_r6_client_project_approval.sql'),'utf8'));
await asUser(3,'select public.team_works_activate_portal_membership()');
const workerId=await scalar(`select id as value from team_works_organization_members where user_id='${id(3)}'`);
await db.exec(`insert into team_works_project_members values('${id(20)}','${id(10)}','${workerId}','worker')`);
await assert.rejects(asUser(2,`insert into team_works_project_partner_settings values('${id(20)}','${workerId}','active',1500)`),/row-level security/);
console.log('PASS reproduced organization-manager settings rejection before fix');
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261021081945_team_works_invitation_lifecycle.sql'),'utf8'));
await asUser(2,`insert into team_works_project_partner_settings values('${id(20)}','${workerId}','active',1500)`);
console.log('PASS same organization manager can save operations settings');
await assert.rejects(asUser(5,`insert into team_works_project_partner_settings values('${id(21)}','${workerId}','active',999)`),/row-level security/);
await assert.rejects(asUser(2,`select team_works_cancel_project_invitation('${id(20)}','worker@example.test',null)`),/not allowed/);
console.log('PASS settings reject unrelated organization and cancellation rejects missing role');
await asUser(2,`select team_works_cancel_project_invitation('${id(21)}','worker@example.test','worker')`);
await asUser(3,'select public.team_works_activate_portal_membership()');
await asUser(3,'select public.team_works_activate_portal_membership()');
assert.equal(await scalar(`select count(*)::int as value from team_works_project_partner_offers where project_id='${id(20)}'`),1);
assert.equal(await scalar(`select count(*)::int as value from team_works_project_members where project_id='${id(21)}'`),0);
assert.equal(await scalar(`select hourly_wage::int as value from team_works_project_partner_settings where project_id='${id(20)}'`),1500);
console.log('PASS activation delivers one pending offer, preserves rate, and cannot revive canceled project');
await assert.rejects(asUser(5,`select team_works_cancel_project_invitation('${id(20)}','worker@example.test','worker')`),/not allowed/);
await assert.rejects(asUser(3,`select team_works_cancel_project_invitation('${id(20)}','worker@example.test','worker')`),/not allowed/);
console.log('PASS outsider and invitee cannot cancel HQ invitations');
await asUser(2,`select team_works_cancel_project_invitation('${id(20)}','worker@example.test','worker')`);
await asUser(3,'select public.team_works_activate_portal_membership()');
assert.equal(await scalar(`select status as value from team_works_project_partner_offers where project_id='${id(20)}'`),'removed');
assert.equal(await scalar(`select count(*)::int as value from team_works_project_members where project_id='${id(20)}'`),1);
console.log('PASS cancellation clears offer and link without deleting historical membership');
await asUser(2,`select team_works_cancel_project_invitation('${id(20)}','client@example.test','client_user')`);
assert.equal(await scalar(`select status as value from team_works_project_clients where project_id='${id(20)}'`),'archived');
assert.equal(await scalar(`select status as value from team_works_member_invites where role='client_user'`),'revoked');
await asUser(4,'select public.team_works_activate_portal_membership()');
await assert.rejects(asUser(4,`select team_works_approve_client_project('${id(20)}')`),/no pending invitation/);
console.log('PASS canceled client link cannot be approved via portal RPC');
await db.exec(`update team_works_project_partners set status='invited' where project_id='${id(20)}'; update team_works_project_partner_offers set status='accepted' where project_id='${id(20)}'`);
await assert.rejects(asUser(2,`select team_works_cancel_project_invitation('${id(20)}','worker@example.test','worker')`),/参加済み/);
assert.equal(await scalar(`select status as value from team_works_project_partners where project_id='${id(20)}'`),'invited');
console.log('PASS accepted participant is protected and failed cancellation rolls back');
await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
