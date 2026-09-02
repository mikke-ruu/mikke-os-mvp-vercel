import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { isRecord } from './contracts';
import { handlePlatformRequest, PlatformApiError } from './http';
import type { PlatformHttpDependencies, PlatformPrincipal } from './http';
import { createCheckoutStore } from './store';
import { executeTestCheckout } from './checkout';
import { getMonthlyBillingPeriod } from './schedule';
import { validatePlatformBillingQuote } from './quote';
import type { BillingSelection, PlatformBillingQuote } from './quote';
import { createStripeProvider, readStripeRuntimeConfig } from './stripe';

type Catalog = Readonly<{ approvalId:string;revision:number;merchant:PlatformBillingQuote['merchant'];policies:PlatformBillingQuote['policies'];plans:Readonly<Record<string,Readonly<{totalYen:number}>>> }>;
const TOKEN=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function environment(){
  if(process.env.PLATFORM_BILLING_API_ENABLED!=='1')throw new PlatformApiError('BILLING_NOT_CONFIGURED');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  try{if(!url||!publicKey||!secretKey||new URL(url).protocol!=='https:')throw new Error();}catch{throw new PlatformApiError('BILLING_NOT_CONFIGURED');}
  return{url,publicKey,secretKey};
}
function catalog():Catalog{
  let raw:unknown;try{raw=JSON.parse(process.env.PLATFORM_BILLING_CATALOG_JSON??'');}catch{throw new PlatformApiError('BILLING_NOT_CONFIGURED');}
  if(!isRecord(raw)||!TOKEN.test(String(raw.approvalId))||!Number.isSafeInteger(raw.revision)||!isRecord(raw.merchant)||!isRecord(raw.policies)||raw.policies.approved!==true||!isRecord(raw.plans))throw new PlatformApiError('BILLING_NOT_CONFIGURED');
  return raw as unknown as Catalog;
}
const jstDay=(date:Date)=>new Date(date.getTime()+9*3600000).toISOString().slice(0,10);

function requestDependencies():PlatformHttpDependencies{
  let userClient:ReturnType<typeof createClient>|undefined,verifiedUserId:string|undefined,admin:ReturnType<typeof createClient>|undefined;
  const trustedOrigins=['https://app.mikke-os.com'];
  if(process.env.NODE_ENV==='development'){const configured=process.env.PLATFORM_BILLING_LOCAL_ORIGIN;if(configured)try{const url=new URL(configured);if(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.origin===configured)trustedOrigins.push(configured);}catch{/* fail closed */}}
  const adminClient=()=>admin??=createClient(environment().url,environment().secretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const rpc=async(name:string,args:Record<string,unknown>,signal:AbortSignal)=>{signal.throwIfAborted();const{data,error}=await adminClient().rpc(name as never,args as never);signal.throwIfAborted();return{data:data as unknown,error:error?{code:error.code}:null};};
  const store=()=>createCheckoutStore(rpc);
  async function owns(principal:PlatformPrincipal,scope:{product:string;resourceId:string|null},signal:AbortSignal){
    if(!scope.resourceId)return true;if(!userClient||principal.userId!==verifiedUserId)return false;
    const table=scope.product==='academy_platform'?'academy_headquarters':'community_communities';
    const{data,error}=await userClient.from(table).select('id,owner_user_id').eq('id',scope.resourceId).eq('owner_user_id',principal.userId).abortSignal(signal).maybeSingle();
    const row:unknown=data;return !error&&isRecord(row)&&row.id===scope.resourceId&&row.owner_user_id===principal.userId;
  }
  const selection=(principal:PlatformPrincipal,input:{product:string;resourceId:string|null;planKey:string;requestId:string}):BillingSelection=>{
    const current=catalog();if(!Object.hasOwn(current.plans,`${input.product}:${input.planKey}`))throw new PlatformApiError('POLICY_PENDING');
    return{ownerUserId:principal.userId,productKey:input.product,resourceId:input.resourceId,planKey:input.planKey,requestId:input.requestId,policyApprovalId:current.approvalId,policyRevision:current.revision};
  };
  return{trustedOrigins,
    async authenticate(token,signal){const{url,publicKey}=environment();userClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,signal,cache:'no-store',redirect:'error'})}});const{data,error}=await userClient.auth.getUser(token);if(error||!data.user||data.user.is_anonymous!==false)return null;verifiedUserId=data.user.id;return{userId:data.user.id,anonymous:false};},
    ownsResource:owns,
    async readStatus(principal,scope,signal){const result=await rpc('platform_billing_status_get',{p_actor_user_id:principal.userId,p_product_key:scope.product,p_resource_id:scope.resourceId},signal);if(result.error)throw new PlatformApiError('BILLING_NOT_CONFIGURED');return result.data;},
    async issueQuote(principal,input,signal){
      if(input.resourceId&&!await owns(principal,input,signal))throw new PlatformApiError('RESOURCE_UNAVAILABLE');
      const expected=selection(principal,input),current=catalog(),plan=current.plans[`${input.product}:${input.planKey}`];
      if(!plan||!Number.isSafeInteger(plan.totalYen)||plan.totalYen<0)throw new PlatformApiError('POLICY_PENDING');
      const now=new Date(),day=jstDay(now),period=getMonthlyBillingPeriod(day,0);if(!period)throw new PlatformApiError('BILLING_NOT_CONFIGURED');
      const quote:PlatformBillingQuote={quoteId:`quote-${randomUUID()}`,revision:1,purchaseIntent:'explicit_paid_start',scope:{ownerUserId:principal.userId,productKey:input.product,resourceId:input.resourceId,planKey:input.planKey,requestId:input.requestId},currency:'JPY',taxIncluded:true,dueNow:{totalYen:plan.totalYen,dueOn:day},nextPayment:{totalYen:plan.totalYen,dueOn:period.nextRenewalOn},merchant:current.merchant,policies:current.policies,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60000).toISOString()};
      if(!validatePlatformBillingQuote(quote,expected,now).ok)throw new PlatformApiError('POLICY_PENDING');await store().saveQuote(quote,expected,now,signal);return quote;
    },
    async startCheckout(principal,input,signal){
      const stripe=createStripeProvider(readStripeRuntimeConfig()),checkoutStore=store();
      return executeTestCheckout(input,{...checkoutStore,now:()=>new Date(),selectAuthorizedContext:async(raw,nextSignal)=>{if(raw.resourceId&&!await owns(principal,raw,nextSignal))throw new PlatformApiError('RESOURCE_UNAVAILABLE');return selection(principal,raw);},createTestSession:(quote,key,nextSignal)=>stripe.createCheckout({attemptId:key.slice('platform-checkout-'.length),productKey:quote.scope.productKey,planKey:quote.scope.planKey,idempotencyKey:key},nextSignal),retrieveTestSession:(sessionId,_quote,nextSignal)=>stripe.retrieveCheckout(sessionId,nextSignal)},signal);
    },
    async openPortal(principal,input,signal){const result=await rpc('platform_billing_portal_context',{p_actor_user_id:principal.userId,p_product_key:input.product,p_resource_id:input.resourceId},signal);const context:unknown=result.data;if(result.error||!isRecord(context)||typeof context.providerCustomerId!=='string')throw new PlatformApiError('STATE_CONFLICT');return createStripeProvider(readStripeRuntimeConfig()).createPortal(context.providerCustomerId,signal);},
  };
}
export function servePlatformRequest(action:'status'|'quote'|'checkout'|'portal',request:Request){return handlePlatformRequest(action,request,requestDependencies());}
