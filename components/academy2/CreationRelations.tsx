'use client';
import {useEffect,useState} from 'react';
import {listSalesPlanCatalog,type SalesPlanCatalogItem} from '@/lib/academy2/sales-plan-catalog';
import {getSalesPlanDraft,type SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {listAcademy2Events,getAcademy2EventRegistrationSource,type Academy2EventSummary} from '@/lib/academy2/operations';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import flow from './publication-flow.module.css';
import {getSalesPagePublicationStatus} from '@/lib/academy2/plan-publication';

export type CreationRelationsData={plans:SalesPlanDraft[];publications:Record<string,SalesPlanCatalogItem['publication']|undefined>;accepting:Record<string,boolean|null>;events?:Academy2EventSummary[]};
/** Explicit snapshot injection keeps the local review completely off real RPCs. */
export type CreationRelationsProps={compact?:boolean;headquartersId:string;courseId?:string;planId?:string;showEvents?:boolean;expectedPlanRevision?:number|null;data?:CreationRelationsData;onOpenPlan?:(planId:string)=>void;onOpenEvent?:(eventId:string)=>void};
/** Relationship links always lead to the plan, not directly into publication. */
export function CreationRelations({headquartersId,courseId,planId,showEvents=false,expectedPlanRevision,compact=false,data,onOpenPlan,onOpenEvent}:CreationRelationsProps){
 const [plans,setPlans]=useState<SalesPlanDraft[]>([]),[catalog,setCatalog]=useState<SalesPlanCatalogItem[]>([]),[events,setEvents]=useState<Academy2EventSummary[]>([]),[accepting,setAccepting]=useState<Record<string,boolean|null>>({}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');setPlans([]);setAccepting({});
  if(data){const scoped=data.plans.filter(p=>p.headquarters_id===headquartersId&&(!planId||p.id===planId)&&(!courseId||p.configuration.course_ids.includes(courseId)));setPlans(scoped);setCatalog(scoped.filter(p=>data.publications[p.id]).map(p=>({...p,publication:data.publications[p.id]!})));setEvents((data.events??[]).filter(e=>e.headquarters_id===headquartersId&&(!planId||e.sales_plan_id===planId)));setAccepting(data.accepting);setLoading(false);return()=>{live=false;};}
  void(async()=>{try{
   if(expectedPlanRevision===null)throw new Error('開催が参照する販売プランの保存版を確認できません。');
   const [rows,dates]=await Promise.all([planId?Promise.all([getSalesPlanDraft(headquartersId,planId)]):listSalesPlanCatalog(headquartersId),listAcademy2Events(headquartersId)]);
   if(expectedPlanRevision!=null&&rows[0]?.revision!==expectedPlanRevision)throw new Error('開催とプランの保存版が異なります。公開済みの内容は保持しています。');
   const related=courseId?rows.filter(p=>p.configuration.course_ids.includes(courseId)):rows;
   const states:Record<string,boolean|null>={};
   const infos=await Promise.allSettled(related.map(p=>getSalesPagePublicationStatus(headquartersId,p.id)));
   const catalogRows=(rows as SalesPlanDraft[]).filter((r):r is SalesPlanCatalogItem=>'publication' in r).map(row=>{const i=related.findIndex(p=>p.id===row.id),info=infos[i];return info?.status==='fulfilled'&&info.value.state!=='not_published'?{...row,publication:{...info.value,state:info.value.state==='unpublished'?'archived' as const:'published' as const,offering_id:null}}:row;});
   await Promise.all(related.map(async plan=>{const relatedDates=dates.filter(e=>e.sales_plan_id===plan.id&&e.registration_status==='open'&&['planned','active'].includes(e.status)&&(e.schedule_mode==='arranged_after_application'||!!e.starts_at&&new Date(e.ends_at??e.starts_at).getTime()>Date.now()));if(!relatedDates.length){states[plan.id]=plan.configuration.study_style==='materials_only'?null:false;return;}
    const values=await Promise.allSettled(relatedDates.map(e=>getAcademy2EventRegistrationSource(headquartersId,e.id)));
    states[plan.id]=values.some(v=>v.status==='fulfilled'&&v.value.ready&&!!v.value.offering_id)?true:values.some(v=>v.status==='rejected')?null:false;
   }));
   if(live){setPlans(related);setCatalog(catalogRows);setEvents(dates.filter(e=>!planId||e.sales_plan_id===planId));setAccepting(states);}
  }catch(cause){if(live)setError(cause instanceof Error?cause.message:'関連情報を取得できませんでした。');}finally{if(live)setLoading(false);}})();return()=>{live=false;};
 },[headquartersId,courseId,planId,showEvents,expectedPlanRevision,retry,data]);
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 const content=loading?<p role="status">確認中…</p>:error?<p role="alert">{error}<button className={flow.button} onClick={()=>setRetry(v=>v+1)}>再取得する</button></p>:null;
 if(planId&&showEvents)return <details className={flow.compact}><summary>このプランの開催日程　{loading?'確認中':events.length+'件'}</summary>{content??(events.length?<ul className={flow.list}>{events.map(e=><li key={e.id}><div className={flow.planLine}><strong>{e.title}</strong><p>{e.starts_at?new Date(e.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'申込後に日程相談'}　{e.status==='completed'?'開催終了':e.status==='cancelled'?'中止':e.registration_status==='open'?'受付条件を確認':'受付前'}</p></div>{onOpenEvent?<button type="button" className={flow.button} onClick={()=>onOpenEvent(e.id)}>詳細へ</button>:<a className={flow.button} href={href('/academy/classes/'+e.id)}>詳細へ</a>}</li>)}</ul>:<p>開催日程はまだありません。</p>)}</details>;
 return <details className={flow.compact} open={!compact||undefined}><summary>この講座を含む販売プラン　{loading?'確認中':plans.length+'件'}</summary>{content??(plans.length?<ul className={flow.list}>{plans.map(plan=>{const publication=catalog.find(r=>r.id===plan.id)?.publication;return <li key={plan.id}><div className={flow.planLine}><strong>{plan.configuration.title||'名称未設定'}</strong><div className={flow.badges}><span className={flow.status}>ページ：{!publication||['unknown','unavailable'].includes(publication.state)?'確認できません':publication.state==='published'?'公開中':publication.state==='archived'?'非公開':'未公開'}</span><span className={flow.status}>申込：{accepting[plan.id]==null?'確認できません':accepting[plan.id]?'受付中':'受付前'}</span></div></div>{onOpenPlan?<button type="button" className={flow.button} onClick={()=>onOpenPlan(plan.id)}>詳細へ</button>:<a className={flow.button} href={href('/academy/offerings/'+plan.id)}>詳細へ</a>}</li>;})}</ul>:<p>この講座の販売プランはまだありません。</p>)}</details>;
}
