'use client';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {AuthGate} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import {checkoutUuid} from '@/lib/academy2/opening-checkout-policy.mjs';

type Checkout={checkout_id:string;application_id:string;title:string;amount_minor:number;status:string;can_pay:boolean;provider:'stripe_connect';mode:'test'|'live'};
function Content(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Checkout|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),generation=useRef(0);
 async function request(action:'read'|'create'){
  if(pending.current||!checkoutUuid(id)||(action==='create'&&(!data?.can_pay||error)))return;
  const turn=generation.current;pending.current=true;setBusy(true);setError('');
  try{
   const {data:session,error:authError}=await supabase.auth.getSession();
   if(authError||!session.session)throw Error('ログインしてください。');
   const response=await fetch(`/api/academy2/course-stripe-candidate/${action}`,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30_000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session.access_token}`},body:JSON.stringify(action==='read'?{checkoutId:id}:{applicationId:data!.application_id,requestId:id})});
   const value=await response.json();
   if(!response.ok)throw Error(value.message||'決済状況を確認できませんでした。もう一度読み込んでください。');
   if(turn!==generation.current)return;
   if(value.provider!=='stripe_connect'||!['test','live'].includes(value.mode))throw Error('決済先を確認できませんでした。');
   if(action==='create'){
    const url=new URL(value.checkoutUrl,window.location.origin);
    if(url.protocol==='https:'&&url.hostname==='checkout.stripe.com'&&!url.username&&!url.password){window.location.assign(url.href);return;}
    if(url.origin===window.location.origin&&url.pathname===`/academy/course-stripe-checkout/${id}`&&!url.search&&!url.hash){pending.current=false;setBusy(false);void request('read');return;}
    throw Error('決済先を確認できませんでした。');
   }
   if(value.checkout_id!==id||!checkoutUuid(value.application_id)||!Number.isSafeInteger(value.amount_minor)||value.amount_minor<=0||typeof value.title!=='string'||typeof value.can_pay!=='boolean'||!['created','unpaid','paid','pending','failed','expired','review_required'].includes(value.status))throw Error('決済状況を確認できませんでした。');
   setData(value);
  }catch(cause){if(turn===generation.current)setError(cause instanceof Error?cause.message:'決済状況を確認できませんでした。');}
  finally{if(turn===generation.current){pending.current=false;setBusy(false);}}
 }
 useEffect(()=>{generation.current++;pending.current=false;setData(null);setError('');if(checkoutUuid(id))void request('read');else setError('決済の確認先が正しくありません。');return()=>{generation.current++;pending.current=false;};},[id]);
 return <main className="mx-auto min-h-screen max-w-xl space-y-5 bg-white px-5 py-8 text-[13px] leading-relaxed">
  <Link href="/academy/learner-home" className="inline-flex min-h-11 items-center underline">← 受講者ホームへ</Link>
  <h1 className="text-xl font-bold">カード決済</h1>
  {data?.mode==='test'&&<p className="rounded-lg bg-amber-50 p-4">テスト決済です。実際の請求は発生しません。</p>}
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-4 text-red-800">{error}</p>}
  {busy&&<p role="status">決済状況を確認しています…</p>}
  {data&&<section className="space-y-4 rounded-xl border border-gray-200 p-5"><h2 className="text-base font-bold">{data.title}</h2><p className="text-xl font-bold">¥{data.amount_minor.toLocaleString('ja-JP')}</p>
   <p role="status">{error?'決済結果は未確認です。もう一度読み込んでください。':data.status==='paid'?'お支払いを確認しました。':data.status==='review_required'?'本部で決済状況を確認しています。':data.status==='pending'?'お支払いの結果を確認しています。':data.status==='failed'?'お支払いは完了していません。':data.status==='expired'?'決済の有効期限が切れています。':'お支払いはまだ完了していません。'}</p>
   {!error&&data.can_pay&&<button type="button" disabled={busy} onClick={()=>void request('create')} className="min-h-12 w-full rounded-lg bg-[#f75a3b] px-4 py-3 font-bold text-white disabled:opacity-50">カード決済へ進む</button>}
   {!error&&data.status==='paid'&&<Link href="/academy/learner-home#learner-home-learning" className="inline-flex min-h-12 items-center font-bold underline">受講内容・教材を確認する →</Link>}
  </section>}
  <button type="button" disabled={busy||!checkoutUuid(id)} onClick={()=>void request('read')} className="min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50">もう一度読み込む</button>
 </main>;
}
export function CourseStripeCheckout(){return <AuthGate><Content/></AuthGate>;}
