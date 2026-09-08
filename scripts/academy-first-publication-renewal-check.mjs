import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {createFirstPublicationStripe}=await import('../lib/academy/first-publication-billing/stripe-runtime.ts');
const {processRenewalJob}=await import('../lib/academy/first-publication-billing/renewal.ts');
const begin=Date.parse('2026-10-15T00:00:01Z'),end=Date.parse('2026-11-15T00:00:01Z');
function fixture(){
 let allowed=true,noQuote=false,skipLine=false,clock=begin+1000;
 const job={event_key:'renew_A',lease_token:'lease_A',kind:'renew_pay',provider_subscription_id:'sub_A',provider_customer_id:'cus_A',headquarters_id:'hq_A',period_start:new Date(begin).toISOString(),period_end:new Date(end).toISOString()};
 const quote={price_id:'proof-price-uuid',snapshot_id:'snapshot-uuid',amount_yen:10000,plan_key:'medium',period_start:job.period_start,period_end:job.period_end};
 const sub={id:'sub_A',customer:'cus_A',livemode:false,metadata:{headquarters_id:'hq_A',scheme:'academy_first_publication_168h_v1'},pause_collection:{behavior:'keep_as_draft'},cancel_at:null,cancel_at_period_end:false,status:'active',default_payment_method:'pm_A',items:{data:[{id:'si_A',price:{id:'price_Old',currency:'jpy',unit_amount:5000},quantity:1}]}};
 const invoice={id:'in_A',customer:'cus_A',subscription:'sub_A',livemode:false,billing_reason:'subscription_cycle',status:'draft',currency:'jpy',auto_advance:false,total:5000,amount_due:5000,starting_balance:0,lines:{has_more:false,data:[{id:'il_A',price:{id:'price_Old'},quantity:1,amount:5000,period:{start:begin/1000,end:end/1000}}]}};
 const calls=[],checkpoints=new Map();
 const request=async(url,init)=>{calls.push({url,init});const path=new URL(url).pathname.replace('/v1/','');let value;
   if(path==='prices/price_New')value={id:'price_New',active:true,livemode:false,currency:'jpy',unit_amount:10000,recurring:{interval:'month',interval_count:1}};
   else if(path==='subscriptions/sub_A'){if(init.method==='POST'){assert.equal(init.body.get('proration_behavior'),'none');assert.equal(init.body.get('pause_collection[behavior]'),'keep_as_draft');sub.items.data[0].price={id:'price_New',currency:'jpy',unit_amount:10000};}value=sub;}
   else if(path==='invoices')value={data:[invoice],has_more:false};
   else if(path==='invoices/in_A')value=invoice;
   else if(path==='invoices/in_A/lines/il_A'){assert.equal(init.body.get('price'),'price_New');if(!skipLine){invoice.lines.data[0].price={id:'price_New'};invoice.lines.data[0].amount=invoice.total=invoice.amount_due=10000;}value=invoice.lines.data[0];}
   else if(path==='invoices/in_A/finalize'){assert.equal(init.body.get('auto_advance'),'false');invoice.status='open';value=invoice;}
   else if(path==='invoices/in_A/pay'){assert.equal(init.body.get('off_session'),'true');invoice.status='paid';invoice.amount_paid=10000;invoice.amount_remaining=0;invoice.status_transitions={paid_at:clock/1000};value=invoice;}
   else throw new Error(path);return new Response(JSON.stringify(value),{status:200});
 };
 const stripe=createFirstPublicationStripe({secretKey:'sk_test_fixture',mode:'test',apiVersion:'2025-02-24.acacia',approvalId:'fixture',successUrl:'https://app.mikke-os.com/academy/settings',cancelUrl:'https://app.mikke-os.com/academy/settings'},request,()=>clock);
 const store={async quote(){if(noQuote)throw new Error('SNAPSHOT_NOT_READY');return quote;},async check(){return allowed;},async checkpoint(_j,step,id){if(!checkpoints.has(step))checkpoints.set(step,{operation_key:`renew-${step}`,started_at:new Date(clock).toISOString(),provider_id:null});if(id)checkpoints.get(step).provider_id=id;return{...checkpoints.get(step)};},async finish(_j,result){return result;}};
 return{job,sub,invoice,calls,store,quote,run:()=>processRenewalJob(job,{stripe,store,priceIds:{medium:'price_New'},now:()=>clock},new AbortController().signal),noQuote:()=>noQuote=true,disallow:()=>allowed=false,skipLine:()=>skipLine=true,clock:v=>clock=v};
}
let n=0;async function test(name,fn){await fn();console.log(`PASS ${name}`);n++;}
await test('price update keeps collection paused and does not pay',async()=>{const f=fixture();f.job.kind='renew_price';assert.equal((await f.run()).outcome,'price_ready');assert.equal(f.sub.items.data[0].price.id,'price_New');assert.equal(f.invoice.total,5000);assert.equal(f.calls.some(c=>c.url.endsWith('/pay')),false);});
await test('existing draft repriced explicitly before finalization and pay',async()=>{const f=fixture();const r=await f.run();assert.equal(r.outcome,'paid');assert.equal(f.invoice.total,10000);assert.equal(f.calls.filter(c=>c.url.endsWith('/lines/il_A')).length,1);assert.equal(r.amount_yen,10000);assert.equal(r.period_end,f.job.period_end);});
await test('duplicate worker does not perform a second payment',async()=>{const f=fixture();await f.run();const count=f.calls.filter(c=>c.init.method==='POST').length;await f.run();assert.equal(f.calls.filter(c=>c.init.method==='POST').length,count);});
await test('missing month-end snapshot stops before provider calls',async()=>{const f=fixture();f.noQuote();await assert.rejects(f.run(),/SNAPSHOT_NOT_READY/);assert.equal(f.calls.length,0);});
await test('unconfirmed draft line update never pays',async()=>{const f=fixture();f.skipLine();await assert.rejects(f.run(),/TOTAL_MISMATCH/);assert.equal(f.calls.some(c=>c.url.endsWith('/pay')||c.url.endsWith('/finalize')),false);});
await test('finalized mismatched invoice is not rewritten or paid',async()=>{const f=fixture();f.invoice.status='open';await assert.rejects(f.run(),/TOTAL_MISMATCH/);assert.equal(f.calls.some(c=>c.url.endsWith('/lines/il_A')||c.url.endsWith('/pay')),false);});
await test('customer and mode bindings reject mismatches',async()=>{const f=fixture();f.sub.customer='cus_other';await assert.rejects(f.run(),/SCOPE_MISMATCH/);f.sub.customer='cus_A';f.sub.livemode=true;await assert.rejects(f.run(),/SCOPE_MISMATCH/);});
await test('unpaused subscription is an operational error, never silently resumed',async()=>{const f=fixture();f.sub.pause_collection=null;await assert.rejects(f.run(),/NOT_HELD/);assert.equal(f.calls.some(c=>c.init.method==='POST'),false);});
await test('lease refusal blocks all provider calls',async()=>{const f=fixture();f.disallow();await assert.rejects(f.run(),/FENCE_REJECTED/);assert.equal(f.calls.length,0);});
console.log(`${n} renewal checks passed with fake provider/RPC; no external calls.`);
