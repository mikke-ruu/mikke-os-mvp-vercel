import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { privateJson, readBoundedJson } from '@/lib/academy/first-publication-billing/http';
import { openingCheckoutInput } from './opening-checkout-policy.mjs';
import { createOpeningStripeTestProvider, verifyOpeningStripeTestEvent, reconcileOpeningStripeTestEvent, type OpeningTestOrder } from './opening-stripe-test-provider.mjs';

function runtime(request:Request, webhook=false) {
  const url=new URL(request.url);
  if(process.env.ACADEMY2_STRIPE_TEST_ENABLED!=='1' || process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:57680'
    || !['http://127.0.0.1:57670','http://localhost:57670'].includes(url.origin)
    || request.headers.get('host')!=='127.0.0.1:57670'
    || (request.headers.has('x-forwarded-host') && request.headers.get('x-forwarded-host')!=='127.0.0.1:57670')
    || (!webhook && (request.headers.get('origin')!=='http://127.0.0.1:57670' || request.headers.get('sec-fetch-site')==='cross-site')))
    throw new Error('SANDBOX_DISABLED');
  const provider=createOpeningStripeTestProvider({mode:'stripe_test_direct',sandboxEnabled:true,
    secretKey:process.env.ACADEMY2_STRIPE_TEST_SECRET_KEY??'',apiVersion:process.env.ACADEMY2_STRIPE_TEST_API_VERSION??'',
    origin:'http://127.0.0.1:57670',supabaseOrigin:'http://127.0.0.1:57680'});
  return provider;
}
function client(key:string,authorization?:string) {
  if(!key)throw new Error('SANDBOX_NOT_CONFIGURED');
  return createClient('http://127.0.0.1:57680',key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:authorization?{Authorization:authorization}:{},fetch:(url,options)=>fetch(url,{...options,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)})}});
}
function order(value:unknown):OpeningTestOrder & {status:string;paidAt:string|null;sessionId:string|null;createdAt:string} {
  // Full validation occurs in the provider; this DTO comes only from the trusted RPC.
  if(!value || typeof value!=='object')throw new Error('CONTEXT_MISSING');
  return value as OpeningTestOrder & {status:string;paidAt:string|null;sessionId:string|null;createdAt:string};
}
const unavailable=()=>privateJson({error:'STRIPE_TEST_UNAVAILABLE',message:'テスト決済を確認できませんでした。再読み込みして確認してください。'},503);

/** Read-only Stripe verification. Never creates or assigns an account to a user. */
export async function serveInstructorConnectTestVerification(request:Request) {
  try {
    const provider=runtime(request);
    if(request.method!=='POST')return privateJson({error:'INVALID_REQUEST'},400);
    const authorization=request.headers.get('authorization');
    if(!authorization || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization) || authorization.length>8192)return privateJson({error:'AUTH_REQUIRED'},401);
    const user=client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'',authorization);
    const identity=await user.auth.getUser(authorization.slice(7));
    if(identity.error||!identity.data.user||identity.data.user.is_anonymous!==false)return privateJson({error:'AUTH_REQUIRED'},401);
    const admin=client(process.env.SUPABASE_SERVICE_ROLE_KEY??'');
    const binding=await admin.rpc('academy2_instructor_connect_binding',{p_user:identity.data.user.id});
    if(binding.error||!binding.data||binding.data.userId!==identity.data.user.id||binding.data.mode!=='test')return privateJson({error:'INSTRUCTOR_ACCOUNT_NOT_BOUND'},409);
    const verified=await provider.readInstructorAccount(binding.data.accountId,identity.data.user.id);
    const saved=await admin.rpc('academy2_record_instructor_connect',{p_user:verified.userId,p_account:verified.accountId,p_mode:verified.mode,
      p_charges:verified.chargesEnabled,p_payouts:verified.payoutsEnabled,p_details:verified.detailsSubmitted});
    if(saved.error)throw new Error('VERIFICATION_NOT_SAVED');
    return privateJson({ready:verified.chargesEnabled&&verified.payoutsEnabled&&verified.detailsSubmitted});
  } catch {return privateJson({error:'INSTRUCTOR_CONNECT_UNVERIFIED'},503);}
}

export async function serveOpeningStripeTest(action:'create'|'read',request:Request) {
  try {
    const provider=runtime(request);
    if(request.method!=='POST')return privateJson({error:'INVALID_REQUEST'},400);
    const authorization=request.headers.get('authorization');
    if(!authorization || authorization.length>8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return privateJson({error:'AUTH_REQUIRED'},401);
    const input=await readBoundedJson(request,AbortSignal.timeout(20000));
    if(!openingCheckoutInput(action,input))return privateJson({error:'INVALID_REQUEST'},400);
    const body=input as Record<string,string>, user=client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'',authorization);
    const identity=await user.auth.getUser(authorization.slice(7));
    if(identity.error || !identity.data.user || identity.data.user.is_anonymous!==false)return privateJson({error:'AUTH_REQUIRED'},401);
    const result=action==='create'
      ?await user.rpc('academy2_request_stripe_test_checkout',{p_application_id:body.applicationId,p_request_id:body.requestId})
      :await user.rpc('academy2_stripe_test_context',{p_checkout_id:body.checkoutId});
    if(result.error)return privateJson({error:'CHECKOUT_UNAVAILABLE'},result.error.code==='42501'?403:409);
    const saved=order(result.data);
    if(action==='read')return privateJson({application_id:saved.applicationId,title:'開講ライセンス（Stripeテスト）',amount_minor:saved.amountMinor,
      status:saved.status,paid_at:saved.paidAt,can_pay:false,provider:'stripe_test_direct'});
    if(saved.status==='paid')return privateJson({checkoutUrl:`/academy/opening-license-checkout/${saved.checkoutId}?provider=stripe_test_direct`,provider:'stripe_test_direct'});
    if(saved.sessionId){const resumed=await provider.resumeCheckout(saved,saved.sessionId,identity.data.user.id);return privateJson({checkoutUrl:resumed.checkoutUrl,provider:'stripe_test_direct'});}
    // Stripe may prune an idempotency key after 24h. Do not automatically retry an ambiguous old create.
    const age=Date.now()-Date.parse(saved.createdAt);
    if(!Number.isFinite(age)||age<0||age>23*60*60*1000)throw new Error('CHECKOUT_REQUIRES_REVIEW');
    const checkout=await provider.createCheckout(saved,identity.data.user.id);
    const admin=client(process.env.SUPABASE_SERVICE_ROLE_KEY??'');
    const attached=await admin.rpc('academy2_attach_stripe_test_session',{p_checkout_id:saved.checkoutId,p_account_id:checkout.accountId,p_session_id:checkout.sessionId});
    if(attached.error)throw new Error('SESSION_NOT_SAVED');
    return privateJson({checkoutUrl:checkout.checkoutUrl,provider:'stripe_test_direct'});
  } catch { return unavailable(); }
}

export async function serveOpeningStripeTestWebhook(request:Request) {
  try {
    const provider=runtime(request,true);
    if(request.method!=='POST')return privateJson({error:'INVALID_REQUEST'},400);
    const chunks:Uint8Array[]=[];let size=0;
    if(!request.body)return privateJson({error:'INVALID_REQUEST'},400);
    const reader=request.body.getReader();
    try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(part.value);}}finally{reader.releaseLock();}
    const event=verifyOpeningStripeTestEvent(Buffer.concat(chunks),request.headers.get('stripe-signature')??'',process.env.ACADEMY2_STRIPE_TEST_WEBHOOK_SECRET??'');
    const admin=client(process.env.SUPABASE_SERVICE_ROLE_KEY??'');
    const result=await reconcileOpeningStripeTestEvent(event,provider,{
      async find(accountId,sessionId){const r=await admin.rpc('academy2_find_stripe_test_session',{p_account_id:accountId,p_session_id:sessionId});if(r.error)throw new Error('LOOKUP_FAILED');return r.data?{order:order(r.data),sessionId}:null;},
      async settle(e,p){const r=await admin.rpc('academy2_settle_stripe_test_checkout',{p_checkout_id:p.checkoutId,p_invoice_id:p.invoiceId,p_account_id:p.accountId,
        p_session_id:p.sessionId,p_event_id:e.eventId,p_payment_intent_id:p.paymentIntentId,p_charge_id:p.chargeId,p_amount_minor:p.amountMinor,p_currency:p.currency});
        if(r.error)throw new Error('SETTLEMENT_FAILED');return {status:'paid'};},
    });
    return privateJson(result);
  } catch {return unavailable();}
}
