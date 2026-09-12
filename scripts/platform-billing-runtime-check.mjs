// Actual local SQL + actual TS store/orchestration + FAKE provider; no TCP or real credentials.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { executeTestCheckout } = await import('../lib/billing/platform/checkout.ts');
const { createCheckoutStore } = await import('../lib/billing/platform/store.ts');
if (process.argv[2] !== '--run-local') throw Error('Explicit --run-local required; disposable container only');
const docker = 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const container = 'mikke-platform-billing-check-20260901';
function command(args, input) {
  const r = spawnSync(docker,args,{input,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  if (r.status !== 0) { const state=r.stderr?.match(/ERROR:\s+([0-9A-Z]{5})/); const e=Error('Local SQL failed');e.code=state?.[1]??'LOCAL_SQL_FAILED';throw e; }
  return r.stdout.trim();
}
const info=JSON.parse(command(['inspect',container]))[0];
if(info.Config.Image!=='postgres:17.6'||info.HostConfig.NetworkMode!=='none'||Object.keys(info.HostConfig.PortBindings??{}).length)throw Error('Isolation mismatch');
const sql=(database,query)=>command(['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','postgres','-d',database],query);
const db='billing_checkout_runtime';
sql('postgres',`create database ${db};`);
const owner='a0000000-0000-4000-8000-000000000091';
const resource='a0000000-0000-4000-8000-000000000092';
const request='a0000000-0000-4000-8000-000000000093';
sql(db,`create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean not null default false);insert into auth.users(id)values('${owner}');`);
const migration=readFileSync(new URL('../supabase/migrations/20260831180143_platform_billing_checkout_ledger.sql',import.meta.url),'utf8');
sql(db,migration);
const now=new Date();
const currentDay=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
const nextDay=new Date(now.getTime()+40*86400000).toISOString().slice(0,10);
const scope={ownerUserId:owner,productKey:'community_platform',resourceId:resource,planKey:'fixture',requestId:request};
const expected={...scope,policyApprovalId:'fixture-policy',policyRevision:1};
const ref={version:'fixture-v1',url:'https://example.invalid/policy'};
const quote={quoteId:'quote-runtime-fixture',revision:1,purchaseIntent:'explicit_paid_start',scope,currency:'JPY',taxIncluded:true,
  dueNow:{totalYen:123,dueOn:currentDay},nextPayment:{totalYen:456,dueOn:nextDay},
  merchant:{merchantId:'fixture',legalName:'Fixture',address:'Fixture',contactUrl:'https://example.invalid/contact'},
  policies:{approved:true,approvalId:'fixture-policy',revision:1,...Object.fromEntries(['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'].map(k=>[k,ref]))},
  issuedAt:new Date(now.getTime()-1000).toISOString(),expiresAt:new Date(now.getTime()+3600000).toISOString()};
const signatures={
  platform_billing_quote_save:['p_actor_user_id','p_quote'],platform_billing_quote_get:['p_actor_user_id','p_quote_id'],
  platform_billing_attempt_reserve:['p_actor_user_id','p_quote_id','p_consent'],
  platform_billing_attempt_mark_ready:['p_actor_user_id','p_attempt_id','p_provider_session_id','p_provider_result_hash'],
  platform_billing_attempt_mark_uncertain:['p_actor_user_id','p_attempt_id']
};
const literal=value=>`'${(typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")}'`;
const store=createCheckoutStore(async(name,args,signal)=>{
  signal.throwIfAborted();
  const fields=signatures[name];if(!fields||Object.keys(args).length!==fields.length||fields.some(k=>!Object.hasOwn(args,k)))throw Error('Invalid local RPC');
  try {return{data:JSON.parse(sql(db,`begin;set local role service_role;select public.${name}(${fields.map(k=>literal(args[k])).join(',')});commit;`)),error:null};}
  catch(e){return{data:null,error:{code:e.code}};}
});
const signal=new AbortController().signal;
await store.saveQuote(quote,expected,now,signal);
await store.saveQuote(quote,expected,now,signal);
assert.deepEqual(await store.loadQuote(owner,quote.quoteId,signal),quote);
let creates=0,retrieves=0;
const providerSession={id:'cs_test_runtimefixture',url:'https://checkout.stripe.com/c/localfixture',expiresAt:quote.expiresAt};
const dependencies={...store,providerMode:'test',now:()=>new Date(),selectAuthorizedContext:async()=>expected,
  createTestSession:async()=>{creates++;return providerSession;},retrieveTestSession:async()=>{retrieves++;return providerSession;}};
const input={version:1,product:scope.productKey,resourceId:resource,planKey:'fixture',requestId:request,
  consent:{quoteId:quote.quoteId,revision:1,termsVersion:'fixture-v1',accepted:true}};
assert.deepEqual(await executeTestCheckout(input,dependencies,signal),{state:'redirect',redirectUrl:providerSession.url});
assert.deepEqual(await executeTestCheckout(input,dependencies,signal),{state:'redirect',redirectUrl:providerSession.url});
assert.equal(creates,1);assert.equal(retrieves,1);
const counts=JSON.parse(sql(db,"select json_build_object('quotes',(select count(*) from platform_billing_private.quotes),'attempts',(select count(*) from platform_billing_private.attempts),'ready',(select count(*) from platform_billing_private.attempts where status='provider_ready'));"));
assert.deepEqual(counts,{quotes:1,attempts:1,ready:1});
const changed={...quote,quoteId:'quote-runtime-other',scope:{...scope,requestId:'a0000000-0000-4000-8000-000000000094'}};
await store.saveQuote(changed,{...expected,requestId:changed.scope.requestId},new Date(),signal);
await assert.rejects(store.reserve(owner,changed.quoteId,{...input.consent,quoteId:changed.quoteId},signal),e=>e.code==='STATE_CONFLICT');
await assert.rejects(store.saveQuote({...quote,dueNow:{...quote.dueNow,totalYen:999}},expected,new Date(),signal),e=>e.code==='STATE_CONFLICT');
console.log(JSON.stringify({scope:'local-SQL-plus-TS-store-orchestrator-fake-provider',result:'pass',counts,providerCreates:creates,providerRetrieves:retrieves,secondRequestBlocked:true,immutableQuote:true,liveCalls:0}));
// The owning verification agent removes the entire named container after all tests.
