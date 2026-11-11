'use client';
import {useEffect,useState} from 'react';
import {getSalesPage} from '@/lib/academy2/sales-pages';
import {getSalesPagePublicationReadiness,getSalesPagePublicationStatus,publicationReason,type SalesPagePublicationReadiness} from '@/lib/academy2/plan-publication';
import {listSalesPlanCatalog,type SalesPlanPublicationState} from '@/lib/academy2/sales-plan-catalog';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {publicationFix,publicationSummary} from '@/lib/academy2/publication-navigation';
import {PublicationChecklist} from './PublicationChecklist';
import styles from './publication-flow.module.css';
export type PlanPublicationNoticeApi={readPage:typeof getSalesPage;listCatalog:typeof listSalesPlanCatalog;status:typeof getSalesPagePublicationStatus;readiness:typeof getSalesPagePublicationReadiness};
const defaultApi:PlanPublicationNoticeApi={readPage:getSalesPage,listCatalog:listSalesPlanCatalog,status:getSalesPagePublicationStatus,readiness:getSalesPagePublicationReadiness};
export function PlanPublicationNotice({headquartersId,planId,revision,disabled=false,api=defaultApi}:{headquartersId:string;planId:string;revision:number;disabled?:boolean;api?:PlanPublicationNoticeApi}){
 const [check,setCheck]=useState<SalesPagePublicationReadiness|null>(null),[publication,setPublication]=useState<SalesPlanPublicationState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setCheck(null);setPublication(null);setLoading(true);setError('');void(async()=>{try{const [page,rows,info]=await Promise.all([api.readPage(headquartersId,planId),api.listCatalog(headquartersId),api.status(headquartersId,planId)]);const old=rows.find(r=>r.id===planId)?.publication;const effective=info.state==='not_published'?old:{...info,state:info.state==='unpublished'?'archived' as const:'published' as const,offering_id:null};if(live)setPublication(effective??null);const result=await api.readiness({headquartersId,planId,planRevision:revision,pageRevision:page.revision});if(live)setCheck(result);}catch(cause){if(live)setError(cause instanceof Error?cause.message:'公開準備を確認できませんでした。');}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[headquartersId,planId,revision,retry,api]);
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 const tasks=check?.reasons.map(reason=>{const fix=publicationFix(reason,headquartersId,planId);return {key:reason,label:publicationReason(reason),href:fix?.href,actionLabel:fix?.label};})??[];
 return <section className={[styles.card,styles.preparation].join(" ")} aria-label="販売ページの準備"><h2>販売ページの準備</h2><span className={styles.status}>ページ：{loading?'確認中':publicationSummary(publication).label}</span>
 {disabled?<p>入力した変更を保存してください。</p>:loading?<p role="status">必要な設定を確認中…</p>:error?<div role="alert"><p>{error}</p><button className={styles.button} onClick={()=>setRetry(v=>v+1)}>再確認する</button></div>:check&&<><PublicationChecklist tasks={tasks}/>{check.ready&&<p>公開の準備が整いました。販売ページを確認して、公開へ進みましょう。</p>}{check.ready&&<div className={styles.actions}><a className={styles.primary} href={href('/academy/offerings/'+planId+'?preview=standard')}>販売ページを確認・編集・公開する</a></div>}</>}
 {publication?.state==='published'&&publication.public_path&&<a className={styles.button} href={publication.public_path}>公開ページを見る</a>}
 </section>;
}
