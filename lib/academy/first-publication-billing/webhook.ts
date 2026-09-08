import 'server-only';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { object, demand, nextPaidMonth } from './stripe-runtime';
import type { JsonObject } from './stripe-runtime';
import type { VerifiedStripeEvent } from '../../billing/platform/stripe';
import { privateJson } from './http';

export type SubscriptionContext = {
  scheme: 'academy_first_publication_168h_v1'; headquarters_id:string; owner_user_id:string;
  provider_customer_id:string; provider_subscription_id:string; first_invoice_id:string;
  price_id:string; amount_yen:number; original_paid_at:string; current_period_start:string; current_period_end:string;
};
export type WebhookDependencies = {
  secret:string; mode:'test'|'live'; now:()=>number;
  read(path:string,signal:AbortSignal):Promise<JsonObject>;
  context(input:{subscriptionId?:string;invoiceId?:string},signal:AbortSignal):Promise<SubscriptionContext | {scheme:'other'} | null>;
  renewalQuote(context:SubscriptionContext,periodStart:string,signal:AbortSignal):Promise<{priceId:string;amountYen:number;periodEnd:string}>;
  apply(event:Exclude<VerifiedStripeEvent,{kind:'activation'}>&{providerCustomerId:string;invoiceId:string|null;amountYen:number|null},signal:AbortSignal):Promise<void>;
};
function subscriptionId(invoice:JsonObject) {
  const legacy=invoice.subscription;
  const parent=invoice.parent;
  const modern=object(parent)&&object(parent.subscription_details)?parent.subscription_details.subscription:null;
  if(legacy&&modern&&legacy!==modern)throw new Error('PROVIDER_SCOPE_MISMATCH');
  const id=legacy??modern;return typeof id==='string'&&/^sub_[A-Za-z0-9]+$/.test(id)?id:null;
}
async function rawBody(request:Request,signal:AbortSignal){
  const reader=request.body?.getReader();demand(reader,'INVALID_SIGNATURE');
  const chunks:Uint8Array[]=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>undefined);};signal.addEventListener('abort',cancel,{once:true});
  try{for(;;){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done)break;size+=part.value.byteLength;if(size>262144){await reader.cancel();throw new Error('INVALID_SIGNATURE');}chunks.push(part.value);}const all=new Uint8Array(size);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.byteLength;}return all;}
  finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
function verify(raw:Uint8Array,header:string|null,deps:WebhookDependencies){
  demand(deps.secret?.startsWith('whsec_')&&['test','live'].includes(deps.mode),'WEBHOOK_NOT_CONFIGURED');
  demand(raw.length>=2&&header&&header.length<=4096,'INVALID_SIGNATURE');
  const parts=header.split(',').map(p=>p.split('=')),times=parts.filter(([k])=>k==='t'),signatures=parts.filter(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v??''));
  demand(times.length===1&&/^\d{10}$/.test(times[0][1])&&Math.abs(deps.now()/1000-Number(times[0][1]))<=300,'INVALID_SIGNATURE');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),expected=createHmac('sha256',deps.secret).update(`${times[0][1]}.${text}`).digest();
  demand(signatures.some(([,value])=>timingSafeEqual(expected,Buffer.from(value,'hex'))),'INVALID_SIGNATURE');
  const event:unknown=JSON.parse(text);demand(object(event)&&typeof event.id==='string'&&/^evt_[A-Za-z0-9]+$/.test(event.id)&&event.livemode===(deps.mode==='live')&&Number.isSafeInteger(event.created)&&object(event.data)&&object(event.data.object),'INVALID_EVENT');
  return {event,snapshot:event.data.object,hash:createHash('sha256').update(raw).digest('hex')};
}
export async function handleFirstPublicationWebhook(request:Request,deps:WebhookDependencies){
  if(request.method!=='POST')return privateJson({error:'INVALID_REQUEST'},405);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
  let verified:ReturnType<typeof verify>;
  try{verified=verify(await rawBody(request,signal),request.headers.get('stripe-signature'),deps);}catch(error){return privateJson({error:error instanceof Error&&error.message==='WEBHOOK_NOT_CONFIGURED'?'WEBHOOK_NOT_CONFIGURED':'INVALID_SIGNATURE'},error instanceof Error&&error.message==='WEBHOOK_NOT_CONFIGURED'?503:400);}
  try{
    const {event,snapshot,hash}=verified;
    demand(typeof snapshot.id==='string','INVALID_EVENT');
    const invoiceEvent=event.type==='invoice.paid'||event.type==='invoice.payment_failed';
    const stateEvent=event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted';
    if(!invoiceEvent&&!stateEvent)return privateJson({outcome:'ignored_event_type'});
    demand(invoiceEvent?/^in_[A-Za-z0-9]+$/.test(snapshot.id):/^sub_[A-Za-z0-9]+$/.test(snapshot.id),'INVALID_EVENT');
    const current=await deps.read(`${invoiceEvent?'invoices':'subscriptions'}/${snapshot.id}`,signal);
    demand(current.id===snapshot.id&&current.livemode===(deps.mode==='live'),'PROVIDER_SCOPE_MISMATCH');
    const subId=invoiceEvent?subscriptionId(current):snapshot.id;
    const context=await deps.context(subId?{subscriptionId:subId}:{invoiceId:snapshot.id},signal);
    demand(context,'BINDING_NOT_READY');
    if(context.scheme==='other')return privateJson({outcome:'ignored_other_scheme'});
    demand(context.scheme==='academy_first_publication_168h_v1'&&current.customer===context.provider_customer_id&&(!subId||subId===context.provider_subscription_id),'PROVIDER_SCOPE_MISMATCH');
    // DB binding, not editable/signed metadata, establishes ownership and expected billing values.
    const metadata=invoiceEvent&&object(current.parent)&&object(current.parent.subscription_details)?current.parent.subscription_details.metadata:current.metadata;
    if(object(metadata)&&'headquarters_id' in metadata)demand(metadata.headquarters_id===context.headquarters_id,'PROVIDER_SCOPE_MISMATCH');
    if(invoiceEvent&&snapshot.id===context.first_invoice_id){demand(current.currency==='jpy'&&current.total===context.amount_yen,'INITIAL_INVOICE_MISMATCH');return privateJson({outcome:'ignored_first_invoice'});}
    if(invoiceEvent){
      demand(subId&&current.currency==='jpy'&&object(current.lines)&&Array.isArray(current.lines.data)&&current.lines.has_more===false,'INVALID_RENEWAL_INVOICE');
      if(current.billing_reason==='subscription_create'&&current.total===0&&current.amount_paid===0)return privateJson({outcome:'ignored_zero_initial_invoice'});
      demand(current.lines.data.length===1,'INVALID_RENEWAL_LINES');
      const line=current.lines.data[0];demand(object(line)&&object(line.period),'INVALID_RENEWAL_LINES');
      const modern=object(line.pricing)&&object(line.pricing.price_details)?line.pricing.price_details.price:null;
      const linePrice=object(line.price)?line.price.id:modern;
      const start=line.period.start,end=line.period.end;
      demand(Number.isSafeInteger(start)&&Number.isSafeInteger(end),'INVALID_RENEWAL_PERIOD');
      const started=(start as number)*1000,ended=(end as number)*1000;
      const quote=await deps.renewalQuote(context,new Date(started).toISOString(),signal);
      demand(Date.parse(quote.periodEnd)===ended&&linePrice===quote.priceId&&current.total===quote.amountYen&&current.amount_due===quote.amountYen&&line.amount===quote.amountYen,'RENEWAL_PRICE_MISMATCH');
      // A duplicate older invoice can still be sent to the ledger, whose event-id/hash guard is authoritative.
      demand(started>=Date.parse(context.original_paid_at)&&ended>started&&ended===nextAnchoredMonth(Date.parse(context.original_paid_at),started),'INVALID_RENEWAL_PERIOD');
      if(event.type==='invoice.payment_failed'&&current.status==='paid')return privateJson({outcome:'ignored_obsolete_failure'});
      demand(event.type==='invoice.paid'?current.status==='paid'&&current.amount_paid===quote.amountYen:current.status==='open','PROVIDER_STATE_NOT_READY');
      await deps.apply({kind:event.type==='invoice.paid'?'invoice_paid':'invoice_failed',eventId:event.id as string,eventHash:hash,subscriptionId:subId,status:event.type==='invoice.paid'?'active':'past_due',periodStart:new Date(started).toISOString(),periodEnd:new Date(ended).toISOString(),cancelAtPeriodEnd:false,occurredAt:new Date((event.created as number)*1000).toISOString(),providerCustomerId:context.provider_customer_id,invoiceId:snapshot.id,amountYen:quote.amountYen},signal);
    }else{
      demand(object(current.items)&&Array.isArray(current.items.data)&&current.items.data.length===1,'INVALID_SUBSCRIPTION_ITEMS');
      const item=current.items.data[0];demand(object(item)&&object(item.price)&&item.quantity===1,'RENEWAL_PRICE_MISMATCH');
      const start=item.current_period_start??current.current_period_start,end=item.current_period_end??current.current_period_end;
      demand(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&typeof current.cancel_at_period_end==='boolean','INVALID_SUBSCRIPTION_PERIOD');
      const quote=(start as number)*1000>=nextPaidMonth(Date.parse(context.original_paid_at))?await deps.renewalQuote(context,new Date((start as number)*1000).toISOString(),signal):{priceId:context.price_id,amountYen:context.amount_yen,periodEnd:new Date(nextPaidMonth(Date.parse(context.original_paid_at))).toISOString()};
      demand(item.price.id===quote.priceId&&item.price.currency==='jpy'&&item.price.unit_amount===quote.amountYen&&Date.parse(quote.periodEnd)===(end as number)*1000,'RENEWAL_PRICE_MISMATCH');
      const status=current.status==='canceled'?'ended':current.status==='past_due'?'past_due':current.status==='active'?'active':null;demand(status,'PROVIDER_STATE_NOT_READY');
      await deps.apply({kind:'subscription_state',eventId:event.id as string,eventHash:hash,subscriptionId:context.provider_subscription_id,status,periodStart:new Date((start as number)*1000).toISOString(),periodEnd:new Date((end as number)*1000).toISOString(),cancelAtPeriodEnd:current.cancel_at_period_end,occurredAt:new Date((event.created as number)*1000).toISOString(),providerCustomerId:context.provider_customer_id,invoiceId:null,amountYen:null},signal);
    }
    return privateJson({outcome:'applied'});
  }catch{return privateJson({error:'WEBHOOK_RECONCILIATION_REQUIRED'},503);}
}
function nextAnchoredMonth(original:number,start:number){
  const base=nextPaidMonth(start),originalJst=new Date(original+9*3600000),nextJst=new Date(base+9*3600000);
  const last=new Date(Date.UTC(nextJst.getUTCFullYear(),nextJst.getUTCMonth()+1,0)).getUTCDate();
  return Date.UTC(nextJst.getUTCFullYear(),nextJst.getUTCMonth(),Math.min(originalJst.getUTCDate(),last),originalJst.getUTCHours(),originalJst.getUTCMinutes(),originalJst.getUTCSeconds())-9*3600000;
}
