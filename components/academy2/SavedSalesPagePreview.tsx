'use client';
import {useEffect,useState} from 'react';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {getSalesPlanDraft,type SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {listAcademy2Courses,type Academy2Course} from '@/lib/academy2/courses';
import {listAcademy2Events,type Academy2EventSummary} from '@/lib/academy2/operations';
import {readSalesPageDisplay} from '@/lib/academy2/sales-page-display';
import {isStandardSalesPageV5} from '@/lib/academy2/standard-sales-page';
import {SalesPageBottom} from './SalesPageBottom';
import v5Styles from './standard-sales-page-v5.module.css';
import {SalesPlanPagePresentation} from './SalesPlanPagePresentation';
import {SalesPlanPageContent} from './SalesPageContent';
import {SalesPlanApplicationPreview} from './SalesPlanApplicationPreview';
/** Authenticated saved draft; anonymous routes still read published snapshots only. */
export function SavedSalesPagePreview({planId}:{planId:string}){
 const hq=useAcademy2Headquarters(),[state,setState]=useState<{hq:string;draft:SalesPlanDraft;page:SalesPageDraft;courses:Academy2Course[];events:Academy2EventSummary[]}|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[form,setForm]=useState(false);
 useEffect(()=>{if(!hq)return;let live=true;setState(null);async function read(){try{const [draft,page,courses,events]=await Promise.all([getSalesPlanDraft(hq!.id,planId),getSalesPage(hq!.id,planId),listAcademy2Courses(hq!.id),listAcademy2Events(hq!.id)]);if(draft.headquarters_id!==hq!.id||page.headquarters_id!==hq!.id||draft.id!==planId||page.plan_id!==planId||page.plan_revision!==draft.revision||page.needs_rebase||page.revision<1)throw Error('stale');if(live){setError('');setState({hq:hq!.id,draft,page,courses:courses.filter(c=>draft.configuration.course_ids.includes(c.id)),events:events.filter(e=>e.sales_plan_id===planId)});}}catch{if(live){setState(null);setError('保存済みのページを確認できませんでした。編集画面で保存状態を確認してください。');}}}void read();window.addEventListener('focus',read);return()=>{live=false;window.removeEventListener('focus',read);};},[hq?.id,planId,refresh]);
 const current=state?.hq===hq?.id?state:null;
 return <><aside style={{padding:16,background:'#edf6f1'}}>保存済みの販売ページです。一般公開前の変更も含みます。<button type="button" onClick={()=>window.close()}>編集画面へ戻る（このタブを閉じる）</button><button type="button" onClick={()=>setRefresh(v=>v+1)}>最新の保存内容を見る</button></aside>{error?<p role="alert">{error}</p>:current?isStandardSalesPageV5(current.page.blocks)?<div className={v5Styles.page}><SalesPlanPageContent offeringTitle={current.draft.configuration.title} blocks={current.page.blocks} courses={current.courses}/><SalesPageBottom draft={current.draft} events={current.events} display={readSalesPageDisplay(current.page.blocks)} v5 onFormPreview={()=>setForm(true)}/></div>:<SalesPlanPagePresentation draft={current.draft} blocks={current.page.blocks} courses={current.courses} events={current.events} onFormPreview={()=>setForm(true)}><SalesPlanPageContent offeringTitle={current.draft.configuration.title} blocks={current.page.blocks} courses={current.courses}/></SalesPlanPagePresentation>:<p role="status">ページを読み込んでいます…</p>}{form&&current&&<SalesPlanApplicationPreview headquartersId={current.hq} planId={current.draft.id} planRevision={current.draft.revision} configuration={current.draft.configuration} fields={current.draft.configuration.application_form?.fields??[]} onClose={()=>setForm(false)}/>}</>;
}
