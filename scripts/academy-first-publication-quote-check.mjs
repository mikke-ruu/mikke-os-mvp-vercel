import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {quoteFromDatabase,verifyConfirmedQuote}=await import('../lib/academy/first-publication-billing/quote.ts');
const attempt={quote_id:'a1000000-0000-4000-8000-000000000001',headquarters_id:'a1000000-0000-4000-8000-000000000002',owner_user_id:'a1000000-0000-4000-8000-000000000003',policy_version:'approved-fixture-v1',amount_yen:5000};
const row={id:attempt.quote_id,headquarters_id:attempt.headquarters_id,owner_user_id:attempt.owner_user_id,policy_version:attempt.policy_version,terms_revision:'terms-fixture',amount_yen:5000,instructor_count:20,issued_at:'2026-09-08T01:00:00+00:00',expires_at:'2026-09-08T01:10:00+00:00',plan_key:'small',plan_name:'サーバー登録名',discount_description:'サーバーで確定した割引条件',consent_revision:'consent-fixture-v2'};
let checks=0;
function test(name,run){run();checks++;process.stdout.write(`PASS ${name}\n`);}
const original=quoteFromDatabase(row,attempt);
test('original server catalog fields are forwarded without normalization',()=>{assert.equal(original.planName,row.plan_name);assert.equal(original.discountDescription,row.discount_description);assert.equal(original.consentRevision,row.consent_revision);assert.equal(original.issuedAt,row.issued_at);assert.deepEqual(verifyConfirmedQuote(original,{...original},attempt),original);});
for(const [snake,camel] of [['plan_key','planKey'],['plan_name','planName'],['discount_description','discountDescription'],['consent_revision','consentRevision']]){
 test(`${snake} missing or empty is rejected`,()=>{for(const value of [undefined,null,'',' '])assert.throws(()=>quoteFromDatabase({...row,[snake]:value},attempt));});
 test(`${camel} changed at confirmation is rejected`,()=>assert.throws(()=>verifyConfirmedQuote(original,{...original,[camel]:'different'},attempt),/QUOTE_EVIDENCE_CHANGED/));
}
test('owner and quote scope are bound to the server attempt',()=>{assert.throws(()=>quoteFromDatabase({...row,owner_user_id:'other'},attempt));assert.throws(()=>quoteFromDatabase({...row,id:'other'},attempt));assert.throws(()=>quoteFromDatabase({...row,amount_yen:10000},attempt));});
test('other original evidence cannot be replaced on completion',()=>{for(const [key,value] of [['instructorCount',19],['termsRevision','new'],['issuedAt','2026-09-08T01:00:01+00:00'],['expiresAt','2026-09-08T01:11:00+00:00']])assert.throws(()=>verifyConfirmedQuote(original,{...original,[key]:value},attempt),/QUOTE_EVIDENCE_CHANGED/);});
test('missing quote and malformed timestamps never receive defaults',()=>{assert.throws(()=>quoteFromDatabase(undefined,attempt));assert.throws(()=>quoteFromDatabase({...row,issued_at:123},attempt));assert.throws(()=>quoteFromDatabase({...row,expires_at:row.issued_at},attempt));});
process.stdout.write(`${checks} quote evidence checks passed; fake data only.\n`);
