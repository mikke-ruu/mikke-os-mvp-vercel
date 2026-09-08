import 'server-only';
import { object, demand } from './stripe-runtime';
import type { JsonObject, createFirstPublicationStripe } from './stripe-runtime';
export type RenewalJob={event_key:string;lease_token:string;kind:'renew_price'|'renew_pay';provider_subscription_id:string;provider_customer_id:string;headquarters_id:string;period_start:string;period_end:string};
export type RenewalQuote={price_id:string;snapshot_id:string;amount_yen:number;plan_key:string;period_start:string;period_end:string};
export type RenewalStore={
  quote(job:RenewalJob):Promise<RenewalQuote>;
  check(job:RenewalJob):Promise<boolean>;
  checkpoint(job:RenewalJob,step:string,id?:string):Promise<{operation_key:string;started_at:string;provider_id:string|null;blocked?:boolean}>;
  finish(job:RenewalJob,result:JsonObject):Promise<unknown>;
};
export async function processRenewalJob(job:RenewalJob,deps:{stripe:ReturnType<typeof createFirstPublicationStripe>;store:RenewalStore;priceIds:Record<string,string>;now:()=>number},signal:AbortSignal){
  const {stripe,store}=deps;
  demand(await store.check(job),'RENEWAL_FENCE_REJECTED');
  const quote=await store.quote(job); // Missing immutable month-end snapshot must fail before any provider mutation.
  demand(quote.period_start===job.period_start&&quote.period_end===job.period_end&&Number.isSafeInteger(quote.amount_yen)&&quote.amount_yen>0&&quote.snapshot_id&&quote.price_id,'RENEWAL_QUOTE_NOT_READY');
  demand(/^sub_[A-Za-z0-9]+$/.test(job.provider_subscription_id)&&/^cus_[A-Za-z0-9]+$/.test(job.provider_customer_id),'INVALID_RENEWAL_SCOPE');
  const priceId=deps.priceIds[quote.plan_key];demand(priceId&&/^price_[A-Za-z0-9]+$/.test(priceId),'PRICE_NOT_CONFIGURED');
  const price=await stripe.call(`prices/${priceId}`,'GET',{},null,signal);
  demand(price.id===priceId&&price.livemode===(stripe.mode==='live')&&price.active===true&&price.currency==='jpy'&&price.unit_amount===quote.amount_yen&&object(price.recurring)&&price.recurring.interval==='month'&&price.recurring.interval_count===1,'RENEWAL_PRICE_MISMATCH');
  async function mutate(step:string,path:string,params:Record<string,string>,resourcePath:string,resourceId:string){
    demand(await store.check(job),'RENEWAL_FENCE_REJECTED');const cp=await store.checkpoint(job,step);demand(!cp.blocked,'RENEWAL_FENCE_REJECTED');
    if(!cp.provider_id){stripe.retryable(cp.started_at);demand(cp.operation_key.length>0&&cp.operation_key.length<=255,'INVALID_OPERATION_KEY');await stripe.call(path,'POST',params,cp.operation_key,signal);const saved=await store.checkpoint(job,step,resourceId);demand(!saved.blocked,'RENEWAL_FENCE_REJECTED');}
    else demand(cp.provider_id===resourceId,'RENEWAL_SCOPE_MISMATCH');
    return stripe.call(resourcePath,'GET',{},null,signal);
  }
  let sub=await stripe.call(`subscriptions/${job.provider_subscription_id}`,'GET',{},null,signal);
  function subscriptionItem(value:JsonObject){
    demand(value.id===job.provider_subscription_id&&value.livemode===(stripe.mode==='live')&&value.customer===job.provider_customer_id&&object(value.metadata)&&value.metadata.headquarters_id===job.headquarters_id&&value.metadata.scheme==='academy_first_publication_168h_v1','RENEWAL_SCOPE_MISMATCH');
    demand(object(value.pause_collection)&&value.pause_collection.behavior==='keep_as_draft'&&value.cancel_at_period_end===false&&value.cancel_at===null&&['active','past_due'].includes(String(value.status)),'RENEWAL_NOT_HELD');
    demand(object(value.items)&&Array.isArray(value.items.data)&&value.items.data.length===1&&object(value.items.data[0]),'RENEWAL_ITEM_MISMATCH');return value.items.data[0];
  }
  let item=subscriptionItem(sub);demand(typeof item.id==='string'&&/^si_[A-Za-z0-9]+$/.test(item.id),'RENEWAL_ITEM_MISMATCH');
  if(!object(item.price)||item.price.id!==priceId||item.quantity!==1){
    sub=await mutate('price_update',`subscriptions/${job.provider_subscription_id}`,{'items[0][id]':item.id,'items[0][price]':priceId,'items[0][quantity]':'1',proration_behavior:'none','pause_collection[behavior]':'keep_as_draft'},`subscriptions/${job.provider_subscription_id}`,job.provider_subscription_id);
    item=subscriptionItem(sub);
  }
  demand(object(item.price)&&item.price.id===priceId&&item.price.currency==='jpy'&&item.price.unit_amount===quote.amount_yen&&item.quantity===1,'RENEWAL_PRICE_NOT_APPLIED');
  if(job.kind==='renew_price')return store.finish(job,{outcome:'price_ready',price_id:quote.price_id,snapshot_id:quote.snapshot_id});
  demand(job.kind==='renew_pay'&&deps.now()>=Date.parse(job.period_start)&&deps.now()<Date.parse(job.period_end),'RENEWAL_NOT_DUE');
  const listed=await stripe.call('invoices','GET',{subscription:job.provider_subscription_id,limit:'100'},null,signal);
  demand(Array.isArray(listed.data)&&listed.has_more===false,'RENEWAL_INVOICE_PAGINATION_REQUIRED');
  const invoiceSub=(v:JsonObject)=>v.subscription??(object(v.parent)&&object(v.parent.subscription_details)?v.parent.subscription_details.subscription:null);
  const candidates=listed.data.filter(v=>object(v)&&v.billing_reason==='subscription_cycle'&&v.customer===job.provider_customer_id&&invoiceSub(v)===job.provider_subscription_id&&object(v.lines)&&Array.isArray(v.lines.data)&&v.lines.data.some(l=>object(l)&&object(l.period)&&l.period.start===Date.parse(job.period_start)/1000&&l.period.end===Date.parse(job.period_end)/1000));
  demand(candidates.length===1&&object(candidates[0])&&typeof candidates[0].id==='string'&&/^in_[A-Za-z0-9]+$/.test(candidates[0].id),'RENEWAL_INVOICE_NOT_READY');
  const id=candidates[0].id, invoicePath=`invoices/${id}`;
  let invoice=await stripe.call(invoicePath,'GET',{},null,signal);
  function lineOf(v:JsonObject){demand(v.livemode===(stripe.mode==='live'),'RENEWAL_SCOPE_MISMATCH');demand(v.id===id&&v.customer===job.provider_customer_id&&invoiceSub(v)===job.provider_subscription_id&&v.auto_advance===false&&v.currency==='jpy'&&object(v.lines)&&v.lines.has_more===false&&Array.isArray(v.lines.data)&&v.lines.data.length===1,'RENEWAL_INVOICE_MISMATCH');const line=v.lines.data[0];demand(object(line)&&object(line.period)&&line.period.start===Date.parse(job.period_start)/1000&&line.period.end===Date.parse(job.period_end)/1000,'RENEWAL_PERIOD_MISMATCH');return line;}
  demand(invoice.livemode===(stripe.mode==='live'),'RENEWAL_SCOPE_MISMATCH');
  let line=lineOf(invoice);
  const actualPrice=(v:JsonObject)=>object(v.price)?v.price.id:object(v.pricing)&&object(v.pricing.price_details)?v.pricing.price_details.price:null;
  if(invoice.status==='draft'&&(actualPrice(line)!==priceId||line.amount!==quote.amount_yen)){
    demand(typeof line.id==='string'&&/^il_[A-Za-z0-9_]+$/.test(line.id),'RENEWAL_LINE_ID_INVALID');
    // Acacia API contract: only an unfinalized line can be repriced. Never assume a subscription update rewrites existing drafts.
    invoice=await mutate('line_update',`${invoicePath}/lines/${line.id}`,{price:priceId,quantity:'1',discountable:'false',discounts:'',tax_rates:''},invoicePath,id);
    line=lineOf(invoice);
  }
  demand(actualPrice(line)===priceId&&line.amount===quote.amount_yen&&invoice.total===quote.amount_yen&&invoice.amount_due===quote.amount_yen&&invoice.starting_balance===0,'RENEWAL_TOTAL_MISMATCH');
  if(invoice.status==='draft')invoice=await mutate('finalize',`${invoicePath}/finalize`,{auto_advance:'false'},invoicePath,id);
  line=lineOf(invoice);demand(actualPrice(line)===priceId&&line.amount===quote.amount_yen&&invoice.total===quote.amount_yen&&invoice.amount_due===quote.amount_yen,'RENEWAL_TOTAL_MISMATCH');
  if(invoice.status==='open'){
    demand(typeof sub.default_payment_method==='string'&&/^pm_[A-Za-z0-9]+$/.test(sub.default_payment_method),'PAYMENT_METHOD_NOT_READY');
    invoice=await mutate('pay',`${invoicePath}/pay`,{payment_method:sub.default_payment_method,off_session:'true'},invoicePath,id);
  }
  lineOf(invoice);
  if(invoice.status!=='paid')return store.finish(job,{outcome:'attention',reason:'payment_pending',provider_invoice_id:id});
  demand(invoice.amount_paid===quote.amount_yen&&invoice.amount_remaining===0&&object(invoice.status_transitions)&&Number.isSafeInteger(invoice.status_transitions.paid_at),'RENEWAL_PAYMENT_MISMATCH');
  return store.finish(job,{outcome:'paid',provider_invoice_id:id,price_id:quote.price_id,snapshot_id:quote.snapshot_id,amount_yen:quote.amount_yen,period_start:job.period_start,period_end:job.period_end,paid_at:new Date((invoice.status_transitions.paid_at as number)*1000).toISOString()});
}
