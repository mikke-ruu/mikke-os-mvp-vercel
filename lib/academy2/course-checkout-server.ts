import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {privateJson,readBoundedJson} from '@/lib/academy/first-publication-billing/http';
import {checkoutUuid,localOpeningCheckoutEnabled} from './opening-checkout-policy.mjs';

type Checkout={id:string;application_id:string;provider:'local_simulator';amount_minor:number;currency:'JPY';title:string;status:'unpaid'|'paid';paid_at:string|null;can_pay:boolean};
function checkout(value:unknown):Checkout {
 const row=value as Partial<Checkout>|null;
 if(!row||!checkoutUuid(row.id)||!checkoutUuid(row.application_id)||row.provider!=='local_simulator'
  ||!Number.isSafeInteger(row.amount_minor)||Number(row.amount_minor)<0||row.currency!=='JPY'
  ||typeof row.title!=='string'||!['unpaid','paid'].includes(row.status??'')||typeof row.can_pay!=='boolean')throw Error('INVALID_CHECKOUT');
 return row as Checkout;
}
/** This endpoint has no live/test Stripe adapter. It exists only in an explicitly
 * enabled, loopback-only review runtime backed by the private local receipt RPC. */
export async function serveLocalCourseCheckout(action:'read'|'complete',request:Request){
 if(!localOpeningCheckoutEnabled(process.env,request))return privateJson({error:'NOT_AVAILABLE',message:'この確認用決済はローカル環境でのみ利用できます。'},503);
 if(request.method!=='POST'||request.headers.get('sec-fetch-site')==='cross-site')return privateJson({error:'INVALID_REQUEST'},400);
 const authorization=request.headers.get('authorization');
 if(!authorization||authorization.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return privateJson({error:'AUTH_REQUIRED',message:'ログインしてください。'},401);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30_000)]);
 let input:unknown;
 try{input=await readBoundedJson(request,signal);}catch{return privateJson({error:'INVALID_REQUEST'},400);}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('checkoutId' in input)||!checkoutUuid(input.checkoutId))return privateJson({error:'INVALID_REQUEST'},400);
 const id=input.checkoutId;
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!key)throw Error('NOT_CONFIGURED');
  const safeFetch:typeof fetch=(resource,options)=>fetch(resource,{...options,signal,redirect:'error',cache:'no-store'});
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}};
  const user=createClient(url,key,{...options,global:{...options.global,headers:{Authorization:authorization}}});
  const identity=await user.auth.getUser(authorization.slice(7));
  if(identity.error||!identity.data.user||identity.data.user.is_anonymous!==false)return privateJson({error:'AUTH_REQUIRED',message:'ログインしてください。'},401);
  const current=await user.rpc('academy2_local_course_checkout',{p_checkout_id:id});
  if(current.error)throw current.error;
  let saved=checkout(current.data);
  if(action==='complete'&&saved.status!=='paid'){
   if(!saved.can_pay)return privateJson({error:'NOT_PAYABLE',message:'申込の状態を確認してください。'},409);
   const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw Error('NOT_CONFIGURED');
   const admin=createClient(url,secret,options);
   const receipt=await admin.rpc('academy2_settle_local_course_checkout',{p_checkout_id:id,p_receipt_reference:`local-course-checkout:${id}`});
   if(receipt.error)throw receipt.error;
   const reread=await user.rpc('academy2_local_course_checkout',{p_checkout_id:id});
   if(reread.error)throw reread.error;saved=checkout(reread.data);
   if(saved.status!=='paid')throw Error('RECEIPT_NOT_CONFIRMED');
  }
  return privateJson(saved);
 }catch(cause){
  const code=(cause as {code?:string})?.code;
  const status=code==='42501'?403:code==='PT409'?409:code==='22023'?400:503;
  return privateJson({error:status===403?'FORBIDDEN':status===409?'CONFLICT':'CHECKOUT_UNAVAILABLE',message:status===403?'この申込の決済を確認する権限がありません。':'決済結果を確認できませんでした。再読み込みして状態を確認してください。'},status);
 }
}
