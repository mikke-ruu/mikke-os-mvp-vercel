'use client';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {AuthGate} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import {checkoutUuid} from '@/lib/academy2/opening-checkout-policy.mjs';
type Checkout={id:string;application_id:string;title:string;amount_minor:number;currency:'JPY';provider:'local_simulator';status:'unpaid'|'paid';can_pay:boolean};
function Content(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Checkout|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const pending=useRef(false),generation=useRef(0);
 async function request(action:'read'|'complete'){
  if(pending.current||!checkoutUuid(id)||(action==='complete'&&(!data||uncertain)))return;
  const turn=generation.current;pending.current=true;setBusy(true);setError('');
  try{
   const {data:session,error:authError}=await supabase.auth.getSession();
   if(authError||!session.session)throw Error('ログインしてください。');
   const response=await fetch(`/academy/api/course-checkout/${action}`,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30_000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session.access_token}`},body:JSON.stringify({checkoutId:id})});
   const value=await response.json();
   if(!response.ok)throw Error(value.message||'決済結果を確認できませんでした。もう一度読み込んでください。');
   if(value.id!==id||!checkoutUuid(value.application_id)||value.provider!=='local_simulator'||value.currency!=='JPY'||!Number.isSafeInteger(value.amount_minor)||value.amount_minor<0||typeof value.title!=='string'||typeof value.can_pay!=='boolean'||!['unpaid','paid'].includes(value.status))throw Error('決済結果を確認できませんでした。');
   if(turn===generation.current){setData(value);setUncertain(false);}
  }catch(cause){if(turn===generation.current){setUncertain(true);setError(cause instanceof Error?cause.message:'決済結果を確認できませんでした。');}}
  finally{if(turn===generation.current){pending.current=false;setBusy(false);}}
 }
 useEffect(()=>{generation.current++;pending.current=false;setData(null);if(!checkoutUuid(id)){setError('決済の確認先が正しくありません。');return;}void request('read');return()=>{generation.current++;pending.current=false;};},[id]);
 return <main className="mx-auto min-h-screen max-w-xl space-y-5 bg-white px-5 py-8 text-[13px] leading-relaxed">
  <Link href="/academy/learner-home" className="inline-flex min-h-11 items-center underline">← 受講者ホームへ</Link>
  <header><p className="text-xs text-gray-500">Academy</p><h1 className="mt-1 text-xl font-bold">カード決済の動作確認</h1></header>
  <p className="rounded-lg bg-amber-50 p-4">ローカル確認用です。実際の請求は発生しません。カード番号の入力も不要です。</p>
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-4 text-red-800">{error}</p>}
  {busy&&<p role="status">決済状況を確認しています…</p>}
  {data&&<section className="space-y-4 rounded-xl border border-gray-200 p-5"><h2 className="text-base font-bold">{data.title}</h2><p className="text-xl font-bold">¥{data.amount_minor.toLocaleString('ja-JP')}<span className="ml-2 text-xs font-normal">税込</span></p>
   <p role="status">{uncertain?'決済結果は未確認です。もう一度読み込んで状態を確認してください。':data.status==='paid'?'確認用の決済が完了しました。':'確認用の決済はまだ完了していません。'}</p>
   {!uncertain&&data.status==='unpaid'&&<button type="button" disabled={busy||!data.can_pay} onClick={()=>void request('complete')} className="min-h-12 w-full rounded-lg bg-[#f75a3b] px-4 py-3 font-bold text-white disabled:opacity-50">確認用の決済を完了する</button>}
   {!uncertain&&data.status==='unpaid'&&!data.can_pay&&<p>現在は決済できません。申込の状態を確認してください。</p>}
   {!uncertain&&data.status==='paid'&&<Link href="/academy/learner-home#learner-home-learning" className="inline-flex min-h-12 items-center font-bold underline">受講内容・教材を確認する →</Link>}
  </section>}
  <button type="button" disabled={busy||!checkoutUuid(id)} onClick={()=>void request('read')} className="min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50">もう一度読み込む</button>
 </main>;
}
export function LocalCourseCheckout(){return <AuthGate><Content/></AuthGate>;}
