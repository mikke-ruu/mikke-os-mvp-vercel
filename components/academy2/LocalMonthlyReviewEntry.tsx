'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import styles from './sales-page-workspace.module.css';

export async function localMonthlyCapability():Promise<boolean>{
 if(window.location.origin!=='http://127.0.0.1:57670')return false;
 const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return false;
 const response=await fetch('/academy/api/monthly-review/capability',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:'{}',cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)return false;const value=await response.json();return value.mode==='local_review'&&value.enabled===true;
}
/** Invisible on normal origins; the server independently verifies the isolated runtime. */
export function LocalMonthlyReviewEntry({draft}:{draft:SalesPlanDraft}){
 const hq=useAcademy2Headquarters();const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<{key:string;id:string}|null>(null);const canReview=hq?.role==='administrator'&&draft.configuration.kind==='月額レッスン';
 useEffect(()=>{let active=true;setEnabled(false);if(canReview)void localMonthlyCapability().then(ok=>{if(active)setEnabled(ok);}).catch(()=>{});return()=>{active=false;};},[canReview,draft.id]);
 async function open(){if(busy||!enabled)return;setBusy(true);setError('');try{
  if(!await localMonthlyCapability())throw new Error('ローカル確認環境を確認できませんでした。');
  const key=`${draft.id}:${draft.revision}`;if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  const {data,error:rpcError}=await supabase.rpc('academy2_local_monthly_prepare',{p_headquarters_id:draft.headquarters_id,p_plan_id:draft.id,p_plan_revision:draft.revision,p_request_id:request.current.id}).abortSignal(AbortSignal.timeout(30000));
  if(rpcError)throw new Error('月額の確認画面を準備できませんでした。保存した条件を確認してください。');
  if(data?.mode!=='local_review'||data?.published!==false||typeof data?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))throw new Error('ローカル確認の受付先を確認できませんでした。');
  window.location.assign('/academy/monthly-review/'+data.id);
 }catch(cause){setError(cause instanceof Error?cause.message:'月額の確認画面を開けませんでした。');}finally{setBusy(false);}}
 if(!canReview||!enabled)return null;
 return <section className={styles.summary} aria-label="ローカルの月額確認"><h2>月額申込のローカル確認</h2><p className={styles.help}>保存済みの条件で申込から受講開始まで確認します。この確認では募集の公開や実際の請求は行いません。</p><button type="button" className={styles.button} disabled={busy} onClick={()=>void open()}>{busy?'準備しています…':'ローカルで月額申込を確認'}</button>{error&&<p role="alert">{error}</p>}</section>;
}
