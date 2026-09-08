import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path) {
  const module = {exports:{}};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('module','exports','require',code)(module,module.exports,name=>name==='@/lib/academy/first-publication-view'?load('lib/academy/first-publication-view.ts'):require(name));
  return module.exports;
}
const {describeFirstPublication,firstPublicationDate}=load('lib/academy/first-publication-view.ts');
const hq='00000000-0000-4000-8000-000000000001';
const quote='00000000-0000-4000-8000-000000000002';
const base={headquartersId:hq,policyVersion:'v1',termsRevision:'v1',quoteId:quote,amountYen:5000,instructorCount:1,firstPublishedAt:null,trialEndsAt:null,cancellationAcceptedAt:null,phase:'prepared'};
assert.equal(describeFirstPublication(base,Date.now()).title,'公開準備中');
const published={...base,firstPublishedAt:'2026-09-08T01:00:00Z',trialEndsAt:'2026-09-15T01:00:00Z',phase:'trialing'};
const end=Date.parse(published.trialEndsAt);
assert.equal(describeFirstPublication(published,end-1).title,'7日間無料体験中');
assert.notEqual(describeFirstPublication(published,end).title,'7日間無料体験中');
const paidAccess={scheme:'first_publication_168h_v1',policyVersion:'v1',active:true,inviteAllowed:true,endsAt:'2026-10-15T01:00:00Z',phase:'paid',cancellationAcceptedAt:null};
assert.equal(describeFirstPublication(published,end+1,paidAccess).title,'有料利用中');
const cancelled={...published,phase:'cancelled',cancellationAcceptedAt:'2026-09-10T01:00:00Z'};
assert.match(describeFirstPublication(cancelled,end-1).description,/元の無料終了日時まで/);
assert.match(describeFirstPublication(cancelled,end).title,/無料体験終了/);
assert.match(firstPublicationDate(published.trialEndsAt),/10:00:00/);
const {AcademyFirstPublicationPanel}=load('components/academy/AcademyFirstPublicationPanel.tsx');
let mutations=0;
const markup=renderToStaticMarkup(React.createElement(AcademyFirstPublicationPanel,{identityKey:'owner',state:base,course:{id:'course',name:'<確認>',is_published:false},allowedActions:['publish'],onAction:async()=>{mutations++},onRefresh:async()=>{}}));
assert.match(markup,/disabled=""/);
assert.match(markup,/5,000/);
assert.doesNotMatch(markup,/自動課金されません/);
assert.equal(mutations,0);
const {approvedAcademySetupUrl,createAcademySetupClient}=load('lib/academy/first-publication-setup-client.ts');
assert.equal(approvedAcademySetupUrl('https://checkout.stripe.com/c/pay/test'), 'https://checkout.stripe.com/c/pay/test');
for(const bad of ['http://checkout.stripe.com/a','https://checkout.stripe.com.evil.test/a','https://evil.test','https://u@checkout.stripe.com/a','javascript:alert(1)'])assert.throws(()=>approvedAcademySetupUrl(bad));
let requests=[];
const client=createAcademySetupClient(async()=>'token',async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify({attemptId:quote,setupUrl:'https://checkout.stripe.com/c/pay/test'}));});
await client.start(hq,quote);
assert.equal(requests[0].init.cache,'no-store');
assert.equal(requests[0].init.redirect,'error');
assert.deepEqual(JSON.parse(requests[0].init.body),{headquartersId:hq,quoteId:quote});
await assert.rejects(()=>client.confirm(hq,quote,quote));
const bad=createAcademySetupClient(async()=>'token',async()=>new Response('{}',{status:503}));
await assert.rejects(()=>bad.start(hq,quote));
const originalQuote={id:quote,headquartersId:hq,policyVersion:'v1',termsRevision:'v1',amountYen:5000,instructorCount:1,issuedAt:'2026-09-08T01:00:00Z',expiresAt:'2026-09-08T01:30:00Z',planKey:'small',planName:'登録講師20名まで',discountDescription:'割引なし',consentRevision:'academy-first-publication-trial-consent-2026-09-08-v1'};
const confirmed=createAcademySetupClient(async()=>'token',async()=>new Response(JSON.stringify({paymentPreparationId:quote,verified:true,quote:originalQuote})));
assert.deepEqual((await confirmed.confirm(hq,quote,quote)).quote,originalQuote);
for(const altered of [{...originalQuote,headquartersId:quote},{...originalQuote,amountYen:-1},{...originalQuote,expiresAt:'2026-09-08T00:30:00Z'}]){
 const mismatch=createAcademySetupClient(async()=>'token',async()=>new Response(JSON.stringify({paymentPreparationId:quote,verified:true,quote:altered})));
 await assert.rejects(()=>mismatch.confirm(hq,quote,quote));
}
for(const key of ['planKey','planName','discountDescription','consentRevision']){
 const altered={...originalQuote};delete altered[key];
 const mismatch=createAcademySetupClient(async()=>'token',async()=>new Response(JSON.stringify({paymentPreparationId:quote,verified:true,quote:altered})));
 await assert.rejects(()=>mismatch.confirm(hq,quote,quote));
}
const wrongConsent=createAcademySetupClient(async()=>'token',async()=>new Response(JSON.stringify({paymentPreparationId:quote,verified:true,quote:{...originalQuote,consentRevision:'old'}})));
await assert.rejects(()=>wrongConsent.confirm(hq,quote,quote));
console.log('academy_first_publication_ui_ok: expiry, cancellation, no render mutations, confirmation, hosted URL, unverified setup refusal');
