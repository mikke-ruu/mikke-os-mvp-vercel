import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { createFirstPublicationStripe, demand, object } from './stripe-runtime';
import type { SetupAttempt } from './stripe-runtime';
import { handleSetupRequest, privateJson, readBoundedJson } from './http';
import { processBillingJob } from './worker';
import type { BillingJob } from './worker';
import { handleFirstPublicationWebhook } from './webhook';
import type { SubscriptionContext } from './webhook';
import { processRenewalJob } from './renewal';
import type { RenewalJob, RenewalQuote } from './renewal';
import { quoteFromDatabase, verifyConfirmedQuote } from './quote';

function runtime(signal: AbortSignal) {
  const env=process.env;
  demand(env.ACADEMY_FIRST_PUBLICATION_API_ENABLED==='1','BILLING_NOT_CONFIGURED');
  const url=env.NEXT_PUBLIC_SUPABASE_URL, publicKey=env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret=env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY;
  demand(url && publicKey && secret && new URL(url).protocol==='https:','DATABASE_NOT_CONFIGURED');
  const safeFetch: typeof fetch=(input,init)=>fetch(input,{...init,signal,cache:'no-store',redirect:'error'});
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}};
  const admin=createClient(url,secret,options);
  async function rpc(name:string,args:Record<string,unknown>):Promise<unknown>{const {data,error}=await admin.rpc(name,args).abortSignal(signal);if(error)throw new Error('DATABASE_OPERATION_FAILED');return data;}
  const stripe=createFirstPublicationStripe({
    secretKey:env.STRIPE_SECRET_KEY??'', mode:env.PLATFORM_BILLING_STRIPE_MODE as 'test'|'live',
    apiVersion:env.ACADEMY_FIRST_PUBLICATION_STRIPE_API_VERSION??'', approvalId:env.ACADEMY_FIRST_PUBLICATION_APPROVAL_ID??'',
    successUrl:env.ACADEMY_FIRST_PUBLICATION_SETUP_SUCCESS_URL??'', cancelUrl:env.ACADEMY_FIRST_PUBLICATION_SETUP_CANCEL_URL??'',
  },safeFetch,Date.now);
  return { rpc,stripe,user:(token:string)=>createClient(url,publicKey,{...options,global:{...options.global,headers:{Authorization:`Bearer ${token}`}}}) };
}
export async function serveSetup(action:'setup'|'confirm',request:Request){
  try {
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),r=runtime(signal);
    return handleSetupRequest(action,request,{
      allowedOrigins:['https://app.mikke-os.com','https://mikke-os.com'],
      async authenticate(token){const {data,error}=await r.user(token).auth.getUser(token);return error||!data.user?null:{id:data.user.id,anonymous:data.user.is_anonymous!==false};},
      async owns(token,userId,hq){const {data,error}=await r.user(token).from('academy_headquarters').select('id,owner_user_id').eq('id',hq).eq('owner_user_id',userId).abortSignal(signal).maybeSingle();return !error&&data?.id===hq&&data?.owner_user_id===userId;},
      async reserve(userId,hq,quote){const value=await r.rpc('academy_first_publication_setup_reserve',{p_owner_user_id:userId,p_headquarters_id:hq,p_quote_id:quote});demand(object(value),'INVALID_ATTEMPT');quoteFromDatabase(value.quote,value as SetupAttempt);return value as SetupAttempt;},
      async setup(a){return r.stripe.setup(a,async(customer,session,setup)=>{await r.rpc('academy_first_publication_setup_attach',{p_attempt_id:a.attempt_id,p_provider_customer_id:customer,p_checkout_session_id:session,p_setup_intent_id:setup??null});},signal);},
      async confirm(a){const original=quoteFromDatabase(a.quote,a);const proof=await r.stripe.verifySetup(a,signal);const saved=await r.rpc('academy_first_publication_setup_complete',{p_attempt_id:a.attempt_id,p_provider_customer_id:proof.customerId,p_setup_intent_id:proof.setupIntentId,p_payment_method_id:proof.paymentMethodId});demand(object(saved)&&saved.attempt_id===a.attempt_id&&saved.status==='verified','PROOF_NOT_PERSISTED');return{paymentPreparationId:a.attempt_id,verified:true,quote:verifyConfirmedQuote(original,saved.quote,a)};},
    });
  }catch{return privateJson({error:'BILLING_NOT_CONFIGURED'},503);}
}
export async function serveWorker(request:Request){
  const expected=process.env.ACADEMY_FIRST_PUBLICATION_WORKER_SECRET, supplied=request.headers.get('authorization');
  if(request.method!=='POST'||!expected||expected.length<32||!supplied||Buffer.byteLength(supplied)!==Buffer.byteLength(`Bearer ${expected}`)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(`Bearer ${expected}`)))return privateJson({error:'AUTH_REQUIRED'},401);
  try{
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(45000)]);
    const input=await readBoundedJson(request,signal);demand(object(input)&&Object.keys(input).length===0,'INVALID_REQUEST');
    const r=runtime(signal), raw=await r.rpc('academy_first_publication_outbox_claim',{p_worker_id:randomUUID(),p_lease_seconds:60});
    if(raw===null){
      const next=await r.rpc('academy_first_publication_renewal_claim',{p_worker_id:randomUUID(),p_lease_seconds:60});
      if(next===null)return privateJson({outcome:'idle'});demand(object(next),'INVALID_JOB');
      const prices:unknown=JSON.parse(process.env.ACADEMY_FIRST_PUBLICATION_PRICE_IDS_JSON??'{}');demand(object(prices),'PRICE_NOT_CONFIGURED');
      const result=await processRenewalJob(next as unknown as RenewalJob,{stripe:r.stripe,now:Date.now,priceIds:prices as Record<string,string>,store:{
        async quote(j){const value=await r.rpc('academy_first_publication_renewal_quote',{p_provider_subscription_id:j.provider_subscription_id,p_period_start:j.period_start});demand(object(value),'RENEWAL_QUOTE_NOT_READY');return value as unknown as RenewalQuote;},
        async check(j){const v=await r.rpc('academy_first_publication_renewal_dispatch_check',{p_event_key:j.event_key,p_lease_token:j.lease_token});return object(v)&&v.allowed===true;},
        async checkpoint(j,step,id){const v=await r.rpc('academy_first_publication_renewal_checkpoint',{p_event_key:j.event_key,p_lease_token:j.lease_token,p_step:step,p_provider_id:id??null});demand(object(v),'INVALID_CHECKPOINT');return v as {operation_key:string;started_at:string;provider_id:string|null;blocked?:boolean};},
        finish(j,result){return r.rpc('academy_first_publication_renewal_finish',{p_event_key:j.event_key,p_lease_token:j.lease_token,p_result:result});},
      }},signal);
      return privateJson({outcome:object(result)&&typeof result.outcome==='string'?result.outcome:'processed'});
    }demand(object(raw),'INVALID_JOB');
    const job=raw as unknown as BillingJob;
    const prices:unknown=JSON.parse(process.env.ACADEMY_FIRST_PUBLICATION_PRICE_IDS_JSON??'{}');demand(object(prices)&&Object.values(prices).every(v=>typeof v==='string'),'PRICE_NOT_CONFIGURED');
    const result=await processBillingJob(job,{stripe:r.stripe,now:Date.now,priceIds:prices as Record<string,string>,store:{
      async dispatchCheck(j){const value=await r.rpc('academy_first_publication_outbox_dispatch_check',{p_event_key:j.event_key,p_lease_token:j.lease_token});return object(value)&&value.allowed===true;},
      async checkpoint(j,step,id){const value=await r.rpc('academy_first_publication_outbox_checkpoint',{p_event_key:j.event_key,p_lease_token:j.lease_token,p_step:step,p_provider_id:id??null});demand(object(value),'INVALID_CHECKPOINT');return value as {operation_key:string;started_at:string;provider_id:string|null};},
      finish(j,result){return r.rpc(result.outcome==='paid'?'academy_first_publication_paid_bridge':'academy_first_publication_outbox_finish',{p_event_key:j.event_key,p_lease_token:j.lease_token,p_result:result});},
    }},signal);
    return privateJson({outcome:object(result)&&typeof result.outcome==='string'?result.outcome:'processed'});
  }catch{return privateJson({error:'WORKER_RECONCILIATION_REQUIRED'},503);}
}
export async function serveWebhook(request:Request){
  try{
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),r=runtime(signal);
    return handleFirstPublicationWebhook(request,{
      secret:process.env.ACADEMY_FIRST_PUBLICATION_WEBHOOK_SECRET??'',mode:process.env.PLATFORM_BILLING_STRIPE_MODE as 'test'|'live',now:Date.now,
      read:(path)=>r.stripe.call(path,'GET',{},null,signal),
      async context(input){
        const raw=await r.rpc(input.subscriptionId?'academy_first_publication_subscription_context':'academy_first_publication_invoice_context',input.subscriptionId?{p_provider_subscription_id:input.subscriptionId}:{p_provider_invoice_id:input.invoiceId});
        if(!object(raw)||raw.kind==='unknown')return null;
        if(raw.kind==='legacy')return{scheme:'other'};
        demand(raw.kind==='academy_first_publication'||raw.kind==='academy_first_publication_pending','INVALID_BILLING_CONTEXT');
        const prices:unknown=JSON.parse(process.env.ACADEMY_FIRST_PUBLICATION_PRICE_IDS_JSON??'{}');
        demand(object(prices)&&typeof raw.plan_key==='string'&&typeof prices[raw.plan_key]==='string','PRICE_NOT_CONFIGURED');
        const context:SubscriptionContext={scheme:'academy_first_publication_168h_v1',headquarters_id:String(raw.headquarters_id),owner_user_id:String(raw.owner_user_id),provider_customer_id:String(raw.provider_customer_id),provider_subscription_id:typeof raw.provider_subscription_id==='string'?raw.provider_subscription_id:'',first_invoice_id:String(raw.provider_invoice_id),price_id:prices[raw.plan_key] as string,plan_key:raw.plan_key,amount_yen:Number(raw.initial_amount_yen),original_paid_at:String(raw.paid_at),current_period_start:String(raw.current_period_start),current_period_end:String(raw.current_period_end)};
        demand(Number.isSafeInteger(context.amount_yen)&&context.amount_yen>0&&/^cus_[A-Za-z0-9]+$/.test(context.provider_customer_id),'INVALID_BILLING_CONTEXT');return context;
      },
      async renewalQuote(context,periodStart){const v=await r.rpc('academy_first_publication_renewal_quote',{p_provider_subscription_id:context.provider_subscription_id,p_period_start:periodStart});const prices:unknown=JSON.parse(process.env.ACADEMY_FIRST_PUBLICATION_PRICE_IDS_JSON??'{}');demand(object(v)&&object(prices)&&typeof v.plan_key==='string'&&typeof prices[v.plan_key]==='string'&&Number.isSafeInteger(v.amount_yen)&&typeof v.period_end==='string','RENEWAL_QUOTE_NOT_READY');return{priceId:prices[v.plan_key] as string,planKey:v.plan_key,amountYen:v.amount_yen as number,periodEnd:v.period_end};},
      async apply(event){await r.rpc('academy_first_publication_subscription_event',{p_provider_subscription_id:event.subscriptionId,p_result:{provider_event_id:event.eventId,provider_result_hash:event.eventHash,provider_customer_id:event.providerCustomerId,event_kind:event.kind,projected_status:event.status,period_start:event.periodStart,period_end:event.periodEnd,cancel_at_period_end:event.kind==='subscription_state'?event.cancelAtPeriodEnd:null,occurred_at:event.occurredAt,provider_invoice_id:event.invoiceId,amount_yen:event.amountYen,currency:event.invoiceId?'jpy':null}});},
    });
  }catch{return privateJson({error:'WEBHOOK_NOT_CONFIGURED'},503);}
}
