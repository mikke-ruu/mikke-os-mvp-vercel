import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path,mocks={}) {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('module','exports','require',code)(module,module.exports,name=>mocks[name]??(name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name)));
  return module.exports;
}
const state={kind:'owner',subscriptionStatus:'active',allowedActions:['checkout','portal'],headquartersState:'ready',accessEndsAt:'2026-10-15T01:00:00Z',snapshot:null,nextInvoice:null,constructionPurchase:'unverified'};
const {AcademyPlatformBillingPanel:Panel}=load('app/academy/billing/AcademyPlatformBillingPanel.tsx');
let actions=0;
const props={state,onRequestQuote:()=>actions++,onOpenPortal:()=>actions++};
const legacy=renderToStaticMarkup(React.createElement(Panel,props));
assert.match(legacy,/自動課金されることはありません/);
for(const compact of [true,false]) {
  const html=renderToStaticMarkup(React.createElement(Panel,{...props,compact,managementOnly:true,quote:{unexpected:true}}));
  assert.match(html,/請求・支払方法・解約を管理する/);
  for(const text of ['自動課金','人数記録','料金・条件を確認して申し込む','次回の請求','決済画面へ進む'])assert.ok(!html.includes(text),text);
}
assert.equal(actions,0);

// Fake hook lifecycle and delayed transport: no browser, credentials or provider calls.
function harness() {
  let cursor=0,slots=[],pendingEffects=[],callbacks=new Set(),sessionToken='token-a',actor='owner',responseResolve,transportCalls=0,signal,assigned=[];
  const depsEqual=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const hooks={
    useState(initial){const i=cursor++;slots[i]??={value:initial};return[slots[i].value,value=>{slots[i].value=value;}];},
    useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
    useMemo(fn,deps){const i=cursor++;if(!slots[i]||!depsEqual(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
    useEffect(fn,deps){const i=cursor++;if(!slots[i]||!depsEqual(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps};pendingEffects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}},
    useSyncExternalStore(_subscribe,get){return get();},
  };
  const auth={getSession:async()=>({data:{session:{access_token:sessionToken,user:{id:actor}}},error:null}),onAuthStateChange(cb){callbacks.add(cb);return{data:{subscription:{unsubscribe(){callbacks.delete(cb);}}}};}};
  const storeFactory=()=>({subscribe(){return()=>{};},getSnapshot:()=>state,getServerSnapshot:()=>state,start(){},dispose(){},reload:async()=>{}});
  const adapter={openAcademyPlatformBillingPortal:async(_hq,_id,transport,requestSignal)=>{await transport.getAccessToken();transportCalls++;signal=requestSignal;return await new Promise(resolve=>{responseResolve=resolve;});}};
  const {AcademyPlatformBillingLoader:Loader}=load('app/academy/billing/AcademyPlatformBillingLoader.tsx',{
    react:hooks,'@/lib/academy/platform-billing-loader':{createAcademyBillingLoader:storeFactory},
    '@/lib/academy/platform-billing-adapter':adapter,'./AcademyPlatformBillingPanel':{AcademyPlatformBillingPanel:Panel},
  });
  globalThis.window={location:{assign:url=>assigned.push(url)}};
  const fetcher=async()=>{throw new Error('unexpected real transport');};
  function render(resourceId='hq-a') {cursor=0;const tree=Loader({userId:'owner',resourceId,isGuest:false,auth,fetch:fetcher,checkoutPlanKey:null,managementOnly:true});pendingEffects.splice(0).forEach(fn=>fn());return tree.props.children[0].props;}
  return {render,assigned,get calls(){return transportCalls;},get signal(){return signal;},resolve(){responseResolve({kind:'redirect',url:'https://billing.stripe.com/p/session/mock'});},switchToken(){sessionToken='token-b';},switchActor(){actor='other';},authChange(){callbacks.forEach(cb=>cb());},unmount(){slots.forEach(slot=>slot?.cleanup?.());}};
}
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
for(const change of ['none','hq','auth','token','actor','unmount']) {
  const h=harness(),panel=h.render();
  assert.equal(panel.managementOnly,true);
  assert.equal(panel.onRequestQuote,undefined);
  panel.onOpenPortal();panel.onOpenPortal();
  await flush();assert.equal(h.calls,1,'synchronous duplicate portal lock');
  if(change==='hq')h.render('hq-b');
  if(change==='auth')h.authChange();
  if(change==='token')h.switchToken();
  if(change==='actor')h.switchActor();
  if(change==='unmount')h.unmount();
  h.resolve();await flush();
  assert.equal(h.assigned.length,change==='none'?1:0,change);
  if(['hq','auth','unmount'].includes(change))assert.equal(h.signal.aborted,true,change);
  h.unmount();
}
delete globalThis.window;
console.log('academy_paid_management_ok: legacy preserved, management-only copy, delayed portal HQ/auth/token/unmount guards, duplicate lock; fake transport only');
