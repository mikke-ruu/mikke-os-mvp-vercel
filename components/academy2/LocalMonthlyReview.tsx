'use client';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {AuthGate} from '@/components/AuthGate';
import {AcademyLessonContent} from '@/components/academy/AcademyLessonContent';
import {MonthlyPolicySummary} from './MonthlyPolicySummary';
import {supabase} from '@/lib/supabase/client';
import {checkoutUuid} from '@/lib/academy2/opening-checkout-policy.mjs';
import {conditionMatches} from '@/lib/academy2/application-conditions.mjs';
import type {MonthlyReviewQuote,MonthlyReviewEnrollment,MonthlyReviewMaterials} from '@/lib/academy2/monthly-review-contract';
function Content(){
 const {id}=useParams<{id:string}>();
 const [quote,setQuote]=useState<MonthlyReviewQuote|null>(null),[saved,setSaved]=useState<MonthlyReviewEnrollment|null>(null),[materials,setMaterials]=useState<MonthlyReviewMaterials|null>(null);
 const [name,setName]=useState(''),[agreed,setAgreed]=useState(false),[answers,setAnswers]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),generation=useRef(0),requestId=useRef<string|null>(null);
 async function api<T>(action:string,body:Record<string,unknown>):Promise<T>{
  const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('ログインしてください。');
  const response=await fetch('/academy/api/monthly-review/'+action,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30_000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({sourceId:id,...body})});
  const value=await response.json();if(!response.ok)throw Error(value.message||'確認画面を読み込めませんでした。');return value as T;
 }
 async function run(action:'refresh'|'submit'|'complete'|'materials'){
  if(pending.current||!checkoutUuid(id))return;if(action!=='refresh'&&uncertain)return;
  pending.current=true;setBusy(true);setError('');const turn=generation.current;
  try{
   if(action==='refresh'){
    const q=await api<MonthlyReviewQuote>('quote',{});if(q.id!==id||q.mode!=='local_review'||q.published!==false)throw Error('確認先が正しくありません。');
    const e=q.existingEnrollmentId?await api<MonthlyReviewEnrollment>('read',{enrollmentId:q.existingEnrollmentId}):null;
    if(turn===generation.current){setQuote(q);setSaved(e);setMaterials(null);setUncertain(false);}
   }else if(action==='submit'&&quote){
    requestId.current??=crypto.randomUUID();
    const e=await api<MonthlyReviewEnrollment>('submit',{requestId:requestId.current,name,terms:quote.terms.version,agree:agreed,price:quote.price,answers:projected});
    if(turn===generation.current){setSaved(e);setUncertain(false);}
   }else if(action==='complete'&&saved){
    const e=await api<MonthlyReviewEnrollment>('complete',{enrollmentId:saved.id});if(turn===generation.current){setSaved(e);setUncertain(false);}
   }else if(action==='materials'&&saved){
    const m=await api<MonthlyReviewMaterials>('materials',{enrollmentId:saved.id});if(m.enrollmentId!==saved.id)throw Error('教材の確認先が正しくありません。');if(turn===generation.current)setMaterials(m);
   }
  }catch(cause){if(turn===generation.current){setUncertain(true);setMaterials(null);setError(cause instanceof Error?cause.message:'結果を確認できませんでした。');}}
  finally{if(turn===generation.current){pending.current=false;setBusy(false);}}
 }
 useEffect(()=>{generation.current++;pending.current=false;requestId.current=null;setQuote(null);setSaved(null);setMaterials(null);setName('');setAgreed(false);setAnswers({});setUncertain(false);if(checkoutUuid(id))void run('refresh');else setError('確認先が正しくありません。');return()=>{generation.current++;pending.current=false;};},[id]);
 const projected:Record<string,string>={};const visible=(quote?.fields??[]).filter(field=>{
  if(['name','email','terms'].includes(field.id))return false;
  const context=field._context??{format:null,schedule_mode:null,kit_shipping:false,certificate:false,physical_certificate:false,course_ids:[]};
  if(!conditionMatches(field.condition,context,projected))return false;projected[field.id]=(answers[field.id]??'').trim();return true;
 });
 const inputClass='mt-1 w-full rounded-lg border border-gray-300 bg-white p-3';
 return <main className="mx-auto max-w-2xl space-y-5 bg-white px-4 py-8 text-sm leading-relaxed">
  <Link href="/academy/learner-home" className="inline-flex min-h-11 items-center underline">← 受講者ホームへ</Link>
  <h1 className="text-xl font-bold">月額レッスンの動作確認</h1>
  <p className="rounded-lg bg-amber-50 p-4">ローカル専用の確認画面です。実際の請求は発生しません。初回の模擬決済と教材閲覧に対応しています。次回以降の請求・猶予・解約の実行は未接続です。</p>
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-4">{error}</p>}
  {uncertain&&<p role="status">結果は未確認です。もう一度読み込んでから操作してください。</p>}
  {busy&&<p role="status">確認しています…</p>}
  {quote&&<><h2 className="text-lg font-bold">{quote.title}</h2><p className="text-xl font-bold">月額 ¥{quote.price.toLocaleString('ja-JP')}（税込）</p><MonthlyPolicySummary monthly={quote.monthly}/>
   <p>初回は申込日に満額で決済し、決済完了後から受講できます。日割りは行いません。次回の基準日は申込日と設定した請求日から決まり、支払が遅れても後ろへずらしません。</p>
   <details className="rounded-lg border p-3"><summary>申込規約</summary><p className="mt-3 whitespace-pre-wrap">{quote.terms.body}</p></details>
   <details className="rounded-lg border p-3"><summary>退会・教材利用終了の条件</summary><p className="mt-3 whitespace-pre-wrap">{quote.exitDocument.body}</p></details>
  </>}
  {quote&&!saved&&<form className="space-y-4" onSubmit={event=>{event.preventDefault();void run('submit');}}>
   <label className="block">お名前<input required maxLength={200} className={inputClass} value={name} onChange={e=>setName(e.target.value)} disabled={busy||uncertain}/></label>
   {visible.map(field=><label className="block" key={field.id}>{field.label}{field.required?'（必須）':'（任意）'}{field.type==='select'?<select className={inputClass} required={field.required} value={answers[field.id]??''} disabled={busy||uncertain} onChange={e=>setAnswers(a=>({...a,[field.id]:e.target.value}))}><option value="">選択してください</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:field.type==='textarea'?<textarea className={inputClass} required={field.required} maxLength={1000} value={answers[field.id]??''} disabled={busy||uncertain} onChange={e=>setAnswers(a=>({...a,[field.id]:e.target.value}))}/>:<input className={inputClass} type={field.type==='date'?'date':field.type==='tel'?'tel':'text'} required={field.required} maxLength={1000} value={answers[field.id]??''} disabled={busy||uncertain} onChange={e=>setAnswers(a=>({...a,[field.id]:e.target.value}))}/>}</label>)}
   <label className="flex gap-2"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required disabled={busy||uncertain}/>申込規約と月額レッスンの条件を確認し、同意します</label>
   <button disabled={busy||uncertain||!agreed} className="min-h-12 rounded-lg bg-[#f75a3b] px-5 font-bold text-white disabled:opacity-50">確認用の申込を保存する</button>
  </form>}
  {saved&&<section className="space-y-3 rounded-xl border p-4"><h2 className="font-bold">申込の状態</h2><dl><dt>申込日</dt><dd>{saved.joinedOn}</dd><dt>初回決済日</dt><dd>{saved.paidOn??'未確認'}</dd><dt>次回の基準日</dt><dd>{saved.nextDueOn}</dd></dl>
   {!uncertain&&<p role="status">{saved.status==='paid'?'初回の確認用決済が完了しました。':saved.status==='unpaid'?'初回の確認用決済は未完了です。':saved.status==='first_payment_expired'?'初回決済の期限を過ぎています。本部に申込条件の再確認を依頼してください。この画面では金額の調整や再申込は行いません。':'次回以降の請求は未接続のため、教材を停止しています。'}</p>}
   {!uncertain&&saved.status==='unpaid'&&saved.canPay&&<button disabled={busy} onClick={()=>void run('complete')} className="min-h-12 rounded-lg bg-[#f75a3b] px-5 font-bold text-white disabled:opacity-50">初回の模擬決済を完了する</button>}
   {!uncertain&&saved.materialsAvailable&&<button disabled={busy} onClick={()=>void run('materials')} className="min-h-12 rounded-lg border px-5 font-bold disabled:opacity-50">本人の教材を開く</button>}
  </section>}
  {materials?.courses.map((course,index)=><section key={course.month+course.courseId+index} className="rounded-xl border p-4"><h2 className="font-bold">{course.month}｜{course.courseName}</h2><AcademyLessonContent blocks={course.blocks}/></section>)}
  <button type="button" disabled={busy||!checkoutUuid(id)} onClick={()=>void run('refresh')} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">もう一度読み込む</button>
 </main>;
}
export function LocalMonthlyReview(){return <AuthGate><Content/></AuthGate>;}
