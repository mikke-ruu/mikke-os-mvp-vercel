import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { privateJson, readBoundedJson } from '@/lib/academy/first-publication-billing/http';
import { checkoutUuid, localOpeningCheckoutEnabled, openingCheckoutInput } from './opening-checkout-policy.mjs';
import { serveOpeningStripe } from './opening-stripe-server';
import { serveOpeningStripeTest } from './opening-stripe-test-server';

type Context = { id:string; application_id:string; provider:'local_simulator'; amount_minor:number; currency:'JPY'; title:string; status:'unpaid'|'paid'; paid_at:string|null; can_pay:boolean };
function context(value: unknown): Context {
  const row=value as Partial<Context> | null;
  if (!row || !checkoutUuid(row.id) || !checkoutUuid(row.application_id) || row.provider!=='local_simulator'
    || !Number.isSafeInteger(row.amount_minor) || Number(row.amount_minor)<=0 || row.currency!=='JPY'
    || !['unpaid','paid'].includes(row.status ?? '') || typeof row.can_pay!=='boolean') throw new Error('INVALID_CONTEXT');
  return row as Context;
}

/** No live provider fallback. Local runtime explicitly enables the simulation.
 * Only the server can record its receipt; the browser cannot submit paid/amount. */
export async function serveOpeningCheckout(action:'create'|'read'|'complete', request:Request) {
  if (process.env.ACADEMY2_OPENING_STRIPE_ENABLED==='1') return serveOpeningStripe(action,request);
  if (action==='create' && process.env.ACADEMY2_STRIPE_TEST_ENABLED==='1') return serveOpeningStripeTest('create',request);
  if (!localOpeningCheckoutEnabled(process.env,request)) {
    return privateJson({error:'PAYMENT_NOT_CONNECTED',message:'カード決済の接続を準備しています。'},503);
  }
  if (request.method!=='POST' || request.headers.get('sec-fetch-site')==='cross-site') return privateJson({error:'INVALID_REQUEST'},400);
  const header=request.headers.get('authorization');
  if (!header || header.length>8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(header)) return privateJson({error:'AUTH_REQUIRED',message:'ログインしてください。'},401);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]);
  let input:unknown;
  try { input=await readBoundedJson(request,signal); } catch { return privateJson({error:'INVALID_REQUEST'},400); }
  if (!openingCheckoutInput(action,input)) return privateJson({error:'INVALID_REQUEST'},400);
  const body=input as Record<string,string>;
  try {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error('NOT_CONFIGURED');
    const safeFetch:typeof fetch=(resource,options)=>fetch(resource,{...options,signal,redirect:'error',cache:'no-store'});
    const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}};
    const user=createClient(url,key,{...options,global:{...options.global,headers:{Authorization:header}}});
    const identity=await user.auth.getUser(header.slice(7));
    if (identity.error || !identity.data.user || identity.data.user.is_anonymous!==false) return privateJson({error:'AUTH_REQUIRED',message:'ログインしてください。'},401);
    const initial=await user.rpc(action==='create'?'academy2_request_opening_checkout':'academy2_opening_checkout',action==='create'
      ? {p_application_id:body.applicationId,p_request_id:body.requestId} : {p_checkout_id:body.checkoutId});
    if (initial.error) throw initial.error;
    let saved=context(initial.data);
    if (action==='complete' && saved.status!=='paid') {
      if (!saved.can_pay) return privateJson({error:'PAYMENT_NOT_AVAILABLE',message:'契約と活動状態を確認してください。'},409);
      const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) throw new Error('NOT_CONFIGURED');
      const admin=createClient(url,secret,options);
      const settled=await admin.rpc('academy2_settle_local_opening_checkout',{p_checkout_id:saved.id,p_receipt_reference:`local-checkout:${saved.id}`});
      if (settled.error) throw settled.error;
      const reread=await user.rpc('academy2_opening_checkout',{p_checkout_id:saved.id});
      if (reread.error) throw reread.error;
      saved=context(reread.data);
      if (saved.status!=='paid') throw new Error('PAYMENT_NOT_SAVED');
    }
    return privateJson(action==='create'?{checkoutUrl:`/academy/opening-license-checkout/${saved.id}`,provider:'local_simulator'}:saved);
  } catch(error) {
    const code=(error as {code?:string})?.code;
    const status=code==='42501'?403:code==='PT409'?409:code==='22023'?400:503;
    return privateJson({error:status===403?'FORBIDDEN':status===409?'STATE_CONFLICT':'PAYMENT_UNAVAILABLE',
      message:status===403?'この支払いを操作する権限がありません。':status===409?'支払い状態が更新されています。もう一度確認してください。':'支払い結果を確認できませんでした。再読み込みして状態を確認してください。'},status);
  }
}
