import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {createFirstPublicationStripe,nextPaidMonth}=await import('../lib/academy/first-publication-billing/stripe-runtime.ts');
const {processBillingJob}=await import('../lib/academy/first-publication-billing/worker.ts');
const {handleSetupRequest}=await import('../lib/academy/first-publication-billing/http.ts');
const owner='a1000000-0000-4000-8000-000000000001',hq='a1000000-0000-4000-8000-000000000002',quote='a1000000-0000-4000-8000-000000000003',attempt='a1000000-0000-4000-8000-000000000004';
const end=Date.parse('2026-09-15T00:00:00Z');
const config={secretKey:'sk_test_fixture',mode:'test',apiVersion:'2025-02-24.acacia',approvalId:'fixture',successUrl:'https://app.mikke-os.com/academy/settings',cancelUrl:'https://app.mikke-os.com/academy/settings'};
function fixture(amount=3300,plan='small'){
 const quantity=plan==='variable'?amount/100:1,unitAmount=plan==='variable'?100:amount;
 let clock=end+1000,allowed=true,openSetup=false,amountMismatch=false,paymentPending=false;
 const a={attempt_id:attempt,started_at:new Date(end).toISOString(),owner_user_id:owner,headquarters_id:hq,quote_id:quote,amount_yen:amount,policy_version:'fixture',provider_customer_id:'cus_A',checkout_session_id:'cs_test_A',setup_intent_id:'seti_A',payment_method_id:'pm_A',status:'verified'};
 const meta={scheme:'academy_first_publication_168h_v1',attempt_id:attempt,headquarters_id:hq,owner_user_id:owner,quote_id:quote};
 const checkpoints=new Map(),calls=[];let invoice,sub,item,result;
 const request=async(url,init)=>{
   calls.push({url,init});assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
   const path=new URL(url).pathname.replace('/v1/',''),body=init.body;let value;
   if(path==='customers')value={id:'cus_A',metadata:meta};
   else if(path.startsWith('checkout/sessions'))value={id:'cs_test_A',mode:'setup',customer:'cus_A',client_reference_id:attempt,metadata:meta,livemode:false,setup_intent:'seti_A',status:openSetup?'open':'complete',url:'https://checkout.stripe.com/c/test_A'};
   else if(path==='setup_intents/seti_A')value={id:'seti_A',status:'succeeded',usage:'off_session',customer:'cus_A',payment_method:'pm_A',metadata:meta,livemode:false};
   else if(path==='prices/price_A')value={id:'price_A',active:true,currency:'jpy',unit_amount:unitAmount,billing_scheme:'per_unit',transform_quantity:null,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
   else if(path==='invoices'){invoice={id:'in_A',status:'draft',currency:'jpy',customer:'cus_A',auto_advance:false,metadata:meta,livemode:false,total:0,amount_due:0,starting_balance:0};value=invoice;}
   else if(path==='invoiceitems'){assert.equal(body.get('invoice'),'in_A');assert.equal(Number(body.get('amount')),amount);item={id:'ii_A',invoice:'in_A',customer:'cus_A',amount,currency:'jpy'};invoice.total=invoice.amount_due=amountMismatch?amount+1:amount;value=item;}
   else if(path==='invoiceitems/ii_A')value=item;
   else if(path==='invoices/in_A/finalize'){assert.equal(body.get('auto_advance'),'false');invoice.status='open';value=invoice;}
   else if(path==='invoices/in_A/pay'){assert.equal(body.get('off_session'),'true');if(!paymentPending){invoice.status='paid';invoice.amount_paid=amount;invoice.amount_remaining=0;invoice.status_transitions={paid_at:clock/1000};}value=invoice;}
   else if(path==='invoices/in_A')value=invoice;
   else if(path==='subscriptions'){assert.equal(body.get('proration_behavior'),'none');assert.equal(Number(body.get('items[0][quantity]')),quantity);assert.equal(body.has('trial_end'),false);sub={id:'sub_A',customer:'cus_A',status:'active',metadata:meta,livemode:false,billing_cycle_anchor:Number(body.get('billing_cycle_anchor')),items:{data:[{price:{id:'price_A'},quantity,current_period_end:Number(body.get('billing_cycle_anchor'))}]}};value=sub;}
   else if(path==='subscriptions/sub_A'){if(init.method==='POST'){assert.equal(body.get('pause_collection[behavior]'),'keep_as_draft');assert.equal(body.get('cancel_at'),'');sub.pause_collection={behavior:'keep_as_draft'};sub.cancel_at=null;}value=sub;}
   else throw new Error(`unexpected fake path ${path}`);
   return new Response(JSON.stringify(value),{status:200});
 };
 const stripe=createFirstPublicationStripe(config,request,()=>clock);
 const store={async dispatchCheck(){return allowed;},async checkpoint(_job,step,id){if(!allowed)return{blocked:true};if(!checkpoints.has(step))checkpoints.set(step,{operation_key:`fixture-${step}`,started_at:new Date(clock).toISOString(),provider_id:null});if(id)checkpoints.get(step).provider_id=id;return{...checkpoints.get(step)};},async finish(_job,value){result=value;return value;}};
 const job={event_key:'event_A',lease_token:'lease_A',kind:'start_paid',trial_ends_at:new Date(end).toISOString(),amount_yen:amount,plan_key:plan,proof:a};
 return{stripe,store,job,calls,checkpoints,a,run:()=>processBillingJob(job,{stripe,store,now:()=>clock,priceIds:{[plan]:'price_A'}},new AbortController().signal),allow:v=>allowed=v,clock:v=>clock=v,open:()=>openSetup=true,mismatch:()=>amountMismatch=true,pending:()=>paymentPending=true,result:()=>result};
}
let n=0;async function test(name,fn){await fn();console.log(`PASS ${name}`);n++;}
await test('JST month end clamps, preserving time',()=>{assert.equal(new Date(nextPaidMonth(Date.parse('2027-01-31T00:00:00Z'))).toISOString(),'2027-02-28T00:00:00.000Z');});
await test('hosted setup has no subscription and returns HQ-specific route',async()=>{const f=fixture();f.open();f.a.provider_customer_id=null;f.a.checkout_session_id=null;const attaches=[];const value=await f.stripe.setup(f.a,async(...args)=>attaches.push(args),new AbortController().signal);assert.equal(value.setupUrl,'https://checkout.stripe.com/c/test_A');assert.equal(attaches.length,2);const call=f.calls.find(c=>c.url.endsWith('/checkout/sessions'));assert.equal(call.init.body.get('mode'),'setup');assert.equal(call.init.body.has('line_items[0][price]'),false);const ret=new URL(call.init.body.get('success_url'));assert.equal(ret.pathname,`/academy/h/${hq}/manage/settings`);assert.equal(ret.searchParams.get('attemptId'),attempt);assert.equal(ret.searchParams.get('quoteId'),quote);});
await test('setup unknown outcome past provider TTL blocks POST',async()=>{const f=fixture();f.a.provider_customer_id=null;f.clock(end+24*3600000);await assert.rejects(f.stripe.setup(f.a,async()=>{},new AbortController().signal),/RECONCILIATION_REQUIRED/);assert.equal(f.calls.length,0);});
await test('dispatch false never calls Stripe',async()=>{const f=fixture();f.allow(false);assert.deepEqual(await f.run(),{outcome:'blocked'});assert.equal(f.calls.length,0);});
await test('exact deadline never charges',async()=>{const f=fixture();f.clock(end);await assert.rejects(f.run(),/DEADLINE_NOT_PASSED/);assert.equal(f.calls.some(c=>c.init.method==='POST'),false);});
await test('trial sync only verifies setup and never creates subscription',async()=>{const f=fixture();f.job.kind='synchronize_trial';assert.equal((await f.run()).outcome,'trial_ready');assert.equal(f.calls.some(c=>c.init.method==='POST'),false);});
await test('first invoice paid once and subscription renewal starts one month after success',async()=>{const f=fixture();const value=await f.run();assert.equal(value.outcome,'paid');assert.equal(value.paid_at,'2026-09-15T00:00:01.000Z');assert.equal(value.period_end,'2026-10-15T00:00:01.000Z');const posts=f.calls.filter(c=>c.init.method==='POST').length;await f.run();assert.equal(f.calls.filter(c=>c.init.method==='POST').length,posts);});
await test('amount mismatch stops before finalize or pay',async()=>{const f=fixture();f.mismatch();await assert.rejects(f.run(),/AMOUNT_MISMATCH/);assert.equal(f.calls.some(c=>c.url.endsWith('/pay')||c.url.endsWith('/finalize')),false);});
await test('unpaid invoice never starts recurring subscription',async()=>{const f=fixture();f.pending();assert.equal((await f.run()).outcome,'attention');assert.equal(f.calls.some(c=>c.url.endsWith('/subscriptions')),false);});
await test('stale checkpoint prevents further external mutation',async()=>{const f=fixture();f.store.checkpoint=async()=>({blocked:true});await assert.rejects(f.run(),/FENCE_REJECTED/);assert.equal(f.calls.some(c=>c.init.method==='POST'),false);});
await test('cancel path is noncharging',async()=>{const f=fixture();f.job.kind='cancel_conversion';assert.equal((await f.run()).outcome,'cancelled');assert.equal(f.calls.length,0);});
const publicQuote={id:quote,headquartersId:hq,policyVersion:'fixture',termsRevision:'fixture',amountYen:3300,instructorCount:1,issuedAt:end,expiresAt:end+10000};
function httpDeps(){const f=fixture();let reserved=0;return{deps:{allowedOrigins:['https://app.mikke-os.com'],async authenticate(){return{id:owner,anonymous:false};},async owns(){return true;},async reserve(){reserved++;return f.a;},async setup(){return{attemptId:attempt,setupUrl:'https://checkout.stripe.com/c/test_A'};},async confirm(){return{paymentPreparationId:attempt,verified:true,quote:publicQuote};}},reserved:()=>reserved};}
function req(body,headers={}){return new Request('https://app.mikke-os.com/academy/api/first-publication/setup',{method:'POST',headers:{origin:'https://app.mikke-os.com',authorization:'Bearer fixture','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});}
await test('HTTP setup returns no-store scoped result',async()=>{const f=httpDeps();const res=await handleSetupRequest('setup',req({headquartersId:hq,quoteId:quote}),f.deps);assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);});
await test('HTTP confirm preserves original quote',async()=>{const f=httpDeps();const res=await handleSetupRequest('confirm',req({headquartersId:hq,quoteId:quote,attemptId:attempt}),f.deps);assert.deepEqual((await res.json()).quote,publicQuote);});
await test('cross-origin blocked before reserve',async()=>{const f=httpDeps();assert.equal((await handleSetupRequest('setup',req({headquartersId:hq,quoteId:quote},{origin:'https://evil.example'}),f.deps)).status,422);assert.equal(f.reserved(),0);});
await test('anonymous and nonowner blocked before reserve',async()=>{const f=httpDeps();f.deps.authenticate=async()=>({id:owner,anonymous:true});assert.equal((await handleSetupRequest('setup',req({headquartersId:hq,quoteId:quote}),f.deps)).status,401);f.deps.authenticate=async()=>({id:owner,anonymous:false});f.deps.owns=async()=>false;assert.equal((await handleSetupRequest('setup',req({headquartersId:hq,quoteId:quote}),f.deps)).status,404);assert.equal(f.reserved(),0);});
await test('actual UTF8 body limit enforced without Content-Length',async()=>{const f=httpDeps();assert.equal((await handleSetupRequest('setup',req(JSON.stringify({headquartersId:hq,quoteId:quote,pad:'あ'.repeat(1500)})),f.deps)).status,422);assert.equal(f.reserved(),0);});
await test('caller customer or owner fields not accepted',async()=>{const f=httpDeps();assert.equal((await handleSetupRequest('setup',req({headquartersId:hq,quoteId:quote,customerId:'cus_attacker'}),f.deps)).status,422);});
await test('201 and 250 instructors pay original formula then use licensed quantities',async()=>{for(const count of [201,250]){const f=fixture(count*100,'variable');const result=await f.run();assert.equal(result.amount_yen,count*100);assert.equal(result.plan_key,'variable');assert.equal(f.calls.find(c=>c.url.endsWith('/subscriptions')).init.body.get('items[0][quantity]'),String(count));}});
await test('malformed variable total cannot create or pay an invoice',async()=>{const f=fixture(20101,'variable');await assert.rejects(f.run(),/INVALID_VARIABLE_AMOUNT/);assert.equal(f.calls.some(c=>c.init.method==='POST'),false);});
console.log(`${n} runtime checks passed with fake HTTP/RPC only; no external mutations.`);
