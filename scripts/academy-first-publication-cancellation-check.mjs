import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('lib/academy/first-publication/cancellation-client.ts','utf8');
const module={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {createFirstPublicationCancellationClient:create,createFirstPublicationCancellationAcknowledgmentClient:ackOnly,createFirstPublicationCancellationStatusClient:statusClient,parseFirstPublicationCancellationReceipt:parse}=module.exports;
const headquartersId='00000000-0000-4000-8000-000000000001',idempotencyKey='00000000-0000-4000-8000-000000000002',receiptId='00000000-0000-4000-8000-000000000003';
const input={headquartersId,idempotencyKey};
const receipt={status:'accepted',receipt_id:receiptId,headquarters_id:headquartersId,request_received_at:'2026-09-08T01:00:00.123456+00:00',durable_acknowledged_at:'2026-09-08T01:00:01Z',sequence:1,trial_ends_at:'2026-09-15T01:00:00Z',provider_secret:'must omit'};
const expected={status:'accepted',receiptId,headquartersId,requestReceivedAt:receipt.request_received_at,durableAcknowledgedAt:receipt.durable_acknowledged_at,sequence:1,trialEndsAt:receipt.trial_ends_at};
let n=0;async function test(name,fn){await fn();console.log(`PASS ${name}`);n++;}
await test('separate ordered transactions, same caller key, no actor or clock fields',async()=>{
 const order=[];let resolveAppend;const pending=new Promise(resolve=>{resolveAppend=resolve;});
 const run=create({rpc:async(name,args)=>{order.push(name);assert.deepEqual(args,{p_headquarters_id:headquartersId,p_idempotency_key:idempotencyKey});if(name.endsWith('_append'))return pending;return {data:receipt,error:null};}});
 let complete=false;const work=run(input,{assertCurrentActor(){order.push('actor');}}).then(value=>{complete=true;return value;});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(complete,false);assert.ok(!order.includes('academy_first_publication_cancel_acknowledge'));
 resolveAppend({data:{status:'awaiting_durable_acknowledgment'},error:null});assert.deepEqual(await work,expected);
 assert.deepEqual(order,['actor','academy_first_publication_cancel_append','actor','actor','academy_first_publication_cancel_acknowledge','actor']);
});
await test('append error or unexpected success never calls acknowledgment',async()=>{
 for(const response of [{data:null,error:{secret:'no output'}},{data:{status:'accepted'},error:null},{data:'awaiting_durable_acknowledgment',error:null}]){
  let calls=0;const run=create({rpc:async()=>{calls++;return response;}});await assert.rejects(run(input,{assertCurrentActor(){}}),/append_unconfirmed/);assert.equal(calls,1);
 }
});
await test('ack failure has no success, retry, or new idempotency key',async()=>{
 let calls=0;const run=create({rpc:async(name)=>{calls++;return name.endsWith('_append')?{data:{status:'awaiting_durable_acknowledgment'},error:null}:{data:null,error:{secret:'hidden'}};}});
 await assert.rejects(run(input,{assertCurrentActor(){}}),/acknowledgment_unconfirmed/);assert.equal(calls,2);
});
await test('invalid or cross-HQ receipt is rejected',async()=>{
 for(const patch of [{status:'awaiting_durable_acknowledgment'},{headquarters_id:receiptId},{receipt_id:'bad'},{sequence:0},{sequence:1.5},{sequence:'1'},{sequence:Number.MAX_SAFE_INTEGER+1},{request_received_at:'2026-02-30T01:00:00Z'},{durable_acknowledged_at:'2026-09-08T00:59:59Z'},{trial_ends_at:'2026-09-15'},{trial_ends_at:'2026-09-15T24:00:00Z'}])assert.throws(()=>parse({...receipt,...patch},headquartersId));
});
await test('validated receipt omits arbitrary secret properties',()=>assert.deepEqual(parse(receipt,headquartersId),expected));
await test('microsecond timestamp order is strict',()=>assert.throws(()=>parse({...receipt,durable_acknowledged_at:'2026-09-08T01:00:00.123455+00:00'},headquartersId)));
await test('DB acceptance is not overridden with a browser deadline',()=>assert.equal(parse({...receipt,trial_ends_at:'2026-09-08T00:59:00Z'},headquartersId).status,'accepted'));
await test('aborted or changed actor before append sends nothing',async()=>{
 let calls=0;const run=create({rpc:async()=>{calls++;throw Error('unexpected');}}),controller=new AbortController();controller.abort();
 await assert.rejects(run(input,{signal:controller.signal,assertCurrentActor(){}}));
 await assert.rejects(run(input,{assertCurrentActor(){throw Error('identity_changed');}}),/identity_changed/);assert.equal(calls,0);
});
await test('account switch after append stops before acknowledgment',async()=>{
 let actor=0,calls=0;const run=create({rpc:async()=>{calls++;return {data:{status:'awaiting_durable_acknowledgment'},error:null};}});
 await assert.rejects(run(input,{assertCurrentActor(){if(++actor===2)throw Error('identity_changed');}}),/identity_changed/);assert.equal(calls,1);
});
await test('abort after acknowledgment suppresses accepted response',async()=>{
 const controller=new AbortController();const run=create({rpc:async(name)=>{if(name.endsWith('_append'))return {data:{status:'awaiting_durable_acknowledgment'},error:null};controller.abort();return {data:receipt,error:null};}});
 await assert.rejects(run(input,{signal:controller.signal,assertCurrentActor(){}}));
});
await test('invalid input never sends an RPC',async()=>{
 let calls=0;const run=create({rpc:async()=>{calls++;throw Error('unexpected');}});
 for(const invalid of [{...input,headquartersId:''},{...input,idempotencyKey:''},{}])await assert.rejects(run(invalid,{assertCurrentActor(){}}),/invalid_first_publication_cancellation_input/);
 assert.equal(calls,0);
});
await test('ack-only recovery preserves known key and never appends',async()=>{
 const calls=[];const ack=ackOnly({rpc:async(name,args)=>{calls.push({name,args});return {data:receipt,error:null};}});
 assert.deepEqual(await ack(input,{assertCurrentActor(){}}),expected);
 assert.deepEqual(calls,[{name:'academy_first_publication_cancel_acknowledge',args:{p_headquarters_id:headquartersId,p_idempotency_key:idempotencyKey}}]);
});
await test('caller mutation cannot switch the key between transactions',async()=>{
 const mutable={...input};const keys=[];
 const run=create({rpc:async(name,args)=>{keys.push(args.p_idempotency_key);if(name.endsWith('_append')){mutable.idempotencyKey=receiptId;return {data:{status:'awaiting_durable_acknowledgment'},error:null};}return {data:receipt,error:null};}});
 await run(mutable,{assertCurrentActor(){}});assert.deepEqual(keys,[idempotencyKey,idempotencyKey]);
});
await test('successful null is the only unregistered status',async()=>{
 const read=statusClient({rpc:async(name,args)=>{assert.equal(name,'academy_first_publication_cancel_status');assert.deepEqual(args,{p_headquarters_id:headquartersId});return {data:null,error:null};}});
 assert.equal(await read(headquartersId,{assertCurrentActor(){}}),null);
 for(const reply of [{data:null,error:{secret:'hidden'}},{data:undefined,error:null}])await assert.rejects(statusClient({rpc:async()=>reply})(headquartersId,{assertCurrentActor(){}}));
});
await test('awaiting and accepted status preserve server key and applied state only',async()=>{
 const waiting=await statusClient({rpc:async()=>({data:{status:'awaiting_durable_acknowledgment',idempotency_key:idempotencyKey,secret:'hidden'},error:null})})(headquartersId,{assertCurrentActor(){}});
 assert.deepEqual(waiting,{status:'awaiting_durable_acknowledgment',idempotencyKey});
 for(const applied of [false,true])assert.deepEqual(await statusClient({rpc:async()=>({data:{...receipt,idempotency_key:idempotencyKey,applied},error:null})})(headquartersId,{assertCurrentActor(){}}),{...expected,idempotencyKey,applied});
});
await test('status rejects mixed HQ, invalid key and missing applied boolean',async()=>{
 for(const patch of [{headquarters_id:receiptId},{idempotency_key:'invalid'},{applied:undefined},{applied:'false'}])await assert.rejects(statusClient({rpc:async()=>({data:{...receipt,idempotency_key:idempotencyKey,applied:false,...patch},error:null})})(headquartersId,{assertCurrentActor(){}}));
});
await test('transport exceptions are opaque and recheck the actor',async()=>{
 let checks=0;const read=statusClient({rpc:async()=>{throw Error('private-provider-secret');}});
 await assert.rejects(read(headquartersId,{assertCurrentActor(){checks++;}}),error=>error.message==='first_publication_cancellation_status_unavailable');assert.equal(checks,2);
});
await test('status actor changes and aborts discard received receipts',async()=>{
 let checks=0;const read=statusClient({rpc:async()=>({data:{...receipt,idempotency_key:idempotencyKey,applied:false},error:null})});
 await assert.rejects(read(headquartersId,{assertCurrentActor(){if(++checks===2)throw Error('identity_changed');}}),/identity_changed/);
});
assert.ok(!source.includes('Date.now('));assert.ok(!source.includes('randomUUID'));assert.ok(!source.includes('setTimeout'));
console.log(`${n} cancellation client checks passed; fake RPC only, no DB or provider calls.`);
