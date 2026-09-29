'use client';

import {useEffect,useRef,useState} from 'react';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {listAcademy2Events,type Academy2EventSummary} from '@/lib/academy2/operations';
import {getPlanPublicationReadiness,getFirstPublicationState,publishExistingHeadquartersPlan,publicationReason,type FirstPublicationState,type PublicationReadiness,type PlanPublication,type PublicationInput} from '@/lib/academy2/plan-publication';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import type {SalesPageDraft} from '@/lib/academy2/sales-pages';
import styles from './headquarters-settings.module.css';

export function SalesPlanPublicationPanel({draft,page}:{draft:SalesPlanDraft;page:SalesPageDraft}){
 const hq=useAcademy2Headquarters();
 const [events,setEvents]=useState<Academy2EventSummary[]|null>(null),[eventId,setEventId]=useState('');
 const [check,setCheck]=useState<PublicationReadiness|null>(null),[result,setResult]=useState<PlanPublication|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const attempt=useRef<{key:string;id:string}|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const [first,setFirst]=useState<FirstPublicationState|null>(null);
 const materialsOnly=draft.configuration.study_style==='materials_only';
 const canPublish=hq?.role==='administrator';
 useEffect(()=>{if(!canPublish)return;let live=true;getFirstPublicationState(draft.headquarters_id).then(value=>{if(live)setFirst(value);}).catch(()=>{if(live)setFirst(null);});return()=>{live=false;};},[canPublish,draft.headquarters_id,refresh]);
 useEffect(()=>{if(!canPublish)return;let current=true;setEvents(null);setError('');listAcademy2Events(draft.headquarters_id).then(rows=>{if(current)setEvents(rows.filter(row=>row.sales_plan_id===draft.id));}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,draft.headquarters_id,draft.id,refresh]);
 const selected=materialsOnly?undefined:events?.find(row=>row.id===eventId);
 const input:PublicationInput={headquartersId:draft.headquarters_id,planId:draft.id,planRevision:draft.revision,pageRevision:page.revision,eventId:selected?.id??null,eventRevision:selected?.revision??null};
 const key=JSON.stringify(input);
 useEffect(()=>{if(!canPublish||!events)return;let current=true;setCheck(null);setError('');getPlanPublicationReadiness(JSON.parse(key) as PublicationInput).then(value=>{if(current)setCheck(value);}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,events,key,refresh]);
 const ready=!!check&&(check.ready||(first?.consented===true&&first.phase==='prepared'&&check.reasons.every(reason=>reason==='existing_public_contract_required')));
 async function publish(){if(busy||!ready)return;setBusy(true);setError('');if(!attempt.current||attempt.current.key!==key)attempt.current={key,id:crypto.randomUUID()};try{const value=await publishExistingHeadquartersPlan(input,attempt.current.id);setResult(value);setUncertain(false);}catch(cause){setError(cause instanceof Error?cause.message:'募集公開の結果を確認できませんでした。');setUncertain(true);}finally{setBusy(false);}}
 if(!canPublish)return <p className={styles.note}>募集公開は本部運営担当が行います。</p>;
 return <section className={`${styles.card} ${styles.publication}`} aria-label="募集公開">
  <h2>募集公開</h2>
  {!materialsOnly&&<div className={styles.field}><label>募集する開催<select value={eventId} disabled={busy||uncertain||!!result} onChange={event=>{setEventId(event.target.value);setResult(null);attempt.current=null;}}><option value="">開催を選んでください</option>{events?.map(event=><option value={event.id} key={event.id}>{event.title}（{event.schedule_mode==='arranged_after_application'?'申込後に日程相談':event.starts_at?new Date(event.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日時未設定'}）</option>)}</select></label></div>}
  {!result&&!materialsOnly&&<a className={styles.linkRow} href={toAcademyContextHref('/academy/classes/new',draft.headquarters_id,'manage')}>開催を作成する</a>}
  {materialsOnly&&<p className={styles.help}>レッスン教材のみのため、開催の登録は不要です。</p>}
  {!check&&!error&&!result&&<p role="status" className={styles.help}>公開条件を確認しています…</p>}
  {check&&!result&&<>{!ready&&check.reasons.length>0&&<ul className={styles.note}>{check.reasons.map(reason=><li key={reason}>{publicationReason(reason)}</li>)}</ul>}<div className={styles.actions}><button className={styles.btn} disabled={busy||uncertain} onClick={()=>setRefresh(value=>value+1)}>公開条件を再確認</button><button className={`${styles.btn} ${styles.orange}`} disabled={busy||!ready} onClick={()=>void publish()}>{busy?'公開処理中…':uncertain?'同じ公開処理の結果を確認':'募集を公開する'}</button></div><p className={styles.help}>{first?.consented&&first.phase==='prepared'?'募集の初公開に成功した時点から7日間無料が始まります。保存だけでは開始しません。':'既存の利用契約・無料期間は変更しません。'}</p>{check.reasons.includes('existing_public_contract_required')&&!first?.consented&&<a className={styles.linkRow} href={toAcademyContextHref('/academy/settings',draft.headquarters_id,'manage')}>利用契約の準備を確認する</a>}</>}
  {result&&<><p className={styles.note} role="status">募集を公開しました。</p><a className={styles.linkRow} href={result.public_path}>公開ページと申込フォームを確認する</a></>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </section>;
}
