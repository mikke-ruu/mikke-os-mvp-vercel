'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {getAcademy2Event,getAcademy2EventRegistrationSource,setAcademy2EventRegistration,type Academy2EventDetail,type EventRegistrationSource} from '@/lib/academy2/operations';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './event-detail.module.css';

const reasonLabels:Record<string,string>={
 plan_not_published:'販売プランはまだ公開されていません。販売ページと初回の公開条件を確認してください。',
 publication_revision_mismatch:'開催と公開済み販売プランの保存版が一致しません。販売条件を確認してください。',
 public_source_unavailable:'本部または販売プランの公開条件を確認してください。',
 event_not_ready:'開催の状態・日時・受講方法を確認してください。',
 kit_not_ready:'物品の受け渡し方法と配送先の設定を確認してください。',
};
/** Separate an event save from explicit registration; server checks remain authoritative. */
export function EventRegistrationControl({headquartersId,event,participantCount=0,relatedPlanHref,onRelatedNavigate,enabled,locked,onReload,onBusyChange}:{headquartersId:string;event:Academy2EventDetail;participantCount?:number;relatedPlanHref?:string;onRelatedNavigate?:()=>boolean;enabled:boolean;locked:boolean;onReload:()=>void;onBusyChange:(value:boolean)=>void}) {
 const [source,setSource]=useState<EventRegistrationSource|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(''),[confirm,setConfirm]=useState<'open'|'closed'|null>(null),[retry,setRetry]=useState(0);
 const request=useRef<{signature:string;id:string}|null>(null),inFlight=useRef(false);
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 useEffect(()=>{let active=true;setConfirm(null);setSource(null);if(!enabled)return;setLoading(true);setError('');
  void getAcademy2EventRegistrationSource(headquartersId,event.id).then(row=>{if(active)setSource(row);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'募集条件を読み込めませんでした。');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[headquartersId,event.id,event.revision,enabled,retry]);
 async function apply(){if(!confirm||event.revision===null||!enabled||locked||inFlight.current||confirm==='open'&&!source?.ready)return;
  const signature=JSON.stringify({event:event.id,revision:event.revision,status:confirm,source:source?.offering_id});
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  inFlight.current=true;setBusy(true);onBusyChange(true);setError('');setSaved('');
  try{
   await setAcademy2EventRegistration(headquartersId,event.id,event.revision,request.current.id,confirm,confirm==='open'?source!.offering_id:null);
   const verified=await getAcademy2Event(headquartersId,event.id);
   if(verified.registration_status!==confirm)throw new Error('受付状態の再取得を確認できませんでした。最新の状態を確認してください。');
   setSaved(confirm==='open'?'✓ 受付を開始しました':'✓ 受付を停止しました。既存の申込は維持されています。');request.current=null;setConfirm(null);onReload();
  }catch(cause){setError(cause instanceof Error?cause.message:'受付状態の変更を確認できませんでした。');}
  finally{inFlight.current=false;setBusy(false);onBusyChange(false);}
 }
 return <div className={styles.registration} aria-label="募集の確認と受付">
  <div className={styles.actions} aria-label="関連ページ">{relatedPlanHref?<Link className={styles.textLink} href={relatedPlanHref} onClick={event=>{if(onRelatedNavigate&&!onRelatedNavigate())event.preventDefault();}}>販売プランを確認</Link>:null}{source?.public_path?<Link className={styles.textLink} href={source.public_path} target="_blank" rel="noopener noreferrer">販売ページを確認</Link>:null}</div>
  <p className={styles.help}>現在：{event.registration_status==='open'?'受付中':event.registration_status==='draft'?'下書き':'受付停止中'}</p>
  {!enabled?<p className={styles.help}>受付の開始・停止は本部責任者が行います。</p>:<>
   {loading?<p role="status" className={styles.help}>募集条件を確認中…</p>:null}


   {source?.reasons.map(reason=><p key={reason} className={styles.help}>{reasonLabels[reason]??'公開条件を確認してください。'}</p>)}
   {source?.reasons.includes('plan_not_published')&&event.sales_plan_id?<Link className={styles.btn} href={href(`/academy/offerings/${event.sales_plan_id}?step=6`)}>販売プランの公開前確認へ</Link>:null}
   {['planned','active'].includes(event.status)&&event.revision!==null?<div className={styles.actions}>
    {event.registration_status!=='open'?<button className={`${styles.btn} ${styles.primary}`} disabled={locked||busy||loading||!source?.ready} onClick={()=>setConfirm('open')}>受付を開始する</button>:<button className={styles.btn} disabled={locked||busy||loading} onClick={()=>setConfirm('closed')}>受付を停止する</button>}
   </div>:null}
   {confirm?<div className={styles.section}><p className={styles.help}>{confirm==='open'?'この開催の日時・受講方法・定員・物品の受け渡しと販売ページを確認しましたか？ 受付開始後、お客様が申し込めるようになります。':participantCount>0?'新規申込の受付だけを停止します。既存の申込・入金・受講履歴は維持します。開催内容も変更する場合は、申込者への連絡を確認してください。':'新しい申込の受付を停止します。'}</p><div className={styles.actions}><button className={`${styles.btn} ${styles.primary}`} disabled={busy||locked} onClick={()=>void apply()}>{busy?'処理中…':confirm==='open'?'確認して受付を開始する':'確認して受付を停止する'}</button><button className={styles.btn} disabled={busy} onClick={()=>setConfirm(null)}>戻る</button></div></div>:null}
   {error?<div role="alert" className={styles.error}>{error}<button type="button" className={styles.btn} disabled={busy||locked} onClick={()=>{onReload();setRetry(value=>value+1);}}>最新の募集条件を確認</button></div>:null}
   {saved?<p role="status" className={styles.saved}>{saved}</p>:null}
  </>}
 </div>;
}
