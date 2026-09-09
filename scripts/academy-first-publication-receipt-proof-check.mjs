import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {prepareReceiptProof}=await import('../lib/academy/first-publication-billing/receipt-proof.ts');
const hq='f9090000-0000-4000-8000-000000000101',id='f9090000-0000-4000-8000-000000000201';
const job={kind:'start_paid',trial_ends_at:'2026-09-09T00:00:00Z',proof:{headquarters_id:hq}};
const valid={verified:true,through_at:job.trial_ends_at,receipt_count:0,cancellation_exists:false};
let count=0;
async function check(name,run){await run();count++;console.log(`PASS ${name}`);}
function fixture(proof=valid){const calls=[];return{calls,rpc:async(name,args)=>{calls.push({name,args});return name.endsWith('_barrier')?{status:'awaiting_commit',barrier_id:id}:proof;}};}
await check('noncharging jobs need no barrier',async()=>{for(const kind of ['synchronize_trial','cancel_conversion'])assert.equal(await prepareReceiptProof({...job,kind},()=>assert.fail('unexpected RPC')),true);});
await check('barrier commits before separate proof call',async()=>{const f=fixture();assert.equal(await prepareReceiptProof(job,f.rpc),true);assert.deepEqual(f.calls,[{name:'academy_first_publication_receipt_barrier',args:{p_headquarters_id:hq}},{name:'academy_first_publication_receipt_prove',args:{p_barrier_id:id}}]);});
await check('pending transactions block without retry',async()=>{const f=fixture({verified:false,reason:'pre_barrier_transactions_pending'});assert.equal(await prepareReceiptProof(job,f.rpc),false);assert.equal(f.calls.length,2);});
await check('committed cancellation blocks',async()=>{assert.equal(await prepareReceiptProof(job,fixture({...valid,receipt_count:1,cancellation_exists:true}).rpc),false);});
await check('wrong deadline and malformed evidence rejected',async()=>{for(const proof of [null,{}, {...valid,through_at:'2026-09-10T00:00:00Z'},{...valid,receipt_count:-1},{...valid,receipt_count:'0'},{...valid,cancellation_exists:null}])await assert.rejects(prepareReceiptProof(job,fixture(proof).rpc),/INVALID_RECEIPT_PROOF/);});
await check('malformed barrier prevents proof call',async()=>{let n=0;await assert.rejects(prepareReceiptProof(job,async()=>{n++;return{status:'awaiting_commit',barrier_id:'bad'};}),/INVALID_RECEIPT_BARRIER/);assert.equal(n,1);});
await check('RPC failure never manufactures proof',async()=>{await assert.rejects(prepareReceiptProof(job,async()=>{throw Error('offline');}),/offline/);});
console.log(`${count} fake RPC checks passed. No dispatch activation or external mutations.`);
