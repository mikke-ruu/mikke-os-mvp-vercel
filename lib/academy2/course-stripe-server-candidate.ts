import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {privateJson,readBoundedJson} from '@/lib/academy/first-publication-billing/http';
import {checkoutUuid,openingCheckoutInput} from './opening-checkout-policy.mjs';
import {createCourseStripeProvider,courseStripeAttemptMayCreate,verifyCourseStripeEvent,reconcileCourseStripeEvent,type CourseStripeOrder,type CourseStripeMode} from './course-stripe-provider-candidate.mjs';
function runtime(request:Request,webhook=false){
 const mode=process.env.ACADEMY2_COURSE_STRIPE_MODE as CourseStripeMode;
 const origin=process.env.ACADEMY2_COURSE_STRIPE_ORIGIN??'';
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL??'';
 if(process.env.ACADEMY2_COURSE_STRIPE_ENABLED!=='1'||!['test','live'].includes(mode))throw new Error('PAYMENT_NOT_CONFIGURED');
 const expected=new URL(origin);
 if((mode==='test'&&!(new Map([['http://127.0.0.1:57670','http://127.0.0.1:57680'],['http://127.0.0.1:57770','http://127.0.0.1:57780']]).get(origin)===url))
 ||(mode==='live'&&(url!=='https://nttqpprkqbynxyldbnjs.supabase.co'||expected.protocol!=='https:'))
 ||request.headers.get('host')!==expected.host
 ||(request.headers.has('x-forwarded-host')&&request.headers.get('x-forwarded-host')!==expected.host)
 ||(mode==='live'&&request.headers.has('x-forwarded-proto')&&request.headers.get('x-forwarded-proto')!=='https')
 ||(!webhook&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')))throw new Error('PAYMENT_ORIGIN_INVALID');
 const provider=createCourseStripeProvider({mode,origin,secretKey:process.env.ACADEMY2_COURSE_STRIPE_SECRET_KEY??'',apiVersion:process.env.ACADEMY2_COURSE_STRIPE_API_VERSION??''});
 return {provider,mode,url};
}
function client(url:string,key:string,authorization?:string){if(!key)throw new Error('PAYMENT_NOT_CONFIGURED');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:authorization?{Authorization:authorization}:{},fetch:(input,init)=>fetch(input,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)})}});}
function order(value:unknown):CourseStripeOrder{
 const v=value as Partial<CourseStripeOrder>|null;
 if(!v||!['checkoutId','orderId','applicationId','headquartersId','actorId'].every(k=>checkoutUuid(v[k as keyof CourseStripeOrder]))||!['test','live'].includes(v.mode??'')||!/^acct_[A-Za-z0-9]+$/.test(v.accountId??'')||!Number.isSafeInteger(v.amountMinor)||Number(v.amountMinor)<=0||v.currency!=='jpy'||!['created','unpaid','paid','pending','failed','expired','review_required'].includes(v.status??'')||typeof v.createdAt!=='string'||!(v.sessionId===null||typeof v.sessionId==='string'))throw new Error('PAYMENT_CONTEXT_INVALID');return v as CourseStripeOrder;
}
const unavailable=()=>privateJson({error:'PAYMENT_UNAVAILABLE',message:'決済状況を確認できませんでした。再読み込みして確認してください。'},503);
export async function serveCourseStripe(action:'create'|'read'|'complete',request:Request){
 try{
  const rt=runtime(request);if(request.method!=='POST')return privateJson({error:'INVALID_REQUEST'},400);
  // The browser never marks a Stripe transaction paid.
  if(action==='complete')return privateJson({error:'WEBHOOK_REQUIRED',message:'支払い結果は決済サービスから確認します。'},409);
  const auth=request.headers.get('authorization');if(!auth||auth.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(auth))return privateJson({error:'AUTH_REQUIRED'},401);
  const body=await readBoundedJson(request,AbortSignal.timeout(20000));if(!openingCheckoutInput(action,body))return privateJson({error:'INVALID_REQUEST'},400);
  const input=body as Record<string,string>;const user=client(rt.url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'',auth);const identity=await user.auth.getUser(auth.slice(7));if(identity.error||!identity.data.user||identity.data.user.is_anonymous!==false)return privateJson({error:'AUTH_REQUIRED'},401);
  const read=action==='create'?await user.rpc('academy2_request_course_stripe_checkout',{p_application_id:input.applicationId,p_request_id:input.requestId,p_mode:rt.mode}):await user.rpc('academy2_course_stripe_context',{p_checkout_id:input.checkoutId});
  if(read.error)return privateJson({error:'CHECKOUT_UNAVAILABLE',message:'決済の対象と利用条件を確認してください。'},read.error.code==='42501'?403:409);
  const saved=order(read.data);if(saved.mode!==rt.mode||saved.actorId!==identity.data.user.id)throw new Error('PAYMENT_SCOPE_MISMATCH');
  if(action==='read')return privateJson({checkout_id:saved.checkoutId,application_id:saved.applicationId,title:'受講料',amount_minor:saved.amountMinor,status:saved.status==='created'?'pending':saved.status,paid_at:saved.paidAt??null,can_pay:saved.canPay===true&&saved.status!=='paid'&&saved.status!=='review_required',provider:'stripe_connect',mode:rt.mode});
  if(saved.status==='review_required')return privateJson({error:'PAYMENT_REVIEW_REQUIRED',message:'この決済は本部での確認が必要です。'},409);
  if(saved.status==='paid')return privateJson({checkoutUrl:`/academy/course-stripe-checkout/${saved.checkoutId}`,provider:'stripe_connect',mode:rt.mode});
  if(saved.canPay!==true)return privateJson({error:'PAYMENT_NOT_AVAILABLE',message:'契約と決済の状態を確認してください。'},409);
  if(saved.sessionId){const resumed=await rt.provider.resumeCheckout(saved,saved.sessionId,identity.data.user.id);return privateJson({checkoutUrl:resumed.checkoutUrl,provider:'stripe_connect',mode:rt.mode});}
  if(!courseStripeAttemptMayCreate(saved.createdAt))throw new Error('PAYMENT_REQUIRES_RECONCILIATION');
  const checkout=await rt.provider.createCheckout(saved,identity.data.user.id);const admin=client(rt.url,process.env.SUPABASE_SERVICE_ROLE_KEY??'');
  const attached=await admin.rpc('academy2_attach_course_stripe_session',{p_checkout_id:saved.checkoutId,p_mode:rt.mode,p_account_id:checkout.accountId,p_session_id:checkout.sessionId});if(attached.error)throw new Error('PAYMENT_SESSION_NOT_SAVED');
  return privateJson({checkoutUrl:checkout.checkoutUrl,provider:'stripe_connect',mode:rt.mode});
 }catch{return unavailable();}
}
export async function serveCourseStripeWebhook(request:Request){
 try{
  const rt=runtime(request,true);if(request.method!=='POST'||!request.body)return privateJson({error:'INVALID_REQUEST'},400);
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>262144){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(p.value);}}finally{reader.releaseLock();}
  const event=verifyCourseStripeEvent(Buffer.concat(chunks),request.headers.get('stripe-signature')??'',process.env.ACADEMY2_COURSE_STRIPE_WEBHOOK_SECRET??'',rt.mode);
  const admin=client(rt.url,process.env.SUPABASE_SERVICE_ROLE_KEY??'');
  const result=await reconcileCourseStripeEvent(event,rt.provider,{
   async find(e){const found=await admin.rpc('academy2_find_course_stripe_checkout',{p_mode:e.mode,p_account_id:e.accountId,p_session_id:e.sessionId,p_checkout_id:e.checkoutId});if(found.error)throw new Error('PAYMENT_LOOKUP_FAILED');if(!found.data)return null;const saved=order(found.data);return {order:saved,sessionId:saved.sessionId};},
   async attach(o,sid){const attached=await admin.rpc('academy2_attach_course_stripe_session',{p_checkout_id:o.checkoutId,p_mode:o.mode,p_account_id:o.accountId,p_session_id:sid});if(attached.error)throw new Error('PAYMENT_SESSION_NOT_SAVED');},
   async record(e,p){const saved=await admin.rpc('academy2_record_course_stripe_fact',{p_checkout_id:p.checkoutId,p_event_id:e.eventId,p_event_type:e.eventType,p_facts:p});if(saved.error)throw new Error('PAYMENT_FACT_NOT_SAVED');if(!saved.data||typeof saved.data.status!=='string')throw new Error('PAYMENT_RESULT_INVALID');return {status:saved.data.status};},
  });return privateJson(result);
 }catch{return unavailable();}
}
export async function serveCourseStripeQuote(request:Request){
 if(process.env.ACADEMY2_COURSE_STRIPE_ENABLED!=='1')return privateJson({enabled:false});
 try{
  const rt=runtime(request);
  const input=await readBoundedJson(request,AbortSignal.timeout(20000));
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('offeringId' in input)||!checkoutUuid(input.offeringId))return privateJson({error:'INVALID_REQUEST'},400);
  const user=client(rt.url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'');
  const normal=await user.rpc('academy2_public_intake_with_form',{p_id:input.offeringId,p_instructor:false});
  const methods=normal.data?.offering?.payment_methods;
  if(!normal.error&&Array.isArray(methods)&&methods.length>0&&!methods.includes('card'))return privateJson({enabled:false});
  const result=await user.rpc('academy2_public_intake_stripe',{p_id:input.offeringId,p_mode:rt.mode});
  if(result.error||!result.data||result.data.card_ready!==true)return privateJson({enabled:true,error:'CARD_NOT_READY',card_ready:false},409);
  return privateJson({...result.data,enabled:true});
 }catch{return privateJson({enabled:true,error:'PAYMENT_UNAVAILABLE',card_ready:false},503);}
}
