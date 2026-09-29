import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {privateJson,readBoundedJson} from '@/lib/academy/first-publication-billing/http';
import {checkoutUuid,localOpeningCheckoutEnabled} from './opening-checkout-policy.mjs';
import type {MonthlyReviewQuote,MonthlyReviewEnrollment} from './monthly-review-contract';
export type MonthlyAction='capability'|'quote'|'submit'|'read'|'complete'|'materials';
export async function serveLocalMonthlyReview(action:MonthlyAction,request:Request){
 if(!localOpeningCheckoutEnabled(process.env,request))return new Response(null,{status:404});
 if(request.method!=='POST'||request.headers.get('sec-fetch-site')==='cross-site')return privateJson({error:'INVALID_REQUEST'},400);
 const authorization=request.headers.get('authorization');
 if(!authorization||authorization.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return privateJson({error:'AUTH_REQUIRED'},401);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30_000)]);
 let input:unknown;try{input=await readBoundedJson(request,signal);}catch{return privateJson({error:'INVALID_REQUEST'},400);}
 if(!input||typeof input!=='object'||Array.isArray(input))return privateJson({error:'INVALID_REQUEST'},400);
 const body=input as Record<string,unknown>,keys=action==='capability'?[]:action==='quote'?['sourceId']:action==='submit'?['sourceId','requestId','name','terms','agree','price','answers']:['sourceId','enrollmentId'];
 if(Object.keys(body).length!==keys.length||!keys.every(k=>Object.hasOwn(body,k))||(action!=='capability'&&!checkoutUuid(body.sourceId)))return privateJson({error:'INVALID_REQUEST'},400);
 if(action==='submit'&&(!checkoutUuid(body.requestId)||typeof body.name!=='string'||!body.name.trim()||body.name.length>200||typeof body.terms!=='string'||body.terms.length>200||body.agree!==true||!Number.isSafeInteger(body.price)||Number(body.price)<0||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers)))return privateJson({error:'INVALID_REQUEST'},400);
 if(!['capability','quote','submit'].includes(action)&&!checkoutUuid(body.enrollmentId))return privateJson({error:'INVALID_REQUEST'},400);
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!key)throw Error('NOT_CONFIGURED');
  const safeFetch:typeof fetch=(resource,options)=>fetch(resource,{...options,signal,redirect:'error',cache:'no-store'});
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}};
  const user=createClient(url,key,{...options,global:{...options.global,headers:{Authorization:authorization}}});
  const identity=await user.auth.getUser(authorization.slice(7));if(identity.error||!identity.data.user||identity.data.user.is_anonymous!==false)return privateJson({error:'AUTH_REQUIRED'},401);
  if(action==='capability')return privateJson({mode:'local_review',enabled:true});
  if(action==='quote'||action==='submit'){
   const result=await user.rpc('academy2_local_monthly_quote',{p_source_id:body.sourceId});if(result.error)throw result.error;
   const quote=result.data as MonthlyReviewQuote;
   if(quote?.id!==body.sourceId||quote.mode!=='local_review'||quote.published!==false||quote.currency!=='JPY'||!Number.isSafeInteger(quote.price)||quote.price<0)throw Error('INVALID_QUOTE');
   if(action==='quote')return privateJson(quote);
   if(body.price!==quote.price||body.terms!==quote.terms.version)return privateJson({error:'QUOTE_CHANGED',message:'申込条件を読み直してください。'},409);
   const saved=await user.rpc('academy2_local_monthly_submit',{p_source_id:body.sourceId,p_request_id:body.requestId,p_name:body.name,p_terms:quote.terms.version,p_agree:true,p_price:quote.price,p_answers:body.answers});if(saved.error)throw saved.error;return privateJson(saved.data);
  }
  const read=await user.rpc('academy2_local_monthly_read',{p_enrollment_id:body.enrollmentId});if(read.error)throw read.error;
  let saved=read.data as MonthlyReviewEnrollment;
  if(saved?.id!==body.enrollmentId||saved.sourceId!==body.sourceId||!checkoutUuid(saved.invoiceId)||saved.provider!=='local_simulator'||saved.currency!=='JPY'||!Number.isSafeInteger(saved.price)||saved.price<0) return privateJson({error:'FORBIDDEN'},403);
  if(action==='complete'&&saved.status!=='paid'){
   if(saved.status!=='unpaid'||saved.canPay!==true)return privateJson({error:'NOT_PAYABLE',message:'初回決済の期限を過ぎています。金額は変更せず、本部へ申込条件の再確認を依頼してください。'},409);
   const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw Error('NOT_CONFIGURED');
   const admin=createClient(url,secret,options);const receipt=await admin.rpc('academy2_local_monthly_settle',{p_invoice_id:saved.invoiceId,p_receipt_id:'local-monthly:'+saved.invoiceId});if(receipt.error)throw receipt.error;
   const reread=await user.rpc('academy2_local_monthly_read',{p_enrollment_id:body.enrollmentId});if(reread.error)throw reread.error;saved=reread.data as MonthlyReviewEnrollment;
   if(saved.status!=='paid'||saved.id!==body.enrollmentId||saved.sourceId!==body.sourceId)throw Error('PAYMENT_UNCONFIRMED');
  }
  if(action==='materials'){
   const result=await user.rpc('academy2_local_monthly_materials',{p_enrollment_id:body.enrollmentId});if(result.error)throw result.error;return privateJson(result.data);
  }
  return privateJson(saved);
 }catch(cause){const code=(cause as {code?:string})?.code;const status=code==='42501'?403:code==='PT409'?409:code==='22023'?400:503;return privateJson({error:status===403?'FORBIDDEN':status===409?'CONFLICT':'MONTHLY_UNAVAILABLE',message:status===403?'この申込を確認する権限がありません。':'結果を確認できませんでした。もう一度読み込んでください。'},status);}
}

