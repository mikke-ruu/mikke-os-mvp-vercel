"use client";
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { InstructorOperationsShell } from '@/components/academy2/InstructorOperationsShell';
import { supabase } from '@/lib/supabase/client';

type Checkout = { application_id:string; title:string; amount_minor:number; status:'unpaid'|'paid'|'pending'|'failed'|'expired'|'review_required'; can_pay:boolean; provider:'local_simulator'|'stripe_test_direct'|'stripe_connect'; mode?:'test'|'live' };
function CheckoutContent(){
 const {id}=useParams<{id:string}>();
 const stripeTest=useSearchParams().get('provider')==='stripe_test_direct';
 const [data,setData]=useState<Checkout|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 async function request(action:'read'|'complete'){
  if(action==='complete' && (stripeTest || data?.provider!=='local_simulator'))return;
  setBusy(true);setError(null);
  try{
   const {data:session,error:authError}=await supabase.auth.getSession();
   if(authError||!session.session)throw new Error('ログインしてください。');
   const response=await fetch(stripeTest ? '/academy/api/opening-license/stripe-test/read' : `/academy/api/opening-license/checkout/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session.access_token}`},body:JSON.stringify({checkoutId:id})});
   const value=await response.json();
   if(!response.ok)throw new Error(value.message||'決済状況を確認できませんでした。もう一度お試しください。');
   if(!['local_simulator','stripe_test_direct','stripe_connect'].includes(value.provider)||!['unpaid','paid','pending','failed','expired','review_required'].includes(value.status)||(value.provider==='stripe_connect'&&!['test','live'].includes(value.mode)))throw new Error('決済状況を確認できませんでした。');
   setData(value);
  }catch(e){setError(e instanceof Error?e.message:'決済状況を確認できませんでした。');}finally{setBusy(false);}
 }
 useEffect(()=>{setData(null);void request('read');},[id,stripeTest]);
 return <section className="mx-auto max-w-lg space-y-4 p-5 text-[13px]">
  <h1 className="text-base font-semibold">{data?.provider==='local_simulator'?'ローカル決済テスト':stripeTest||data?.mode==='test'?'テスト決済の確認':'カード決済の確認'}</h1>
  <p>{data?.provider==='local_simulator'?'実際の請求は行いません。開講ライセンスの支払い後の動作を確認するための画面です。':stripeTest||data?.mode==='test'?'テストモードです。実際の請求は行いません。':'決済サービスから届く支払い結果を確認します。'}</p>
  {error&&<p role="alert">{error}</p>}
  {busy&&<p role="status">確認しています…</p>}
  {data&&<div className="space-y-4 rounded-xl border bg-white p-4">
   <h2 className="text-[14px] font-semibold">{data.title}</h2>
   <p>開講ライセンス料：{new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(data.amount_minor)}</p>
   <p role="status">{({paid:'お支払いを確認しました',review_required:'本部での確認が必要です',failed:'お支払いを確認できませんでした',expired:'決済の有効期限が切れました',pending:'支払い結果を確認中です',unpaid:'支払い結果はまだ反映されていません'})[data.status]}</p>
   {data.provider==='local_simulator'&&data.status==='unpaid'&&<button type="button" disabled={busy||!data.can_pay} onClick={()=>void request('complete')} className="rounded-lg bg-[#f75a3b] px-4 py-3 text-white disabled:opacity-50">テスト決済を完了する</button>}
   {data.status==='unpaid'&&!data.can_pay&&<p>{data.provider!=='local_simulator' ? '支払い結果はまだ反映されていません。時間をおいて再読み込みしてください。' : '現在は決済できません。申込の状態を確認してください。'}</p>}
   <div><Link className="underline" href={`/academy/instructor-applications/${data.application_id}`}>申込詳細に戻る</Link></div>
  </div>}
  <button type="button" disabled={busy} onClick={()=>void request('read')} className="rounded-lg border px-4 py-2">もう一度読み込む</button>
 </section>;
}
export default function Page(){return <InstructorOperationsShell><Suspense fallback={<p role="status">確認しています…</p>}><CheckoutContent/></Suspense></InstructorOperationsShell>;}
