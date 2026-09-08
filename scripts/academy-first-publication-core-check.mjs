import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.ACADEMY_TYPESCRIPT_PATH || 'typescript');
const module = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync('lib/academy/first-publication/service.ts','utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(module, module.exports);
const { createFirstPublicationService: create, TRIAL_MS } = module.exports;
const start = Date.parse('2026-09-08T12:00:00Z');
// Test-only business-policy assumptions. Not approval or production defaults.
const policy = { version:'test-v1', approvalId:'isolated-test-only', termsRevision:'test-terms', quoteTtlMs:900000,
  initialPrice:'fixed_at_publication', cancellation:'inclusive_deadline', eligibility:'no_previous_trial_or_contract' };
const prepareInput = { quoteId:'quote', paymentPreparationId:'proof', acceptedTermsRevision:'test-terms', acceptedAmountYen:3300, consent:true };
const publishInput = { courseId:'course', quoteId:'quote', confirmed:true };
function fixture() {
  const f = { at:start, fail:null, db:{ state:null, ownerClaim:null, outbox:[],
    courses:{ course:{headquartersId:'hq',published:false}, course2:{headquartersId:'hq',published:false} } },
    ctx:{ headquartersId:'hq',ownerUserId:'owner',actorUserId:'owner',authenticated:true,anonymous:false,canContract:true,
      legacyAccess:false,previousTrialUsed:false,priorPublications:false,currentAmountYen:3300,currentInstructorCount:2 },
    quote:{ id:'quote',headquartersId:'hq',ownerUserId:'owner',amountYen:3300,instructorCount:2,termsRevision:'test-terms',
      policyVersion:'test-v1',issuedAt:start,expiresAt:start+900000 },
    proof:{ id:'proof',headquartersId:'hq',ownerUserId:'owner',quoteId:'quote',verified:true,revoked:false } };
  let queue = Promise.resolve();
  const repo = { transaction(hq, actor, fn) {
    // Isolated in-memory serializable transaction with rollback, not a DB claim.
    const run = queue.then(async () => {
      const pending = structuredClone(f.db);
      const now = f.at;
      const tx = {
        now:()=>now, context:async()=>structuredClone(f.ctx), state:async()=>structuredClone(pending.state),
        quote:async id=>id===f.quote.id?structuredClone(f.quote):null,
        paymentPreparation:async id=>id===f.proof.id?structuredClone(f.proof):null,
        course:async id=>structuredClone(pending.courses[id] ?? null),
        save:async value=>{pending.state=structuredClone(value);},
        publishCourse:async(id,published)=>{if(f.fail==='course')throw Error('course_failure');pending.courses[id].published=published;},
        claimOwnerTrial:async id=>{ if(pending.ownerClaim && pending.ownerClaim!==id)throw Error('owner_already_used');pending.ownerClaim=id; },
        enqueue:async event=>{if(f.fail==='outbox')throw Error('outbox_failure');if(!pending.outbox.some(x=>x.key===event.key))pending.outbox.push(event);}
      };
      const result = await fn(tx);
      f.db=pending;
      return structuredClone(result);
    });
    queue=run.catch(()=>{});
    return run;
  } };
  return Object.assign(f, { repo, service:create(repo,policy) });
}
let cases=0;
async function test(name, run) { await run(); cases++; console.log(`ok ${cases} ${name}`); }
const prepare=f=>f.service.prepare('hq','owner',prepareInput);
const publish=(f,input=publishInput)=>f.service.publish('hq','owner',input);
await test('no policy means no mutation',async()=>{
  const f=fixture(); await assert.rejects(create(f.repo,null).prepare('hq','owner',prepareInput),/policy_not_approved/);assert.equal(f.db.state,null);
});
for (const [field,value] of [['anonymous',true],['authenticated',false],['canContract',false],['actorUserId','editor'],['ownerUserId','other'],['headquartersId','other']]) {
  await test(`deny ${field}`,async()=>{const f=fixture();f.ctx[field]=value;await assert.rejects(prepare(f),/forbidden/);assert.equal(f.db.state,null);});
}
for (const field of ['legacyAccess','previousTrialUsed','priorPublications']) {
  await test(`never auto-migrate ${field}`,async()=>{const f=fixture();f.ctx[field]=true;await assert.rejects(prepare(f),/not_eligible/);});
}
await test('explicit terms and price consent',async()=>{
  for(const patch of [{consent:false},{acceptedAmountYen:1},{acceptedTermsRevision:'old'}]) {
    const f=fixture();await assert.rejects(f.service.prepare('hq','owner',{...prepareInput,...patch}),/explicit_consent/);
  }
});
await test('preparation does not start clock or publish',async()=>{
  const f=fixture();const state=await prepare(f);assert.equal(state.firstPublishedAt,null);assert.equal(f.db.courses.course.published,false);assert.equal(f.db.ownerClaim,null);assert.equal(f.db.outbox.length,0);
});
await test('proof must match HQ owner quote and verified status',async()=>{
  for(const patch of [{verified:false},{revoked:true},{headquartersId:'other'},{ownerUserId:'other'},{quoteId:'other'}]){
    const f=fixture();Object.assign(f.proof,patch);await assert.rejects(prepare(f),/payment_preparation_unverified/);
  }
});
await test('expiry and count changes require new confirmation',async()=>{
  const f=fixture();await prepare(f);f.at=f.quote.expiresAt;await assert.rejects(publish(f),/quote_expired/);
  const g=fixture();await prepare(g);g.ctx.currentInstructorCount=3;await assert.rejects(publish(g),/requote_required/);
});
await test('first publication is atomic and starts exactly 168 hours',async()=>{
  const f=fixture();await prepare(f);f.at+=5000;const s=await publish(f);assert.equal(s.firstPublishedAt,start+5000);assert.equal(s.trialEndsAt,s.firstPublishedAt+TRIAL_MS);assert.equal(f.db.courses.course.published,true);assert.equal(f.db.outbox.length,1);
});
for (const failure of ['course','outbox']) {
  await test(`${failure} failure rolls back clock course ledger and outbox`,async()=>{
    const f=fixture();await prepare(f);const before=structuredClone(f.db);f.fail=failure;await assert.rejects(publish(f),new RegExp(`${failure}_failure`));assert.deepEqual(f.db,before);
  });
}
await test('concurrent different courses share one origin and one outbox event',async()=>{
  const f=fixture();await prepare(f);const [a,b]=await Promise.all([publish(f),publish(f,{...publishInput,courseId:'course2'})]);
  assert.equal(a.firstPublishedAt,b.firstPublishedAt);assert.equal(f.db.outbox.length,1);assert.equal(f.db.courses.course2.published,true);
});
await test('unpublish and republish never reset or cancel',async()=>{
  const f=fixture();await prepare(f);const s=await publish(f);f.at+=1200000;
  await f.service.unpublish('hq','owner','course');assert.equal(f.db.state.cancellationAcceptedAt,null);
  assert.deepEqual(await publish(f),s);assert.equal(f.db.outbox.length,1);
});
await test('foreign course is rejected',async()=>{
  const f=fixture();await prepare(f);f.db.courses.course.headquartersId='other';await assert.rejects(publish(f),/course_not_found/);
});
await test('revoked payment preparation rechecked at publication',async()=>{
  const f=fixture();await prepare(f);f.proof.revoked=true;await assert.rejects(publish(f),/payment_preparation_unverified/);
});
await test('owner-wide ledger conflict rolls back',async()=>{
  const f=fixture();await prepare(f);f.db.ownerClaim='other-hq';await assert.rejects(publish(f),/owner_already_used/);assert.equal(f.db.state.firstPublishedAt,null);
});
await test('cancel at exact deadline wins and remains callable with rollout disabled',async()=>{
  const f=fixture();await prepare(f);const s=await publish(f);f.at=s.trialEndsAt;
  const stopped=create(f.repo,null);const cancelled=await stopped.cancelConversion('hq','owner');assert.equal(cancelled.cancellationAcceptedAt,s.trialEndsAt);
  assert.deepEqual(await stopped.cancelConversion('hq','owner'),cancelled);assert.equal(f.db.outbox.filter(x=>x.kind==='cancel_conversion').length,1);
  await assert.rejects(publish(f),/publication_blocked/);await stopped.unpublish('hq','owner','course');assert.equal(f.db.courses.course.published,false);
});
await test('after deadline uses paid cancellation, not retroactive free cancellation',async()=>{
  const f=fixture();await prepare(f);const s=await publish(f);f.at=s.trialEndsAt+1;await assert.rejects(f.service.cancelConversion('hq','owner'),/paid_cancellation_required/);
});
await test('pre-publication cancellation starts no clock',async()=>{
  const f=fixture();await prepare(f);await f.service.cancelConversion('hq','owner');assert.equal(f.db.state.firstPublishedAt,null);assert.equal(f.db.ownerClaim,null);await assert.rejects(publish(f),/publication_blocked/);
});
const rpcModule={exports:{}};
new Function('module','exports',ts.transpileModule(readFileSync('lib/academy/first-publication/rpc-client.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText)(rpcModule,rpcModule.exports);
const {createFirstPublicationRpc:rpc}=rpcModule.exports;
const hqId='00000000-0000-4000-8000-000000000001';
const quoteId='00000000-0000-4000-8000-000000000002';
const courseId='00000000-0000-4000-8000-000000000003';
const rpcState={headquarters_id:hqId,policy_version:'test-v1',terms_revision:'terms',quote_id:quoteId,amount_yen:3300,
  instructor_count:2,first_published_at:null,trial_ends_at:null,cancellation_accepted_at:null,phase:'prepared',payment_preparation_id:'private-proof'};
await test('RPC sends one atomic command and no browser actor or clock',async()=>{
  let calls=0;
  const run=rpc({rpc:async(name,args)=>{calls++;assert.equal(name,'academy_first_publication_command');
    assert.deepEqual(args,{p_headquarters_id:hqId,p_action:'prepare',p_course_id:null,p_quote_id:quoteId,p_confirmed:true,p_terms_revision:'terms',p_amount_yen:3300});return {data:rpcState,error:null};}});
  const result=await run(hqId,{action:'prepare',quoteId,termsRevision:'terms',amountYen:3300,consent:true,actor:'attacker',now:0});
  assert.equal(calls,1);assert.equal(result.payment_preparation_id,undefined);
});
await test('RPC input validation does not send invalid consent or path',async()=>{
  let calls=0;const run=rpc({rpc:async()=>{calls++;return {data:rpcState,error:null};}});
  await assert.rejects(run('bad',{action:'status'}),/invalid_headquarters/);
  await assert.rejects(run(hqId,{action:'publish',courseId,quoteId,confirmed:false}),/confirmation_required/);
  await assert.rejects(run(hqId,{action:'prepare',quoteId,termsRevision:'terms',amountYen:3300,consent:false}),/consent_required/);assert.equal(calls,0);
});
await test('RPC failure is not unregistered and never retried',async()=>{
  let calls=0;const run=rpc({rpc:async()=>{calls++;return {data:null,error:{message:'internal secret'}};}});
  await assert.rejects(run(hqId,{action:'status'}),error=>error.message==='first_publication_request_failed');assert.equal(calls,1);
});
await test('only a successful status request may return null',async()=>{
  const run=rpc({rpc:async()=>({data:null,error:null})});assert.equal(await run(hqId,{action:'status'}),null);
  await assert.rejects(run(hqId,{action:'publish',courseId,quoteId,confirmed:true}),/invalid_first_publication_response/);
});
await test('RPC rejects wrong HQ and inconsistent trial window',async()=>{
  for(const patch of [{headquarters_id:courseId},{amount_yen:'3300'},{phase:'active'},
    {first_published_at:new Date(start).toISOString(),trial_ends_at:new Date(start+1).toISOString(),phase:'trialing'},
    {phase:'cancelled',cancellation_accepted_at:null}]) {
    const run=rpc({rpc:async()=>({data:{...rpcState,...patch},error:null})});await assert.rejects(run(hqId,{action:'status'}),/invalid_first_publication/);
  }
});
console.log(`academy_first_publication_core_ok: ${cases} isolated contract cases; no DB, provider, invoice, or invitation calls`);
