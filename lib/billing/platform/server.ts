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
import { resolveAcademyBillingPlan } from './academy-plan';

type PolicySet = PlatformBillingQuote['policies'];
type Catalog = Readonly<{
  approvalId:string;
  revision:number;
  merchant:PlatformBillingQuote['merchant'];
  policies:Readonly<Record<string,PolicySet>> | PolicySet;
  plans:Readonly<Record<string,Readonly<{totalYen:number}>>>;
}>;
const TOKEN=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function environment(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  try{if(!url||!publicKey||!secretKey||new URL(url).protocol!=='https:')throw new Error();}catch{throw new PlatformApiError('BILLING_NOT_CONFIGURED');}
  return{url,publicKey,secretKey};
}
function requirePaidBillingEnabled(){
  if(process.env.PLATFORM_BILLING_API_ENABLED!=='1')throw new PlatformApiError('BILLING_NOT_CONFIGURED');
}
function catalog():Catalog{
  requirePaidBillingEnabled();
  let raw:unknown;try{raw=JSON.parse(process.env.PLATFORM_BILLING_CATALOG_JSON??'');}catch{throw new PlatformApiError('BILLING_NOT_CONFIGURED');}
  if(!isRecord(raw)||!TOKEN.test(String(raw.approvalId))||!Number.isSafeInteger(raw.revision)||!isRecord(raw.merchant)||!isRecord(raw.policies)||!isRecord(raw.plans))throw new PlatformApiError('BILLING_NOT_CONFIGURED');
  return raw as unknown as Catalog;
}
function policiesFor(current:Catalog,productKey:string):PolicySet{
  const configured=current.policies;
  const configuredRecord=configured as unknown as Record<string,unknown>;
  const selected=isRecord(configured)&&configured.approved===true?configured:configuredRecord[productKey];
  if(!isRecord(selected)||selected.approved!==true||selected.approvalId!==current.approvalId||selected.revision!==current.revision)throw new PlatformApiError('POLICY_PENDING');
  return selected as unknown as PolicySet;
}
const jstDay=(date:Date)=>new Date(date.getTime()+9*3600000).toISOString().slice(0,10);

function requestDependencies():PlatformHttpDependencies{
  let userClient:ReturnType<typeof createClient>|undefined,verifiedUserId:string|undefined,admin:ReturnType<typeof createClient>|undefined;
  const trustedOrigins=['https://app.mikke-os.com'];
  if(process.env.NODE_ENV==='development'){const configured=process.env.PLATFORM_BILLING_LOCAL_ORIGIN;if(configured)try{const url=new URL(configured);if(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.origin===configured)trustedOrigins.push(configured);}catch{/* fail closed */}}
  const adminClient=()=>admin??=createClient(environment().url,environment().secretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const rpc=async(name:string,args:Record<string,unknown>,signal:AbortSignal)=>{signal.throwIfAborted();const{data,error}=await adminClient().rpc(name as never,args as never);signal.throwIfAborted();return{data:data as unknown,error:error?{code:error.code,message:error.message}:null};};
  const store=()=>createCheckoutStore(rpc);
  async function owns(principal:PlatformPrincipal,scope:{product:string;resourceId:string|null},signal:AbortSignal){
    if(!scope.resourceId)return true;if(!userClient||principal.userId!==verifiedUserId)return false;
    const table=scope.product==='academy_platform'?'academy_headquarters':'community_communities';
    const{data,error}=await userClient.from(table).select('id,owner_user_id').eq('id',scope.resourceId).eq('owner_user_id',principal.userId).abortSignal(signal).maybeSingle();
    const row:unknown=data;return !error&&isRecord(row)&&row.id===scope.resourceId&&row.owner_user_id===principal.userId;
  }
  const selection=async(principal:PlatformPrincipal,input:{product:string;resourceId:string|null;planKey:string;requestId:string},signal:AbortSignal):Promise<BillingSelection>=>{
    const current=catalog();
    if(input.product==='academy_platform'){
      let estimate:unknown=null;
      if(input.resourceId!==null){
        if(!userClient||principal.userId!==verifiedUserId)throw new PlatformApiError('AUTH_REQUIRED');
        signal.throwIfAborted();
        const{data,error}=await userClient.rpc('academy_get_my_current_billing_estimate' as never,{p_headquarters_id:input.resourceId} as never);
        signal.throwIfAborted();
        if(error)throw new PlatformApiError('RESOURCE_UNAVAILABLE');
        estimate=data as unknown;
      }
      const resolved=resolveAcademyBillingPlan(input.resourceId,input.planKey,estimate,new Date());
      if(!resolved.ok)throw new PlatformApiError(resolved.reason==='conflict'?'STATE_CONFLICT':'POLICY_PENDING');
      const approved=current.plans[`academy_platform:${resolved.planKey}`];
      if(!approved||approved.totalYen!==resolved.totalYen)throw new PlatformApiError('POLICY_PENDING');
    }
    if(!Object.hasOwn(current.plans,`${input.product}:${input.planKey}`))throw new PlatformApiError('POLICY_PENDING');
    policiesFor(current,input.product);
    return{ownerUserId:principal.userId,productKey:input.product,resourceId:input.resourceId,planKey:input.planKey,requestId:input.requestId,policyApprovalId:current.approvalId,policyRevision:current.revision};
  };
  return{trustedOrigins,
    async authenticate(token,signal){const{url,publicKey}=environment();userClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,signal,cache:'no-store',redirect:'error'})}});const{data,error}=await userClient.auth.getUser(token);if(error||!data.user||data.user.is_anonymous!==false)return null;verifiedUserId=data.user.id;return{userId:data.user.id,anonymous:false};},
    ownsResource:owns,
    async readStatus(principal,scope,signal){const result=await rpc('platform_billing_status_get',{p_actor_user_id:principal.userId,p_product_key:scope.product,p_resource_id:scope.resourceId},signal);if(result.error)throw new PlatformApiError('BILLING_NOT_CONFIGURED');return result.data;},
    async issueQuote(principal,input,signal){
      if(input.resourceId&&!await owns(principal,input,signal))throw new PlatformApiError('RESOURCE_UNAVAILABLE');
      const expected=await selection(principal,input,signal),current=catalog(),plan=current.plans[`${input.product}:${input.planKey}`];
      if(!plan||!Number.isSafeInteger(plan.totalYen)||plan.totalYen<0)throw new PlatformApiError('POLICY_PENDING');
      const now=new Date(),day=jstDay(now),period=getMonthlyBillingPeriod(day,0);if(!period)throw new PlatformApiError('BILLING_NOT_CONFIGURED');
      const quote:PlatformBillingQuote={quoteId:`quote-${randomUUID()}`,revision:1,purchaseIntent:'explicit_paid_start',scope:{ownerUserId:principal.userId,productKey:input.product,resourceId:input.resourceId,planKey:input.planKey,requestId:input.requestId},currency:'JPY',taxIncluded:true,dueNow:{totalYen:plan.totalYen,dueOn:day},nextPayment:{totalYen:plan.totalYen,dueOn:period.nextRenewalOn},merchant:current.merchant,policies:policiesFor(current,input.product),issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60000).toISOString()};
      if(!validatePlatformBillingQuote(quote,expected,now).ok)throw new PlatformApiError('POLICY_PENDING');await store().saveQuote(quote,expected,now,signal);return quote;
    },
    async startCheckout(principal,input,signal){
      requirePaidBillingEnabled();
      const stripeConfig=readStripeRuntimeConfig(),stripe=createStripeProvider(stripeConfig),checkoutStore=store();
      return executeTestCheckout(input,{...checkoutStore,providerMode:stripeConfig.mode,now:()=>new Date(),selectAuthorizedContext:async(raw,nextSignal)=>{if(raw.resourceId&&!await owns(principal,raw,nextSignal))throw new PlatformApiError('RESOURCE_UNAVAILABLE');return await selection(principal,raw,nextSignal);},createTestSession:(quote,key,nextSignal)=>stripe.createCheckout({attemptId:key.slice('platform-checkout-'.length),productKey:quote.scope.productKey,planKey:quote.scope.planKey,idempotencyKey:key},nextSignal),retrieveTestSession:(sessionId,_quote,nextSignal)=>stripe.retrieveCheckout(sessionId,nextSignal)},signal);
    },
    async startCommunityTrial(principal,input,signal){
      if(input.product!=='community_platform'||input.resourceId!==null)throw new PlatformApiError('INVALID_REQUEST');
      const result=await rpc('platform_billing_community_trial_start',{p_actor_user_id:principal.userId,p_request_id:input.requestId},signal);
      if(result.error){
        if(result.error.code==='23505')throw new PlatformApiError('STATE_CONFLICT');
        if(result.error.code==='42501')throw new PlatformApiError('AUTH_REQUIRED');
        throw new PlatformApiError('BILLING_NOT_CONFIGURED');
      }
      return result.data;
    },
    async openPortal(principal,input,signal){requirePaidBillingEnabled();const result=await rpc('platform_billing_portal_context',{p_actor_user_id:principal.userId,p_product_key:input.product,p_resource_id:input.resourceId},signal);const context:unknown=result.data;if(result.error||!isRecord(context)||typeof context.providerCustomerId!=='string')throw new PlatformApiError('STATE_CONFLICT');return createStripeProvider(readStripeRuntimeConfig()).createPortal(context.providerCustomerId,signal);},
  };
}
export function servePlatformRequest(action:'status'|'quote'|'checkout'|'portal'|'trial_start',request:Request){return handlePlatformRequest(action,request,requestDependencies());}
