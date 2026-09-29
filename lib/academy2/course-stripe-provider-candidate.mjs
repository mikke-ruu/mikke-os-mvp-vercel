// Unwired tuition candidate. No seller, fee or charge model is assumed.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { checkoutUuid } from './opening-checkout-policy.mjs';
const check=(v,c)=>{if(!v)throw new Error(c);};
const object=v=>{check(v&&typeof v==='object'&&!Array.isArray(v),'STRIPE_INVALID_RESPONSE');return v;};
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}_[A-Za-z0-9]+$`).test(v);
const events=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','payment_intent.payment_failed','charge.refunded','refund.created','refund.updated','refund.failed','charge.dispute.created','charge.dispute.closed']);
const reference=v=>typeof v==='string'?v:v?.id;
const meta=o=>({academy2_course_checkout_id:o.checkoutId,academy2_course_order_id:o.orderId,academy2_course_headquarters_id:o.headquartersId,academy2_course_actor_id:o.actorId,academy2_course_seller_id:o.sellerUserId,academy2_course_binding_id:o.sellerBindingId,academy2_course_consent_id:o.consentSnapshotId,academy2_course_fee_policy_id:o.feePolicyId});
const metadata=(v,o)=>check(v&&Object.entries(meta(o)).every(([k,x])=>v[k]===x),'STRIPE_SCOPE_MISMATCH');
export function courseStripeAttemptMayCreate(createdAt,now=Date.now()){const age=now-Date.parse(createdAt);return Number.isFinite(age)&&age>=0&&age<=23*3600000;}
export function courseStripeConfigValid(c){
 check(c&&['test','live'].includes(c.mode)&&new RegExp(`^sk_${c.mode}_[A-Za-z0-9]+$`).test(c.secretKey||'')&&/^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/.test(c.apiVersion||''),'STRIPE_NOT_CONFIGURED');
 const u=new URL(c.origin);check(u.origin===c.origin&&!u.username&&!u.password,'STRIPE_ORIGIN_INVALID');
 check(c.mode==='live'?u.protocol==='https:'&&['app.mikke-os.com','mikke-os.com'].includes(u.hostname)&&!u.port:['http://127.0.0.1:57670','http://127.0.0.1:57770'].includes(c.origin),'STRIPE_ORIGIN_INVALID');
 return true;
}
export function createCourseStripeProvider(config,fetcher=fetch){
 courseStripeConfigValid(config);const c=Object.freeze({...config});
 const order=o=>check(o&&o.mode===c.mode&&['checkoutId','orderId','applicationId','headquartersId','actorId','sellerUserId','sellerBindingId','consentSnapshotId','feePolicyId'].every(k=>checkoutUuid(o[k]))&&id(o.accountId,'acct')&&Number.isSafeInteger(o.amountMinor)&&o.amountMinor>0&&o.currency==='jpy'&&o.approvedChargeModel==='direct_charge'&&o.bindingVerified===true&&/^[a-f0-9]{64}$/.test(o.consentSha256||'')&&Number.isSafeInteger(o.feeMinor)&&o.feeMinor>=0&&o.feeMinor<=o.amountMinor&&Number.isInteger(o.feeRateBps)&&o.feeRateBps>=0&&o.feeRateBps<=10000&&typeof o.feePolicyVersion==='string'&&o.feePolicyVersion.length>0&&o.feeMinor===courseStripeFeeMinor(o.amountMinor,o.feeRateBps),'STRIPE_ORDER_INVALID');
 async function request(path,accountId,form,idem){
  const r=await fetcher(`https://api.stripe.com/v1/${path}`,{method:form?'POST':'GET',body:form,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${c.secretKey}`,'Stripe-Version':c.apiVersion,...(accountId?{'Stripe-Account':accountId}:{}),...(idem?{'Idempotency-Key':idem}:{}),...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})}});
  check(r.ok&&r.body,'STRIPE_UNAVAILABLE');const reader=r.body.getReader();let size=0;const chunks=[];try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;check(size<=262144,'STRIPE_RESPONSE_TOO_LARGE');chunks.push(p.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 }
 const live=v=>check(v.livemode===(c.mode==='live'),'STRIPE_MODE_MISMATCH');
 const session=(s,o,sid)=>{live(s);check(s.object==='checkout.session'&&id(s.id,`cs_${c.mode}`)&&(!sid||s.id===sid)&&s.mode==='payment'&&s.amount_total===o.amountMinor&&s.currency===o.currency&&s.client_reference_id===o.checkoutId,'STRIPE_SESSION_MISMATCH');metadata(s.metadata,o);};
 const safeUrl=v=>{const u=new URL(v);check(u.protocol==='https:'&&u.hostname==='checkout.stripe.com'&&!u.port&&!u.username&&!u.password,'STRIPE_CHECKOUT_URL_INVALID');return v;};
 const returnUrl=o=>`${c.origin}/academy/course-stripe-checkout/${o.checkoutId}`;
 async function readAccount(o){order(o);const a=await request(`accounts/${o.accountId}`);check(a.object==='account'&&a.id===o.accountId&&a.charges_enabled===true&&a.payouts_enabled===true&&a.details_submitted===true&&a.capabilities?.card_payments==='active'&&a.requirements?.disabled_reason===null,'STRIPE_ACCOUNT_NOT_READY');return {accountId:o.accountId,mode:c.mode};}
 return {
  async createCheckout(o,actor){order(o);check(actor===o.actorId,'STRIPE_ACTOR_MISMATCH');await readAccount(o);const f=new URLSearchParams({mode:'payment','payment_method_types[0]':'card',client_reference_id:o.checkoutId,success_url:returnUrl(o),cancel_url:returnUrl(o),'line_items[0][quantity]':'1','line_items[0][price_data][currency]':o.currency,'line_items[0][price_data][unit_amount]':String(o.amountMinor),'line_items[0][price_data][product_data][name]':'受講料'});if(o.feeMinor>0)f.set('payment_intent_data[application_fee_amount]',String(o.feeMinor));for(const[k,v]of Object.entries(meta(o))){f.set(`metadata[${k}]`,v);f.set(`payment_intent_data[metadata][${k}]`,v);}const s=await request('checkout/sessions',o.accountId,f,`academy2-course:${c.mode}:${o.checkoutId}`);session(s,o);return {sessionId:s.id,checkoutUrl:safeUrl(s.url),accountId:o.accountId};},
  async resumeCheckout(o,sid,actor){order(o);check(actor===o.actorId&&id(sid,`cs_${c.mode}`),'STRIPE_ACTOR_MISMATCH');const s=await request(`checkout/sessions/${sid}`,o.accountId);session(s,o,sid);check(['open','complete'].includes(s.status),'STRIPE_SESSION_EXPIRED');return {sessionId:s.id,checkoutUrl:s.status==='complete'?returnUrl(o):safeUrl(s.url),accountId:o.accountId};},
  // Metadata is a lookup hint only. All invoice/session/amount/account facts are verified again below.
  async eventLookup(e){
   check(e.mode===c.mode&&id(e.accountId,'acct'),'STRIPE_MODE_MISMATCH');
   const hint=raw=>{const m=raw.metadata;if(!m||!Object.keys(m).some(k=>k.startsWith('academy2_course_')))return null;check(checkoutUuid(m.academy2_course_checkout_id),'STRIPE_SCOPE_MISSING');return m.academy2_course_checkout_id;};
   if(e.sessionId){const ss=await request('checkout/sessions/'+e.sessionId,e.accountId);live(ss);check(ss.object==='checkout.session'&&ss.id===e.sessionId,'STRIPE_SESSION_MISMATCH');const checkoutId=hint(ss);if(!checkoutId)return null;return {...e,checkoutId};}
   let piId=e.paymentIntentId;if(!piId&&e.chargeId){const ch=await request('charges/'+e.chargeId,e.accountId);live(ch);check(ch.id===e.chargeId&&ch.object==='charge','STRIPE_CHARGE_MISMATCH');piId=reference(ch.payment_intent);}check(id(piId,'pi'),'STRIPE_PAYMENT_MISSING');const pi=await request('payment_intents/'+piId,e.accountId);live(pi);check(pi.object==='payment_intent'&&pi.id===piId,'STRIPE_PAYMENT_MISMATCH');const checkoutId=hint(pi);if(!checkoutId)return null;
   const list=await request('checkout/sessions?payment_intent='+piId+'&limit=2',e.accountId);check(list.object==='list'&&Array.isArray(list.data)&&list.data.length===1&&list.has_more===false,'STRIPE_SESSION_LOOKUP_AMBIGUOUS');const ss=object(list.data[0]);live(ss);check(ss.object==='checkout.session'&&id(ss.id,'cs_'+c.mode)&&reference(ss.payment_intent)===piId&&hint(ss)===checkoutId,'STRIPE_SESSION_MISMATCH');
   return {...e,paymentIntentId:piId,checkoutId,sessionId:ss.id};
  },
  async readFacts(o,sid,e){
   order(o);check(e.mode===c.mode&&e.accountId===o.accountId&&(!e.sessionId||e.sessionId===sid)&&id(sid,`cs_${c.mode}`),'STRIPE_SCOPE_MISMATCH');const s=await request(`checkout/sessions/${sid}`,o.accountId);session(s,o,sid);const base={checkoutId:o.checkoutId,orderId:o.orderId,sessionId:sid,accountId:o.accountId,mode:c.mode,amountMinor:o.amountMinor,currency:o.currency,paymentIntentId:null,chargeId:null,refundedMinor:0,refunds:[],disputed:false};
   const piId=reference(s.payment_intent);if(!piId){check(!e.paymentIntentId&&!e.chargeId,'STRIPE_EVENT_REFERENCE_MISMATCH');return {...base,fact:s.status==='expired'?'expired':e.eventType==='checkout.session.async_payment_failed'?'failed':'pending'};}
   check(id(piId,'pi')&&(!e.paymentIntentId||e.paymentIntentId===piId),'STRIPE_PAYMENT_MISMATCH');const pi=await request(`payment_intents/${piId}`,o.accountId);live(pi);check(pi.id===piId&&pi.object==='payment_intent'&&pi.amount===o.amountMinor&&pi.currency===o.currency&&!pi.transfer_data&&!pi.on_behalf_of&&(pi.application_fee_amount??0)===o.feeMinor,'STRIPE_PAYMENT_MISMATCH');metadata(pi.metadata,o);base.paymentIntentId=piId;
   const chId=reference(pi.latest_charge);if(!chId){check(!e.chargeId,'STRIPE_CHARGE_MISMATCH');return {...base,fact:pi.last_payment_error||pi.status==='canceled'?'failed':'pending'};}
   check(id(chId,'ch')&&(!e.chargeId||e.chargeId===chId),'STRIPE_CHARGE_MISMATCH');const ch=await request(`charges/${chId}`,o.accountId);live(ch);check(ch.object==='charge'&&ch.id===chId&&reference(ch.payment_intent)===piId&&ch.amount===o.amountMinor&&ch.currency===o.currency&&!ch.transfer_data&&!ch.on_behalf_of&&(ch.application_fee_amount??0)===o.feeMinor,'STRIPE_CHARGE_MISMATCH');check(Number.isSafeInteger(ch.amount_refunded)&&ch.amount_refunded>=0&&ch.amount_refunded<=o.amountMinor&&typeof ch.disputed==='boolean','STRIPE_REFUND_INVALID');Object.assign(base,{chargeId:chId,refundedMinor:ch.amount_refunded,disputed:ch.disputed||e.eventType.startsWith('charge.dispute.')});
   if(base.refundedMinor>0||e.eventType.startsWith('refund.')){
    const refunds=[];let cursor=null;for(let page=0;page<10;page++){
     const list=await request('refunds?charge='+chId+'&limit=100'+(cursor?'&starting_after='+cursor:''),o.accountId);
     check(list.object==='list'&&Array.isArray(list.data)&&typeof list.has_more==='boolean','STRIPE_REFUND_INVALID');
     for(const r of list.data){check(r.object==='refund'&&id(r.id,'re')&&reference(r.charge)===chId&&reference(r.payment_intent)===piId&&r.currency===o.currency&&Number.isSafeInteger(r.amount)&&r.amount>0&&r.amount<=o.amountMinor&&Number.isSafeInteger(r.created)&&r.created>0&&['pending','requires_action','succeeded','failed','canceled'].includes(r.status)&&(r.reason===null||['duplicate','fraudulent','requested_by_customer','expired_uncaptured_charge'].includes(r.reason))&&!refunds.some(x=>x.refundId===r.id),'STRIPE_REFUND_INVALID');refunds.push({refundId:r.id,status:r.status,amountMinor:r.amount,currency:r.currency,createdUnix:r.created,reason:r.reason});}
     if(!list.has_more)break;check(page<9&&list.data.length>0,'STRIPE_REFUND_LIST_INCOMPLETE');cursor=list.data.at(-1).id;
    }
    check(refunds.filter(r=>r.status==='succeeded').reduce((n,r)=>n+r.amountMinor,0)<=o.amountMinor,'STRIPE_REFUND_INVALID');base.refunds=refunds;
   }
   if(base.disputed)return {...base,fact:'disputed'};if(base.refundedMinor>0)return {...base,fact:'refunded'};
   if(s.payment_status==='paid'&&s.status==='complete'&&pi.status==='succeeded'&&pi.amount_received===o.amountMinor&&ch.paid===true&&ch.captured===true&&ch.amount_captured===o.amountMinor)return {...base,fact:'paid'};
   return {...base,fact:ch.failure_code||pi.last_payment_error||pi.status==='canceled'||e.eventType==='checkout.session.async_payment_failed'?'failed':s.status==='expired'?'expired':'pending'};
  },
 };
}
export function verifyCourseStripeEvent(raw,signature,secret,mode,now=Math.floor(Date.now()/1000)){
 check(['test','live'].includes(mode)&&Buffer.isBuffer(raw)&&raw.length<=262144&&typeof signature==='string'&&signature.length<=8192&&/^whsec_[A-Za-z0-9]+$/.test(secret||''),'STRIPE_SIGNATURE_INVALID');const fields=signature.split(',').map(x=>x.trim().split('='));const ts=fields.filter(x=>x[0]==='t');check(ts.length===1&&/^\d+$/.test(ts[0][1]||''),'STRIPE_SIGNATURE_INVALID');const t=Number(ts[0][1]);check(Number.isSafeInteger(t)&&Math.abs(now-t)<=300,'STRIPE_SIGNATURE_EXPIRED');const expected=createHmac('sha256',secret).update(`${t}.`).update(raw).digest();check(fields.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v||'')&&timingSafeEqual(expected,Buffer.from(v,'hex'))),'STRIPE_SIGNATURE_INVALID');const event=object(JSON.parse(raw.toString()));check(event.object==='event'&&id(event.id,'evt')&&event.livemode===(mode==='live')&&id(event.account,'acct'),'STRIPE_EVENT_INVALID');if(!events.has(event.type))return null;const v=object(event.data?.object);let sessionId=null,paymentIntentId=null,chargeId=null;
 if(event.type.startsWith('checkout.')){check(v.object==='checkout.session'&&id(v.id,`cs_${mode}`)&&v.livemode===(mode==='live'),'STRIPE_EVENT_INVALID');sessionId=v.id;}
 else if(event.type.startsWith('payment_intent.')){check(v.object==='payment_intent'&&id(v.id,'pi')&&v.livemode===(mode==='live'),'STRIPE_EVENT_INVALID');paymentIntentId=v.id;}
 else if(event.type.startsWith('refund.')){check(v.object==='refund'&&id(v.id,'re')&&id(reference(v.charge),'ch')&&id(reference(v.payment_intent),'pi'),'STRIPE_EVENT_INVALID');chargeId=reference(v.charge);paymentIntentId=reference(v.payment_intent);}
 else if(event.type.startsWith('charge.dispute.')){check(v.object==='dispute'&&v.livemode===(mode==='live')&&id(reference(v.charge),'ch'),'STRIPE_EVENT_INVALID');chargeId=reference(v.charge);}
 else{check(v.object==='charge'&&id(v.id,'ch')&&v.livemode===(mode==='live'),'STRIPE_EVENT_INVALID');chargeId=v.id;paymentIntentId=reference(v.payment_intent);check(id(paymentIntentId,'pi'),'STRIPE_EVENT_INVALID');}
 return {eventId:event.id,eventType:event.type,mode,accountId:event.account,sessionId,paymentIntentId,chargeId};
}
export async function reconcileCourseStripeEvent(event,provider,store){
 if(!event)return {status:'ignored'};const lookup=await provider.eventLookup(event);if(!lookup)return {status:'ignored'};
 const found=await store.find(lookup);check(found?.order&&found.order.accountId===event.accountId&&found.order.mode===event.mode,'STRIPE_EVENT_UNREGISTERED');
 const sid=found.sessionId||lookup.sessionId;check(id(sid,'cs_'+event.mode)&&(!lookup.sessionId||lookup.sessionId===sid),'STRIPE_SESSION_MISMATCH');
 const facts=await provider.readFacts(found.order,sid,event);
 if(!found.sessionId){check(typeof store.attach==='function','STRIPE_SESSION_NOT_ATTACHED');await store.attach(found.order,sid);}
 return store.record(event,facts);
}

export function courseStripeFeeMinor(amount,bps){check(Number.isSafeInteger(amount)&&amount>=0&&Number.isInteger(bps)&&bps>=0&&bps<=10000,'STRIPE_FEE_INVALID');return Number(BigInt(amount)*BigInt(bps)/10000n);}
