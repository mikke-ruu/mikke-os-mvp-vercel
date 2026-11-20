'use client';

import {useEffect,useRef,useState} from 'react';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {listAcademy2Events,type Academy2EventSummary} from '@/lib/academy2/operations';
import {getPlanPublicationReadiness,getFirstPublicationState,publishExistingHeadquartersPlan,publicationReason,type FirstPublicationState,type PublicationReadiness,type PlanPublication,type PublicationInput} from '@/lib/academy2/plan-publication';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getSalesPage,saveSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {prepareSalesPageForPublication} from '@/lib/academy2/prepare-sales-page-publication';
import styles from './publication-flow.module.css';
import {PublicationChecklist} from './PublicationChecklist';
import {publicationFix,publicationSummary} from '@/lib/academy2/publication-navigation';
import {listSalesPlanCatalog,type SalesPlanPublicationState} from '@/lib/academy2/sales-plan-catalog';

export function SalesPlanPublicationPanel({draft,page,onPagePrepared,onPublished,disabled=false}:{draft:SalesPlanDraft;page:SalesPageDraft;onPagePrepared?:(page:SalesPageDraft)=>void;onPublished?:()=>void;disabled?:boolean}){
 const hq=useAcademy2Headquarters();
 const [events,setEvents]=useState<Academy2EventSummary[]|null>(null),[eventId,setEventId]=useState('');
 const [checkKey,setCheckKey]=useState('');
 const [check,setCheck]=useState<PublicationReadiness|null>(null),[result,setResult]=useState<PlanPublication|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const attempt=useRef<{key:string;id:string}|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const publishing=useRef(false);
 const [phase,setPhase]=useState<'saving'|'publishing'|null>(null);
 const [first,setFirst]=useState<FirstPublicationState|null>(null);
 const [publication,setPublication]=useState<SalesPlanPublicationState|null>(null);
 const [publicationError,setPublicationError]=useState('');
 useEffect(()=>{let live=true;setPublication(null);setPublicationError('');listSalesPlanCatalog(draft.headquarters_id).then(rows=>{const value=rows.find(row=>row.id===draft.id)?.publication;if(!value)throw new Error('公開状態を確認できませんでした。');if(live)setPublication(value);}).catch(()=>{if(live)setPublicationError('公開状態を確認できませんでした。');});return()=>{live=false;};},[draft.headquarters_id,draft.id,draft.revision,refresh]);
 const materialsOnly=draft.configuration.study_style==='materials_only';
 const deferredFeatures=!['ワークショップ','単品講座','コース'].includes(draft.configuration.kind)||Boolean(draft.configuration.after?.skill_certification||draft.configuration.after?.instructor_license||draft.configuration.after?.certificate?.kind==='certification');
 const canPublish=hq?.role==='administrator';
 useEffect(()=>{if(!canPublish)return;let live=true;getFirstPublicationState(draft.headquarters_id).then(value=>{if(live)setFirst(value);}).catch(()=>{if(live)setFirst(null);});return()=>{live=false;};},[canPublish,draft.headquarters_id,refresh]);
 useEffect(()=>{if(!canPublish)return;let current=true;setEvents(null);setError('');listAcademy2Events(draft.headquarters_id).then(rows=>{if(current)setEvents(rows.filter(row=>row.sales_plan_id===draft.id));}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,draft.headquarters_id,draft.id,refresh]);
 const selected=materialsOnly?undefined:events?.find(row=>row.id===eventId);
 const input:PublicationInput={headquartersId:draft.headquarters_id,planId:draft.id,planRevision:draft.revision,pageRevision:page.revision,eventId:selected?.id??null,eventRevision:selected?.revision??null};
 const key=JSON.stringify(input);
 useEffect(()=>{if(!canPublish||!events)return;let current=true;setCheck(null);setError('');getPlanPublicationReadiness(JSON.parse(key) as PublicationInput).then(value=>{if(current){setCheck(value);setCheckKey(key);}}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[canPublish,events,key,refresh]);
 const publicationKnown=!!publication&&['published','not_published','archived'].includes(publication.state);
 const ready=!deferredFeatures&&checkKey===key&&!!check&&(check.ready||(first?.consented===true&&first.phase==='prepared'&&check.reasons.every(reason=>reason==='existing_public_contract_required')));
 async function publish(){
  if(publishing.current||busy||uncertain||disabled||!ready||!publicationKnown||publicationError)return;
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
   const value=await publishExistingHeadquartersPlan(preparedInput,attempt.current.id);const savedPublication=(await listSalesPlanCatalog(draft.headquarters_id)).find(row=>row.id===draft.id)?.publication;
   if(!savedPublication||savedPublication.state!=='published'||savedPublication.plan_revision!==preparedInput.planRevision||savedPublication.page_revision!==preparedInput.pageRevision)throw new Error('公開結果を再確認できませんでした。再送せず、最新の状態を確認してください。');
   setPublication(savedPublication);setResult(value);setUncertain(false);onPublished?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'募集公開の結果を確認できませんでした。');if(publicationStarted)setUncertain(true);}
  finally{publishing.current=false;setBusy(false);setPhase(null);}
 }
 if(!canPublish)return <p className={styles.card}>公開は本部運営担当が行います。</p>;
 const tasks=check?.reasons.filter(reason=>!(reason==='existing_public_contract_required'&&first?.consented&&first.phase==='prepared')).map(reason=>{const fix=publicationFix(reason,draft.headquarters_id,draft.id,selected?.id);return reason==='event_required'&&!!events?.length&&!eventId?{key:reason,label:'上の一覧から募集する日程を選んでください。'}:{key:reason,label:publicationReason(reason),href:fix?.href,actionLabel:fix?.label};})??[];
 return <section id="publication-controls" className={styles.card} aria-label="販売ページを公開する">
  <h2>{result?'公開しました':'内容を確認したら公開しましょう'}</h2>
  <p className={styles.status}>{publicationSummary(publication).label}</p>
  {publicationError&&<p role="alert" className={styles.error}>{publicationError}</p>}
  {deferredFeatures&&<p role="alert">このプランには、現在公開できない種類や認定・講師の設定が含まれています。入力内容は保存されています。</p>}
  {!materialsOnly&&!result&&<><label>募集する日程<select value={eventId} disabled={busy||uncertain} onChange={event=>{setEventId(event.target.value);attempt.current=null;}}><option value="">登録済みの日程から選んでください</option>{events?.map(event=><option value={event.id} key={event.id}>{event.title}（{event.schedule_mode==='arranged_after_application'?'申込後に日程相談':event.starts_at?new Date(event.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日時未設定'}）</option>)}</select></label><div className={styles.actions}><a className={styles.button} href={toAcademyContextHref('/academy/classes/new',draft.headquarters_id,'manage')+'?plan='+encodeURIComponent(draft.id)}>{events?.length?'別の日程を追加する':'開催日程を登録する'}</a></div></>}
  {materialsOnly&&<p>教材のみの講座なので、開催日程の登録は不要です。</p>}
  {!check&&!error&&!result&&<p role="status">必要な設定を確認中…</p>}
  {check&&!result&&<><PublicationChecklist tasks={tasks}/>
   <p className={styles.small}>{first?.phase==='no_operating_fee'?'Academy運営利用料は当面かかりません。':first?.consented&&first.phase==='prepared'?'この契約では初回公開から7日間の無料期間が始まります。':'現在の利用契約は変更されません。'}</p>
   {disabled&&<p>ページの保存が終わるまでお待ちください。</p>}
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||uncertain||disabled||!ready||!publicationKnown||!!publicationError} onClick={()=>void publish()}>{busy?(phase==='saving'?'ページを保存・確認中…':'公開中…'):uncertain?'公開結果を確認してください':publication?.state==='published'?'この内容を公開ページに反映する':'この内容で公開する'}</button><button type="button" className={styles.button} disabled={busy||uncertain} onClick={()=>setRefresh(value=>value+1)}>設定状況を再確認する</button></div></>}
  {uncertain&&<p role="alert" className={styles.error}>結果を確認できないため、再実行を止めています。ページを開き直して公開状態を確認してください。</p>}
  {result&&<><p>申込ボタンや受付状況を、お客様に見えるページで確認してください。</p><a className={styles.primary} href={result.public_path}>公開ページ・申込入口を確認する</a><p className={styles.small}>本部ホームページへの掲載状況は、ホームページ編集から確認できます。</p></>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </section>;
}
