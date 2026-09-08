import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const path='components/academy/first-publication-cancellation-state.ts';
const module={exports:{}};
const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('module','exports',js)(module,module.exports);
const {createFirstPublicationCancellationState:create}=module.exports;
const receipt={status:'accepted',receiptId:'receipt',headquartersId:'hq',requestReceivedAt:'2026-09-09T00:00:00Z',durableAcknowledgedAt:'2026-09-09T00:00:01Z',sequence:1,trialEndsAt:'2026-09-15T00:00:00Z'};
function setup(overrides={}) {
  const calls=[];let valid=true;
  const deps={initialKey:null,check:async()=>{if(!valid)throw Error('scope');},read:async()=>null,cancel:async key=>{calls.push(['cancel',key]);return receipt;},acknowledge:async key=>{calls.push(['ack',key]);return receipt;},apply:async()=>{calls.push(['apply']);return {phase:'cancelled',headquartersId:'hq',cancellationAcceptedAt:receipt.requestReceivedAt};},newKey:()=>{calls.push(['key']);return'key-1';},remember:key=>calls.push(['remember',key]),...overrides};
  const model=create(deps);
  return {model,calls,invalidate:()=>{valid=false;},deps};
}
{
  const h=setup();await assert.rejects(h.model.start);assert.equal(h.calls.length,0);
  await h.model.refresh();await h.model.start();assert.equal(h.model.getSnapshot().receipt.applied,true);
  await assert.rejects(h.model.start);assert.equal(h.calls.filter(x=>x[0]==='cancel').length,1);
}
{
  const h=setup({apply:async()=>{throw Error('business offline');}});await h.model.refresh();await h.model.start();
  assert.equal(h.model.getSnapshot().receipt.status,'accepted');assert.equal(h.model.getSnapshot().receipt.applied,false);
  assert.match(h.model.getSnapshot().error,/受付済み/);await assert.rejects(h.model.start);
  await h.model.refresh();assert.equal(h.model.getSnapshot().receipt.status,'accepted','null read cannot retract receipt');
}
{
  const h=setup({cancel:async()=>{throw Error('lost append response');},read:async()=>null});await h.model.refresh();await assert.rejects(h.model.start);
  assert.equal(h.model.getSnapshot().pendingKey,'key-1');await h.model.resume();
  assert.ok(!h.calls.some(x=>x[0]==='ack'));assert.equal(h.model.getSnapshot().serverAbsent,true);
  h.deps.cancel=async key=>{h.calls.push(['cancel',key]);return receipt;};
  await h.model.resendSame();
  assert.ok(h.calls.some(x=>x[0]==='cancel'&&x[1]==='key-1'));assert.equal(h.calls.filter(x=>x[0]==='key').length,1);
}
for(const result of [null,{phase:'trialing',headquartersId:'hq',cancellationAcceptedAt:null},{phase:'cancelled',headquartersId:'other',cancellationAcceptedAt:receipt.requestReceivedAt}]) {
  const h=setup({apply:async()=>result});await h.model.refresh();await h.model.start();
  assert.equal(h.model.getSnapshot().receipt.status,'accepted');assert.equal(h.model.getSnapshot().receipt.applied,false);
}
{
  const h=setup({initialKey:'restored-key',read:async()=>({status:'awaiting_durable_acknowledgment',idempotencyKey:'server-key'})});
  await h.model.resume();assert.ok(h.calls.some(x=>x[0]==='ack'&&x[1]==='server-key'));assert.ok(!h.calls.some(x=>x[0]==='cancel'||x[0]==='key'));
}
{
  const h=setup({read:async()=>{throw Error('read unavailable');},initialKey:'old-key'});await assert.rejects(h.model.resume);
  assert.equal(h.model.getSnapshot().checked,false);assert.equal(h.model.getSnapshot().pendingKey,'old-key');assert.equal(h.calls.length,0);
}
{
  const h=setup({read:async()=>({...receipt,idempotencyKey:'known',applied:false})});await h.model.resume();
  assert.equal(h.model.getSnapshot().receipt.applied,true);assert.ok(!h.calls.some(x=>x[0]==='ack'||x[0]==='cancel'||x[0]==='key'));
}
{
  let resolve;const h=setup({cancel:()=>new Promise(r=>{resolve=r;})});await h.model.refresh();
  const running=h.model.start();await new Promise(r=>setImmediate(r));await assert.rejects(h.model.start);
  h.invalidate();resolve(receipt);await assert.rejects(running);assert.equal(h.model.getSnapshot().receipt,null);assert.ok(!h.calls.some(x=>x[0]==='apply'));
}
{
  let resolve;const h=setup({read:()=>new Promise(r=>{resolve=r;})});const running=h.model.refresh();await new Promise(r=>setImmediate(r));
  h.model.dispose();h.model.activate();resolve({...receipt,idempotencyKey:'old',applied:true});await assert.rejects(running);
  assert.equal(h.model.getSnapshot().receipt,null,'strict effect old response stays invalid');
}
{
  const h=setup({remember:()=>{throw Error('storage unavailable');}});await h.model.refresh();await assert.rejects(h.model.start);
  assert.ok(!h.calls.some(x=>x[0]==='cancel'),'persist key before dispatch');
}
for(const filename of ['AcademySettingsBilling.tsx','AcademyCoursePublication.tsx']) {
  const source=readFileSync(`components/academy/${filename}`,'utf8');assert.match(source,/cancellation\.start\(\)/);assert.match(source,/cancellationNotice/);
  assert.doesNotMatch(source,/createFirstPublicationRpc\(supabase\)\(headquartersId,\s*\{\s*action:\s*"cancel_conversion"\s*\}\)/);
}
const hook=readFileSync('components/academy/useAcademyCancellation.tsx','utf8');
assert.doesNotMatch(hook,/removeItem/);
assert.match(hook,/同じ手続きで取消を再送/);
console.log('academy_cancellation_ui_ok: scoped saved key, explicit same-key resend, read errors fail closed, durable receipt survives invalid business result, duplicate/actor/dispose guards; fake only');
