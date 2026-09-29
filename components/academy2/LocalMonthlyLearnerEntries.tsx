'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import {localMonthlyCapability} from './LocalMonthlyReviewEntry';
import styles from './learner-home.module.css';

type Enrollment={enrollmentId:string;sourceId:string;title:string;status:'unpaid'|'paid'|'first_payment_expired'|'renewal_not_connected';nextDueOn:string;materialsAvailable:boolean};
const labels:Record<Enrollment['status'],string>={unpaid:'お支払い待ち',paid:'受講中',first_payment_expired:'初回支払期限切れ',renewal_not_connected:'継続支払の確認待ち'};
export function monthlyEnrollmentRows(value:unknown):{items:Enrollment[];hasMore:boolean}{
 const page=value as {items?:unknown[];hasMore?:unknown}|null;
 const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 if(!page||!Array.isArray(page.items)||typeof page.hasMore!=='boolean')throw new Error('月額の受講情報を確認できませんでした。');
 for(const entry of page.items){const row=entry as Enrollment|null;if(!row||!uuid(row.enrollmentId)||!uuid(row.sourceId)||typeof row.title!=='string'||!Object.hasOwn(labels,row.status)||typeof row.nextDueOn!=='string'||typeof row.materialsAvailable!=='boolean')throw new Error('月額の受講情報を確認できませんでした。');}
 return {items:page.items as Enrollment[],hasMore:page.hasMore};
}
export function LocalMonthlyLearnerEntries({userId}:{userId:string|null}){
 const [items,setItems]=useState<Enrollment[]>([]),[scope,setScope]=useState<string|null>(null),[enabled,setEnabled]=useState(false),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0),lock=useRef(false);
 async function read(offset:number){const {data,error:failure}=await supabase.rpc('academy2_local_monthly_enrollments',{p_limit:50,p_offset:offset}).abortSignal(AbortSignal.timeout(30000));if(failure)throw new Error('月額の受講情報を読み込めませんでした。');return monthlyEnrollmentRows(data);}
 useEffect(()=>{const current=++generation.current;setScope(userId);setItems([]);setEnabled(false);setMore(false);setError('');setBusy(false);lock.current=false;if(!userId)return;
  void (async()=>{if(!await localMonthlyCapability()||generation.current!==current)return;setEnabled(true);setBusy(true);const page=await read(0);if(generation.current===current){setItems(page.items);setMore(page.hasMore);}})().catch(cause=>{if(generation.current===current)setError(cause instanceof Error?cause.message:'月額の受講情報を読み込めませんでした。');}).finally(()=>{if(generation.current===current)setBusy(false);});
  return()=>{generation.current++;};
 },[userId]);
 async function loadMore(){if(lock.current||busy||!enabled||scope!==userId)return;lock.current=true;setBusy(true);setError('');const current=generation.current;try{const page=await read(items.length);if(current===generation.current){setItems(old=>[...old,...page.items.filter(row=>!old.some(item=>item.enrollmentId===row.enrollmentId))]);setMore(page.hasMore);}}catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'月額の受講情報を読み込めませんでした。');}finally{if(current===generation.current){lock.current=false;setBusy(false);}}}
 if(!userId||scope!==userId||!enabled||(!items.length&&!busy&&!error))return null;
 return <section className={styles.block} aria-label="月額レッスンのローカル確認"><h2 className={styles.name}>月額レッスンのローカル確認</h2><div className={styles.card}>{items.map(item=><div className={styles.row} key={item.enrollmentId}><div><a className={styles.name} href={'/academy/monthly-review/'+item.sourceId}>{item.title} →</a><div className={styles.meta}>{labels[item.status]}{item.nextDueOn&&` / 次回請求日（設定）：${item.nextDueOn}`}</div>{item.materialsAvailable&&<div className={styles.meta}>教材を確認できます。</div>}</div></div>)}{busy&&<p role="status" className={styles.pending}>月額の受講情報を読み込んでいます…</p>}{error&&<p role="alert" className={styles.pending}>{error}</p>}{(more||error)&&<button className={styles.loadMore} type="button" disabled={busy} onClick={()=>void loadMore()}>{error?'もう一度読み込む':'続きを読み込む'}</button>}</div></section>;
}
