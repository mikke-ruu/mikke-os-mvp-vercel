'use client';
import {useEffect,useRef,useState} from 'react';
import {defaultApplicationFields} from '@/lib/academy2/application-conditions.mjs';
import {getSalesPlanDraft,type SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {listAcademy2Courses,type Academy2Course} from '@/lib/academy2/courses';
import {getAcademy2Event,listAcademy2Events,type Academy2EventSummary,type Academy2EventDetail} from '@/lib/academy2/operations';
import {getHeadquartersFront,type HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {getCourseEditor,type CourseEditorDocument} from '@/lib/academy2/course-editor';
import {readSalesPageDisplay} from '@/lib/academy2/sales-page-display';
import {isStandardSalesPageV2,isStandardSalesPageV5} from '@/lib/academy2/standard-sales-page';
import {SalesPlanPageContent} from './SalesPageContent';
import {SalesPlanPagePresentation} from './SalesPlanPagePresentation';
import {HeadquartersHomepagePresentation} from './HeadquartersHomepagePresentation';
import {SalesPageBottom} from './SalesPageBottom';
import {SalesPlanApplicationPreview} from './SalesPlanApplicationPreview';
import {AcademyLessonContent} from '@/components/academy/AcademyLessonContent';
import styles from './SalesPlanDraftEditor.module.css';
import v5Styles from './standard-sales-page-v5.module.css';

type Props={kind:'sales'|'home'|'materials';headquartersId:string;plan?:SalesPlanDraft;courseId?:string;selectedEvent?:Academy2EventDetail;onClose:()=>void;editHref?:string};
/** Saved customer presentation only. Opening this dialog never saves or publishes. */
export function CreationCustomerPreview({kind,headquartersId,plan,courseId,selectedEvent,onClose,editHref}:Props){
 const panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[formPreview,setFormPreview]=useState(false);
 const [sales,setSales]=useState<{draft:SalesPlanDraft;page:SalesPageDraft;courses:Academy2Course[];events:Academy2EventSummary[]}|null>(null),[front,setFront]=useState<HeadquartersFront|null>(null),[course,setCourse]=useState<CourseEditorDocument|null>(null);
 useEffect(()=>{let live=true;setLoading(true);setError('');const run=async()=>{try{
  if(kind==='sales'){
   if(!plan||plan.headquarters_id!==headquartersId)throw new Error('保存済みの販売プランを確認してください。');
   const [draft,page,courses,events,currentEvent]=await Promise.all([getSalesPlanDraft(headquartersId,plan.id),getSalesPage(headquartersId,plan.id),listAcademy2Courses(headquartersId),listAcademy2Events(headquartersId),selectedEvent?getAcademy2Event(headquartersId,selectedEvent.id):Promise.resolve(null)]);
   if(draft.revision!==plan.revision)throw new Error('販売プランが更新されています。共通作成画面で保存済みの内容を確認してください。');
   if(selectedEvent&&(selectedEvent.headquarters_id!==headquartersId||selectedEvent.sales_plan_id!==draft.id||selectedEvent.plan_revision!==draft.revision))throw new Error('選択した開催と販売プランの保存版が一致しません。保存済みの内容を確認してください。');
   if(selectedEvent&&(!currentEvent||currentEvent.id!==selectedEvent.id||currentEvent.headquarters_id!==headquartersId||currentEvent.sales_plan_id!==draft.id||currentEvent.plan_revision!==draft.revision||currentEvent.revision!==selectedEvent.revision))throw new Error('開催が更新されています。共通作成画面で保存済みの内容を読み直してから確認してください。');
   if(!page.revision||!page.blocks.length)throw new Error('販売ページはまだ保存されていません。販売ページの編集画面で確認してください。この操作では自動保存しません。');
   if(page.needs_rebase||page.plan_revision!==draft.revision)throw new Error('販売ページと販売プランの保存版が一致しません。販売ページの編集画面で確認してください。');
   if(live)setSales({draft,page,courses:courses.filter(c=>draft.configuration.course_ids.includes(c.id)),events:events.filter(e=>e.sales_plan_id===draft.id)});
  }else if(kind==='home'){const saved=await getHeadquartersFront(headquartersId);if(live)setFront(saved);}
  else{if(!courseId)throw new Error('講座を選択してください。');const saved=await getCourseEditor(headquartersId,courseId);if(live)setCourse(saved);}
 }catch(cause){if(live)setError(cause instanceof Error?cause.message:'保存済みの内容を取得できませんでした。');}finally{if(live)setLoading(false);}};void run();return()=>{live=false;};},[kind,headquartersId,plan?.id,plan?.revision,courseId,retry,selectedEvent?.id,selectedEvent?.revision]);
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 const label={sales:'販売ページ',home:'本部ホームページ',materials:'教材'}[kind];
 let safeEdit:string|undefined;
 if(editHref?.startsWith('/')){try{const url=new URL(editHref,'https://academy.invalid');if(url.origin==='https://academy.invalid'&&url.pathname.startsWith(`/academy/h/${headquartersId}/manage/`))safeEdit=url.pathname+url.search+url.hash;}catch{/* Untrusted return targets never navigate. */}}
 function keyboard(event:React.KeyboardEvent){if(formPreview)return;if(event.key==='Escape'){event.preventDefault();onClose();}if(event.key!=='Tab')return;const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 return <div className={`${styles['form-overlay']} ${styles.on}`} onKeyDown={keyboard} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={panel} className={styles['form-modal']} style={{width:'min(1100px,calc(100vw - 24px))'}} role="dialog" aria-modal="true" aria-labelledby="creation-preview-title">
  <div className={styles['form-modal-head']}><strong id="creation-preview-title">{label}のプレビュー</strong><div>{safeEdit&&<a href={safeEdit}>編集する</a>}<button ref={close} type="button" onClick={onClose} aria-label="プレビューを閉じる">×</button></div></div>
  <div style={{padding:kind==='home'?0:16}}><p style={kind==='home'?{padding:16}:undefined}>保存済みの内容を表示しています。この確認操作では保存・公開しません。</p>{loading?<p role="status">読み込み中…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>:<>
   {sales&&kind==='sales'&&(isStandardSalesPageV5(sales.page.blocks)?<div className={isStandardSalesPageV5(sales.page.blocks)?v5Styles.page:undefined}><SalesPlanPageContent blocks={sales.page.blocks} courses={sales.courses} previewHq={headquartersId}/><SalesPageBottom previewEvent={selectedEvent} draft={sales.draft} events={sales.events} display={readSalesPageDisplay(sales.page.blocks)} standard={isStandardSalesPageV2(sales.page.blocks)} v5={isStandardSalesPageV5(sales.page.blocks)} onFormPreview={()=>setFormPreview(true)}/></div>:<SalesPlanPagePresentation draft={sales.draft} blocks={sales.page.blocks} courses={sales.courses} events={sales.events} onFormPreview={()=>setFormPreview(true)}><SalesPlanPageContent offeringTitle={sales.draft.configuration.title} blocks={sales.page.blocks} courses={sales.courses}/></SalesPlanPagePresentation>)}
   {front&&kind==='home'&&<div onClickCapture={event=>{if(event.target instanceof Element&&event.target.closest('a'))event.preventDefault();}}><HeadquartersHomepagePresentation front={front}/></div>}
   {course&&kind==='materials'&&<section style={{maxWidth:768,margin:'0 auto'}}><h2>{course.course.name}</h2>{course.materials.blocks.length?<AcademyLessonContent blocks={course.materials.blocks}/>:<p>教材の本文はまだ登録されていません。</p>}<p>保存済み教材の管理者プレビューです。受講者が閲覧できる時期は申込・入金・教材公開条件に従います。</p></section>}
  </>}</div>
  {formPreview&&sales&&<SalesPlanApplicationPreview headquartersId={headquartersId} planId={sales.draft.id} planRevision={sales.draft.revision} configuration={sales.draft.configuration} fields={sales.draft.configuration.application_form?.fields??defaultApplicationFields} selectedEvent={selectedEvent} onClose={()=>setFormPreview(false)}/>}
 </div></div>;
}
