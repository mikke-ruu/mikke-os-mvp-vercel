'use client';
import {useEffect,useRef,useState} from 'react';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {getSalesPage,saveSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {getSalesPagePublicationReadiness,publishSalesPage,unpublishSalesPage,getSalesPagePublicationStatus,publicationReason,type SalesPagePublicationReadiness,type SalesPagePublicationStatus} from '@/lib/academy2/plan-publication';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {prepareSalesPageForPublication} from '@/lib/academy2/prepare-sales-page-publication';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {publicationFix} from '@/lib/academy2/publication-navigation';
import {PublicationChecklist} from './PublicationChecklist';
import styles from './publication-flow.module.css';
import {EventFirstIntake} from './EventFirstIntake';
export const informationPageApi={readiness:getSalesPagePublicationReadiness,publish:publishSalesPage,hide:unpublishSalesPage,status:getSalesPagePublicationStatus,readPage:getSalesPage,savePage:saveSalesPage};
export type InformationPageApi=typeof informationPageApi;
type Props={draft:SalesPlanDraft;page:SalesPageDraft;disabled?:boolean;onPagePrepared?:(page:SalesPageDraft)=>void;onPublished?:()=>void;onPreview?:()=>void;onAddEvent?:()=>void};
export function SalesPlanPublicationPanel(props:Props){const hq=useAcademy2Headquarters();return <SalesPagePublicationControls {...props} canPublish={hq?.role==='administrator'}/>;}
/** Publication changes the information page only. This control never starts intake. */
export function SalesPagePublicationControls({draft,page,disabled=false,onPagePrepared,onPublished,onPreview,onAddEvent,canPublish,api=informationPageApi}:Props&{canPublish:boolean;api?:InformationPageApi}){
 const [check,setCheck]=useState<SalesPagePublicationReadiness|null>(null),[status,setStatus]=useState<SalesPagePublicationStatus|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[refresh,setRefresh]=useState(0),[message,setMessage]=useState('');
 const flight=useRef(false),attempt=useRef<{id:string;signature:string}|null>(null);
 const input={headquartersId:draft.headquarters_id,planId:draft.id,planRevision:draft.revision,pageRevision:page.revision};const key=JSON.stringify(input);
 useEffect(()=>{let live=true;setCheck(null);setStatus(null);setError('');Promise.all([api.readiness(JSON.parse(key)),api.status(draft.headquarters_id,draft.id)]).then(([ready,current])=>{if(live){setCheck(ready);setStatus(current);}}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'公開状態を確認できませんでした。');});return()=>{live=false;};},[key,api,refresh,draft.headquarters_id,draft.id]);
 async function act(visible:boolean){if(flight.current||busy||uncertain||disabled||!canPublish||!status||(visible&&!check?.ready))return;
  if(!visible&&!window.confirm('ページを非公開にします。既存の申込・受講記録は残ります。よろしいですか？'))return;
  flight.current=true;setBusy(true);setError('');setMessage('');let sent=false;
  try{const prepared=visible?await prepareSalesPageForPublication({page,planRevision:draft.revision,read:()=>api.readPage(draft.headquarters_id,draft.id),save:blocks=>api.savePage(draft.headquarters_id,draft.id,0,draft.revision,blocks)}):page;
   onPagePrepared?.(prepared);const preparedInput={...input,pageRevision:prepared.revision};if(visible){const ready=await api.readiness(preparedInput);if(!ready.ready){setCheck(ready);throw new Error('公開前の設定を確認してください。');}}
   const signature=JSON.stringify({preparedInput,visible});if(attempt.current?.signature!==signature)attempt.current={id:crypto.randomUUID(),signature};sent=true;
   const result=await (visible?api.publish:api.hide)(preparedInput,attempt.current.id);
   const verified=await api.status(draft.headquarters_id,draft.id);
   if(verified.state!==(visible?'published':'unpublished')||verified.plan_revision!==result.plan_revision||verified.page_revision!==result.page_revision)throw new Error('公開結果を照合できませんでした。再送せず状態を確認してください。');
   setStatus(verified);setMessage(visible?'販売ページを公開しました。申込受付の状態は変更していません。':'ページを非公開にしました。');attempt.current=null;onPublished?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'結果を確認できませんでした。');if(sent)setUncertain(true);}finally{setBusy(false);flight.current=false;}
 }
 const href=(path:string)=>toAcademyContextHref(path,draft.headquarters_id,'manage');
 const tasks=check?.reasons.map(reason=>{const fix=publicationFix(reason,draft.headquarters_id,draft.id);return {key:reason,label:publicationReason(reason),href:fix?.href,actionLabel:fix?.label};})??[];
 return <section id="publication-controls" className={[styles.card,styles.preparation].join(" ")} aria-label="販売ページの公開操作"><h2>販売ページを確認して公開</h2><p className={styles.status}>ページ：{!status?'確認中':status.state==='published'?'公開中'+(status.has_unpublished_changes?'・変更未反映':''):status.state==='unpublished'?'非公開':'未公開'}</p>
 {!canPublish&&<p>公開操作は本部運営担当が行います。</p>}{disabled&&<p>変更を保存してから公開してください。</p>}{check&&tasks.length>0&&<PublicationChecklist tasks={tasks}/>}
 <div className={styles.actions}>{onPreview&&<button className={styles.button} type="button" disabled={busy} onClick={onPreview}>お客様に見えるページを開く</button>}<button className={styles.primary} type="button" disabled={!canPublish||busy||uncertain||disabled||!check?.ready||!status} onClick={()=>void act(true)}>{busy?'反映を確認中…':status?.state==='published'?'変更を反映':'販売ページを公開する'}</button>{status?.state==='published'&&<button type="button" className={styles.button} disabled={!canPublish||busy||uncertain||disabled} onClick={()=>void act(false)}>非公開にする</button>}{error&&<button type="button" className={styles.button} disabled={busy} onClick={()=>setRefresh(v=>v+1)}>状態を再確認</button>}</div>
 {status?.state==='published'&&status.public_path&&<><p className="text-sm">公開中の内容です。保存しただけでは、このページは変わりません。</p><div className={styles.actions}><a target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center text-sm underline" href={status.public_path}>現在公開中のページを開く ↗</a>{draft.configuration.study_style!=='materials_only'&&(onAddEvent?<button type="button" className={styles.primary} disabled={disabled||busy||uncertain} onClick={onAddEvent}>このプランの開催日程を追加する</button>:<a className={styles.primary} href={href('/academy/create?plan='+draft.id+'&tab=event')}>このプランの開催日程を追加する</a>)}</div></>}
 {canPublish&&status?.state==='published'&&draft.configuration.study_style==='materials_only'&&api===informationPageApi&&<EventFirstIntake headquartersId={draft.headquarters_id} planId={draft.id} locked={busy||disabled||uncertain} onReload={()=>setRefresh(v=>v+1)} onBusyChange={setBusy}/>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{uncertain&&<p role="alert">結果が不明なため、再実行を停止しています。公開状態と保存履歴の照合が必要です。</p>}
 </section>;
}
