// Disposable PG17, synthetic surrounding schema, actual ingress/fence/candidate.
// Not full baseline, real JWT, provider, or an OS clock rollback experiment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
assert.equal(process.argv[2],'--run-isolated');
const docker='C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const name=`academy-clock-fault-${randomUUID()}`,scope='academy-clock-fault';
const run=(args,input,timeout=60000)=>{const r=spawnSync(docker,args,{input,encoding:'utf8',timeout,windowsHide:true});if(r.status!==0)throw new Error(`${args[0]}: ${r.stderr||r.error?.message}`);return r.stdout.trim();};
const args=['exec','-i',name,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
const sql=s=>run(args,`set statement_timeout='25s';set lock_timeout='15s';\n${s}`);
const json=s=>JSON.parse(sql(s).split(/\r?\n/).filter(x=>x.startsWith('{')).at(-1));
const file=n=>readFileSync(new URL(`../supabase/migrations/${n}`,import.meta.url),'utf8');
const ingress=file('20260908102540_academy_first_publication_ingress_authority.sql').split('create or replace function public.academy_first_publication_record_cancel')[0];
const fence=file('20260909003954_academy_receipt_proof_dispatch_fence.sql');
const candidate=file('20260909091836_academy_cancellation_clock_fault_hold.sql');
const a='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',anonymous='10000000-0000-4000-8000-000000000003';
const h='20000000-0000-4000-8000-000000000001',normal='20000000-0000-4000-8000-000000000002',concurrent='20000000-0000-4000-8000-000000000003',rollback='20000000-0000-4000-8000-000000000004';
const lease='30000000-0000-4000-8000-000000000001';
const auth=(actor=a)=>`set role authenticated;set request.jwt.claim.sub='${actor}';`;
const append=(hq,key)=>`select public.academy_first_publication_cancel_append('${hq}','${key}');`;
const setup=`
create role anon;create role authenticated;create role service_role;
create schema auth;create schema private;create schema academy_publication_private;
create table auth.users(id uuid primary key,is_anonymous boolean);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.academy_headquarters(id uuid primary key,owner_user_id uuid);
create table academy_publication_private.enrollments(headquarters_id uuid primary key,owner_user_id uuid,first_published_at timestamptz,trial_ends_at timestamptz,cancellation_accepted_at timestamptz,policy_version text);
create table academy_publication_private.preparations(headquarters_id uuid);
create table academy_publication_private.policies(version text,enabled boolean,dispatch_enabled boolean);
create table academy_publication_private.cancel_intents(headquarters_id uuid,received_at timestamptz);
create table academy_publication_private.outbox(event_key text primary key,headquarters_id uuid,kind text,lease_token uuid,lease_until timestamptz,delivered_at timestamptz,blocked boolean default false);
create function academy_publication_private.immutable_history() returns trigger language plpgsql as $$begin raise exception 'immutable_history';end$$;
create function private.academy_first_publication_lock(h uuid) returns void language plpgsql as $$begin perform 1 from academy_publication_private.receipt_scopes where headquarters_id=h for update;end$$;
`;
let owned=false,checks=0;
function check(actual,expected,note){assert.deepEqual(actual,expected,note);checks++;console.log(`PASS ${note}`);}
function session(s){const child=spawn(docker,args,{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='',err='';const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('session timeout'));},180000);child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',c=>{clearTimeout(timer);c===0?resolve(out):reject(new Error(err));});});done.catch(()=>{});child.stdin.write("set statement_timeout='120s';set lock_timeout='100s';\n"+s+'\n');return{done,end:s=>child.stdin.end(s+'\n'),output:()=>out};}
async function observed(fn,timeout=90000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('expected observation missing');}
function barrier(hq,signature='academy_publication_private.runtime_signature()') {return sql(`insert into academy_publication_private.receipt_barriers(headquarters_id,through_at,barrier_xid,observed_after_deadline_at,database_signature) select headquarters_id,trial_ends_at,pg_current_xact_id(),clock_timestamp()+interval '3 hours',${signature} from academy_publication_private.enrollments where headquarters_id='${hq}' returning barrier_id;`);}
try{
 run(['run','--pull=never','--detach','--name',name,'--label',`mikke.test.scope=${scope}`,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.6']);owned=true;
 const info=JSON.parse(run(['inspect',name]))[0];assert.equal(info.Config.Labels['mikke.test.scope'],scope);assert.equal(info.HostConfig.NetworkMode,'none');assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
 try { await observed(()=>spawnSync(docker,['exec',name,'pg_isready','-U','postgres'],{encoding:'utf8',timeout:10000,windowsHide:true}).status===0,120000); }
 catch(error) { console.error(run(['logs','--tail','40',name]));throw error; }
 sql(setup+ingress+fence+candidate);
 sql(`insert into auth.users values('${a}',false),('${other}',false),('${anonymous}',true);insert into academy_publication_private.policies values('fixture',false,false);
 insert into public.academy_headquarters select x::uuid,'${a}'::uuid from unnest(array['${h}','${normal}','${concurrent}','${rollback}']) x;
 insert into academy_publication_private.enrollments select id,owner_user_id,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',null,'fixture' from public.academy_headquarters;
 insert into academy_publication_private.receipt_scopes(headquarters_id) select id from public.academy_headquarters;
 insert into academy_publication_private.outbox values('event','${h}','start_paid','${lease}',clock_timestamp()+interval '1 hour',null,false);`);
 check(json(`set role service_role;select public.academy_first_publication_outbox_dispatch_check('event','${lease}');`).reason,'dispatch_not_activated','existing policy gate retained');
 check(sql('select count(*) from academy_publication_private.runtime_epoch_approvals'),'0','no epoch activation');
 // Different epoch is not a proven clock regression.
 barrier(normal,"'{\"different_epoch\":true}'::jsonb");
 const nk=randomUUID();check(json(auth()+append(normal,nk)).status,'awaiting_durable_acknowledgment','other epoch is not false-positive fault');
 check(json(auth()+`select public.academy_first_publication_cancel_acknowledge('${normal}','${nk}');`).status,'accepted','normal two-transaction acknowledgment preserved');
 // Concurrent barrier committed after the entry snapshot must not be blamed.
 const locker=session(`begin;select 1 from academy_publication_private.receipt_scopes where headquarters_id='${concurrent}' for update;select 'locked';`);
 await observed(()=>locker.output().includes('locked'));
 const waiting=session(`set application_name='clock-fault-concurrent-receipt';${auth()}${append(concurrent,randomUUID())}`);
 await observed(()=>sql("select count(*) from pg_stat_activity where application_name='clock-fault-concurrent-receipt' and wait_event_type='Lock'")==='1');
 barrier(concurrent);locker.end('commit;');await locker.done;waiting.end('');
 check(JSON.parse((await waiting.done).split(/\r?\n/).find(x=>x.startsWith('{'))).status,'awaiting_durable_acknowledgment','real concurrent post-snapshot barrier excluded');
 check(sql(`select count(*) from academy_publication_private.cancellation_clock_faults where headquarters_id='${concurrent}'`),'0','concurrent receipt has no fault');
 // Future barrier is synthetic fault injection, not an altered OS/production clock.
 barrier(h);const key=randomUUID();const result=json(auth()+append(h,key));
 check(result.status,'clock_fault','causally prior same epoch contradiction recorded');
 check(Object.keys(result).sort(),['billing_held','fault_id','headquarters_id','idempotency_key','status'],'public DTO excludes raw clock and evidence');
 check(json(auth()+append(h,key)),result,'same key preserves original fault');
 check(json(auth()+`select public.academy_first_publication_cancel_acknowledge('${h}','${key}');`),result,'separate read returns fault not accepted receipt');
 check(json(auth()+`select public.academy_first_publication_cancel_status('${h}');`),result,'reload recovers durable fault');
 check(sql(`select count(*) from academy_publication_private.receipt_inbox where headquarters_id='${h}'`),'0','no successful cancellation inbox');
 check(sql(`select last_sequence from academy_publication_private.receipt_scopes where headquarters_id='${h}'`),'0','fault consumes no receipt sequence');
 check(sql(`select intent='cancel_conversion' and raw_received_at<barrier_observed_at and pg_visible_in_snapshot(barrier_xid,entry_snapshot) from academy_publication_private.cancellation_clock_faults where fault_id='${result.fault_id}'`),'t','durable intent and causal audit evidence');
 check(json(`set role service_role;select public.academy_first_publication_outbox_dispatch_check('event','${lease}');`).reason,'clock_fault_hold','hold blocks worker independently of policy');
 for(const [actor,fn] of [[other,append(h,key)],[anonymous,append(h,key)],[other,`select public.academy_first_publication_cancel_status('${h}');`]]){
  assert.throws(()=>sql(auth(actor)+fn),/forbidden/);checks++;
 }
 for(const role of ['anon','service_role']){assert.throws(()=>sql(`set role ${role};${append(h,key)}`),/permission denied/);checks++;}
 for(const role of ['authenticated','service_role']){
  assert.throws(()=>sql(`set role ${role};select * from academy_publication_private.cancellation_clock_faults;`),/permission denied/);checks++;
  assert.throws(()=>sql(`set role ${role};select public.academy_dispatch_before_clock_fault('event','${lease}');`),/permission denied/);checks++;
 }
 for(const mutation of ['delete from','truncate','update']){
  const q=mutation==='update'?"update academy_publication_private.cancellation_clock_faults set reason=reason":`${mutation} academy_publication_private.cancellation_clock_faults`;
  assert.throws(()=>sql(q),/immutable_history/);checks++;
 }
 barrier(rollback);const rk=randomUUID();sql(`begin;${auth()}${append(rollback,rk)}rollback;`);
 check(sql(`select count(*) from academy_publication_private.cancellation_clock_faults where headquarters_id='${rollback}'`),'0','caller rollback is not misreported as durable');
 // Scope-locked dispatch waits for an uncommitted fault and observes commit.
 const producer=session(`begin;${auth()}${append(rollback,rk)}select 'fault_ready';`);await observed(()=>producer.output().includes('fault_ready'));
 sql(`insert into academy_publication_private.outbox values('waiting','${rollback}','start_paid','${lease}',clock_timestamp()+interval '1 hour',null,false);`);
 const worker=session(`set application_name='clock-fault-worker';set role service_role;select public.academy_first_publication_outbox_dispatch_check('waiting','${lease}');`);
 await observed(()=>sql("select count(*) from pg_stat_activity where application_name='clock-fault-worker' and wait_event_type='Lock'")==='1');
 producer.end('commit;');await producer.done;worker.end('');
 check(JSON.parse((await worker.done).split(/\r?\n/).find(x=>x.startsWith('{'))).reason,'clock_fault_hold','real waiter sees committed hold');
 check(sql('select count(*) from academy_publication_private.runtime_epoch_approvals'),'0','approval registry remains empty');
 console.log(JSON.stringify({checks,postgres:sql('show server_version'),candidateSha256:createHash('sha256').update(candidate).digest('hex'),scope:'minimal schema SQL-role and real lock tests only'}));
}finally{
 if(owned){const labels=JSON.parse(run(['inspect','--format','{{json .Config.Labels}}',name]));assert.equal(labels['mikke.test.scope'],scope);run(['rm','--force','--volumes',name]);check(run(['ps','-a','--filter',`name=^/${name}$`,'--format','{{.Names}}']),'','exact disposable container removed');}
}
