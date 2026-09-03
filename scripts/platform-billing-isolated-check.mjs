// Standalone local SQL-store proof, NOT full app / Supabase JWT integration.
// Never connects through TCP or a URL. Requires the explicit disposable container.
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const container = 'mikke-platform-billing-check-20260901';
function command(args, input) {
  const r = spawnSync(docker, args, {input, encoding:'utf8', timeout:240000, maxBuffer:8*1024*1024});
  if(r.status!==0) throw new Error(r.stderr || r.error?.message || `exit ${r.status}`);
  return r.stdout;
}
const inspect = JSON.parse(command(['inspect',container]))[0];
if(inspect.Config.Image!=='postgres:17.6' || inspect.HostConfig.NetworkMode!=='none' || Object.keys(inspect.HostConfig.PortBindings??{}).length || inspect.HostConfig.Tmpfs?.['/var/lib/postgresql/data']!=='rw') throw new Error('disposable isolation mismatch');
const psql = sql => command(['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],sql);
const bootstrap = `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key,is_anonymous boolean not null default false);`;
function snapshot() {
  const sql = `select json_build_object(
    'schemas',(select count(*) from pg_namespace where nspname='platform_billing_private'),
    'relations',(select md5(coalesce(string_agg(row_to_json(c)::text,'|' order by c.oid),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('platform_billing_private','auth','public')),
    'columns',(select md5(coalesce(string_agg(row_to_json(a)::text,'|' order by a.attrelid,a.attnum),'')) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('platform_billing_private','auth','public')),
    'functions',(select md5(coalesce(string_agg(row_to_json(p)::text,'|' order by p.oid),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('platform_billing_private','auth','public')),
    'constraints',(select md5(coalesce(string_agg(row_to_json(c)::text,'|' order by c.oid),'')) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('platform_billing_private','auth','public')),
    'indexes',(select md5(coalesce(string_agg(row_to_json(i)::text,'|' order by i.indexrelid),'')) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('platform_billing_private','auth','public')),
    'policies',(select md5(coalesce(string_agg(row_to_json(p)::text,'|' order by p.oid),'')) from pg_policy p),
    'triggers',(select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by t.oid),'')) from pg_trigger t),
    'authFixtureCount',(select count(*) from auth.users),
    'authFixtureFingerprint',(select md5(coalesce(string_agg(row_to_json(u)::text,'|' order by id),'')) from auth.users u));`;
  return JSON.parse(psql(sql).trim());
}
const mode=process.argv[2];
if(mode==='--bootstrap') { psql(bootstrap); console.log('billing_sql_synthetic_platform_ready'); }
else if(mode==='--rollback'||mode==='--syntax') {
  const [migrationName,testName]=process.argv.slice(3);
  for(const name of mode==='--syntax'?[migrationName]:[migrationName,testName]) if(!name || !/^[a-zA-Z0-9_]+\.sql$/.test(name)) throw new Error('explicit SQL basename required');
  const migration=readFileSync(path.join(root,'supabase/migrations',migrationName),'utf8');
  const test=mode==='--syntax'?"select 'billing_migration_syntax_ok';":readFileSync(path.join(root,'supabase/tests',testName),'utf8');
  if(/^\s*(begin|commit|rollback)\s*;/mi.test(test)) throw new Error('test must be caller transaction managed');
  const before=snapshot();
  const result=psql(['begin;',"set local lock_timeout='5s';set local statement_timeout='180s';set local idle_in_transaction_session_timeout='240s';",migration,test,'rollback;'].join('\n'));
  const sentinel=mode==='--syntax'?'billing_migration_syntax_ok':'platform_billing_checkout_ledger_test_ok';
  if(!result.split(/\r?\n/).includes(sentinel)) throw new Error('required success sentinel absent');
  const after=snapshot();
  const changes=Object.fromEntries(Object.keys(before).map(k=>[k,before[k]===after[k]?0:1]));
  if(Object.values(changes).some(Boolean)||after.schemas!==0||after.authFixtureCount!==0) throw new Error('rollback residue '+JSON.stringify(changes));
  console.log(JSON.stringify({scope:'standalone-local-SQL-role-simulation-only',migrationSHA256:createHash('sha256').update(migration).digest('hex'),testSHA256:createHash('sha256').update(test).digest('hex'),testOutput:result,rollback:true,residualChanges:changes,privateSchemaCount:after.schemas,authFixtureCount:after.authFixtureCount}));
} else if(mode==='--race') {
  const migrationName=process.argv[3];
  if(!/^[a-zA-Z0-9_]+\.sql$/.test(migrationName??'')) throw new Error('explicit migration basename required');
  const actor='a9010000-0000-4000-8000-000000000001';
  const now=new Date(),jstDay=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
  const later=new Date(now.getTime()+32*86400000+9*3600000).toISOString().slice(0,10);
  const policy={version:'local-v1',url:'https://example.invalid/policy'};
  const quote={quoteId:'local-reserve-race',revision:1,purchaseIntent:'explicit_paid_start',scope:{ownerUserId:actor,productKey:'academy_platform',resourceId:null,planKey:'small',requestId:'b9010000-0000-4000-8000-000000000099'},currency:'JPY',taxIncluded:true,dueNow:{totalYen:5000,dueOn:jstDay},nextPayment:{totalYen:5000,dueOn:later},merchant:{merchantId:'local-merchant',legalName:'Synthetic fixture',address:'Synthetic fixture only',contactUrl:'https://example.invalid/contact'},policies:{approved:true,approvalId:'local-approval',revision:1,terms:policy,privacy:policy,refund:policy,cancellation:policy,proration:policy,renewal:policy,commercialDisclosure:policy},issuedAt:new Date(now.getTime()-60000).toISOString(),expiresAt:new Date(now.getTime()+30*60000).toISOString()};
  const consent={quoteId:quote.quoteId,revision:1,termsVersion:'local-v1',accepted:true};
  const literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
  // Fixtures persist only in this disposable local postgres DB until container removal.
  psql(['begin;',readFileSync(path.join(root,'supabase/migrations',migrationName),'utf8'),`insert into auth.users values('${actor}',false);set local role service_role;select public.platform_billing_quote_save('${actor}',${literal(quote)});`,'commit;'].join('\n'));
  const reserve=`select public.platform_billing_attempt_reserve('${actor}','${quote.quoteId}',${literal(consent)});`;
  let firstSignal;
  const firstReserved=new Promise(resolve=>{firstSignal=resolve;});
  function connection(sql, signal) {
    return new Promise((resolve,reject)=>{
      const child=spawn(docker,['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']);
      let out='',err='';
      const timer=setTimeout(()=>{child.kill();reject(new Error('race timeout'));},30000);
      child.stdout.on('data',chunk=>{out+=chunk.toString();if(signal&&out.includes('"attempt_id"'))signal();});
      child.stderr.on('data',chunk=>{err+=chunk.toString();});
      child.on('error',reject);child.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error(err||`race exit ${code}`));});
      child.stdin.end(sql);
    });
  }
  const first=connection(`begin;set local lock_timeout='10s';set local statement_timeout='20s';set local role service_role;${reserve}select pg_sleep(5);commit;`,firstSignal);
  await Promise.race([firstReserved,first.then(()=>{throw new Error('first did not reserve');})]);
  const secondStarted=Date.now();
  const second=connection(`begin;set local application_name='billing_local_second';set local lock_timeout='10s';set local statement_timeout='20s';set local role service_role;${reserve}commit;`);
  const [a,b]=await Promise.all([first,second]);
  const parse=out=>JSON.parse(out.split(/\r?\n/).find(line=>line.startsWith('{')));
  const aa=parse(a),bb=parse(b);
  const counts=JSON.parse(psql("select json_build_object('scopes',(select count(*) from platform_billing_private.scopes),'quotes',(select count(*) from platform_billing_private.quotes),'attempts',(select count(*) from platform_billing_private.attempts));").trim());
  if(aa.attempt_id!==bb.attempt_id || aa.provider_idempotency_key!==bb.provider_idempotency_key || [aa.created,bb.created].filter(Boolean).length!==1 || counts.attempts!==1) throw new Error('reserve race invariant failed');
  console.log(JSON.stringify({scope:'disposable-local-postgres-only',twoConnections:true,sameAttempt:true,sameProviderIdempotencyKey:true,createdCount:1,counts,secondElapsedMs:Date.now()-secondStarted,cleanup:'container removal required after root runtime tests'}));
} else throw new Error('modes: --bootstrap | --syntax <migration.sql> | --rollback <migration.sql> <test.sql> | --race <migration.sql>');
