'use client';

import {useEffect,useRef,useState} from 'react';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {listAcademy2Events,type Academy2EventSummary} from '@/lib/academy2/operations';
import {getPlanPublicationReadiness,getFirstPublicationState,publishExistingHeadquartersPlan,publicationReason,type FirstPublicationState,type PublicationReadiness,type PlanPublication,type PublicationInput} from '@/lib/academy2/plan-publication';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getSalesPage,saveSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {prepareSalesPageForPublication} from '@/lib/academy2/prepare-sales-page-publication';
import styles from './headquarters-settings.module.css';

export function SalesPlanPublicationPanel({draft,page,onPagePrepared,onPublished}:{draft:SalesPlanDraft;page:SalesPageDraft;onPagePrepared?:(page:SalesPageDraft)=>void;onPublished?:()=>void}){
 const hq=useAcademy2Headquarters();
 const [events,setEvents]=useState<Academy2EventSummary[]|null>(null),[eventId,setEventId]=useState('');
 const [check,setCheck]=useState<PublicationReadiness|null>(null),[result,setResult]=useState<PlanPublication|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const attempt=useRef<{key:string;id:string}|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const publishing=useRef(false);
 const [phase,setPhase]=useState<'saving'|'publishing'|null>(null);
 const [first,setFirst]=useState<FirstPublicationState|null>(null);
 const materialsOnly=draft.configuration.study_style==='materials_only';
 const deferredFeatures=!['ワークショップ','単品講座','コース'].includes(draft.configuration.kind)||Boolean(draft.configuration.after?.skill_certification||draft.configuration.after?.instructor_license||draft.configuration.after?.certificate?.kind==='certification');
 const canPublish=hq?.role==='administrator';
 useEffect(()=>{if(!canPublish)return;let live=true;getFirstPublicationState(draft.headquarters_id).then(value=>{if(live)setFirst(value);}).catch(()=>{if(live)setFirst(null);});return()=>{live=false;};},[canPublish,draft.headquarters_id,refresh]);
 useEffect(()=>{if(!canPublish)return;let current=true;setEvents(null);setError('');listAcademy2Events(draft.headquarters_id).then(rows=>{if(current)setEvents(rows.filter(row=>row.sales_plan_id===draft.id));}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,draft.headquarters_id,draft.id,refresh]);
 const selected=materialsOnly?undefined:events?.find(row=>row.id===eventId);
 const input:PublicationInput={headquartersId:draft.headquarters_id,planId:draft.id,planRevision:draft.revision,pageRevision:page.revision,eventId:selected?.id??null,eventRevision:selected?.revision??null};
 const key=JSON.stringify(input);
 useEffect(()=>{if(!canPublish||!events)return;let current=true;setCheck(null);setError('');getPlanPublicationReadiness(JSON.parse(key) as PublicationInput).then(value=>{if(current)setCheck(value);}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,events,key,refresh]);
 const ready=!deferredFeatures&&!!check&&(check.ready||(first?.consented===true&&first.phase==='prepared'&&check.reasons.every(reason=>reason==='existing_public_contract_required')));
 const planStep=(reason:string)=>reason==='application_terms_required'?5:reason==='title_or_price_required'||reason==='bank_only_bridge'?3:reason==='teaching_method_required'?2:reason==='six_step_review_settings_pending'?1:null;
 const planHref=(step:number)=>toAcademyContextHref(`/academy/offerings/${draft.id}`,draft.headquarters_id,'manage')+`?step=${step}`;
 async function publish(){
  if(publishing.current||busy||!ready)return;
  publishing.current=true;setBusy(true);setError('');let publicationStarted=false;
  try{
   setPhase('saving');
   const prepared=await prepareSalesPageForPublication({page,planRevision:draft.revision,
    read:()=>getSalesPage(draft.headquarters_id,draft.id),
    save:blocks=>saveSalesPage(draft.headquarters_id,draft.id,0,draft.revision,blocks)});
   onPagePrepared?.(prepared);
   const preparedInput={...input,pageRevision:prepared.revision};
   const verifiedCheck=await getPlanPublicationReadiness(preparedInput);
   const verifiedReady=verifiedCheck.ready||(first?.consented===true&&first.phase==='prepared'&&verifiedCheck.reasons.every(reason=>reason==='existing_public_contract_required'));
   if(!verifiedReady){setCheck(verifiedCheck);throw new Error(verifiedCheck.reasons.map(publicationReason).join(' '));}
   const preparedKey=JSON.stringify(preparedInput);
   if(!attempt.current||attempt.current.key!==preparedKey)attempt.current={key:preparedKey,id:crypto.randomUUID()};
   setPhase('publishing');publicationStarted=true;
   const value=await publishExistingHeadquartersPlan(preparedInput,attempt.current.id);setResult(value);setUncertain(false);onPublished?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'募集公開の結果を確認できませんでした。');if(publicationStarted)setUncertain(true);}
  finally{publishing.current=false;setBusy(false);setPhase(null);}
 }
 if(!canPublish)return <p className={styles.note}>募集公開は本部運営担当が行います。</p>;
 return <section className={`${styles.card} ${styles.publication}`} aria-label="募集公開">
  <h2>募集公開</h2>
  {deferredFeatures&&<p role="alert" className={styles.note}>この販売プランには、今回の公開範囲に含まれない販売タイプまたは認定・講師の設定が保存されています。設定値は保持していますが、新たに募集を公開できません。</p>}
  {!materialsOnly&&<div className={styles.field}><label>募集する開催<select value={eventId} disabled={busy||uncertain||!!result} onChange={event=>{setEventId(event.target.value);setResult(null);attempt.current=null;}}><option value="">開催を選んでください</option>{events?.map(event=><option value={event.id} key={event.id}>{event.title}（{event.schedule_mode==='arranged_after_application'?'申込後に日程相談':event.starts_at?new Date(event.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日時未設定'}）</option>)}</select></label></div>}
  {!result&&!materialsOnly&&<a className={styles.linkRow} href={toAcademyContextHref('/academy/classes/new',draft.headquarters_id,'manage')+`?plan=${encodeURIComponent(draft.id)}`}>この販売プランの開催を作る →</a>}
  {materialsOnly&&<p className={styles.help}>レッスン教材のみのため、開催の登録は不要です。</p>}
  {!check&&!error&&!result&&<p role="status" className={styles.help}>公開条件を確認しています…</p>}
  {check&&!result&&<>
   <div className={styles.actions}><button className={styles.btn} disabled={busy||uncertain} onClick={()=>setRefresh(value=>value+1)}>条件を再確認</button><button className={`${styles.btn} ${styles.orange}`} disabled={busy||!ready} onClick={()=>void publish()}>{busy?(phase==='saving'?'販売ページを保存・確認中…':'公開処理中…'):uncertain?'公開結果を確認中':'募集を公開する'}</button></div>
   {!ready&&check.reasons.length>0&&<div className={styles.note}><strong>公開前に確認すること</strong><ul>{check.reasons.map(reason=><li key={reason}>{publicationReason(reason)} {planStep(reason)&&<a href={planHref(planStep(reason)!)}>設定へ →</a>}{reason==='event_required'&&<a href={toAcademyContextHref('/academy/classes/new',draft.headquarters_id,'manage')+`?plan=${encodeURIComponent(draft.id)}`}>開催を作る →</a>}</li>)}</ul></div>}
   <p className={styles.help}>{first?.phase==='no_operating_fee'?'Academy運営利用料は当面かかりません。':first?.consented&&first.phase==='prepared'?'この契約では初回公開から7日間の無料期間が始まります。':'現在の利用契約は変更されません。'}</p>
   {check.reasons.includes('existing_public_contract_required')&&first?.phase!=='no_operating_fee'&&!first?.consented&&<a className={styles.linkRow} href={toAcademyContextHref('/academy/settings',draft.headquarters_id,'manage')}>利用契約を確認する →</a>}
  </>}
  {result&&<><p className={styles.note} role="status">募集を公開しました。</p><a className={styles.linkRow} href={result.public_path}>公開ページと申込フォームを確認する</a></>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </section>;
}
