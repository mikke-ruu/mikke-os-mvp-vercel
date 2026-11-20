'use client';
import {useEffect,useRef,useState} from 'react';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import type {Academy2Course} from '@/lib/academy2/courses';
import type {Academy2EventSummary} from '@/lib/academy2/operations';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import {SalesPlanPageContent} from './SalesPageContent';
import {SalesPlanPagePresentation} from './SalesPlanPagePresentation';
import {SalesPlanApplicationPreview} from './SalesPlanApplicationPreview';
import styles from './sales-page-preview-dialog.module.css';
export function SalesPagePreviewDialog({draft,blocks,courses,events,eventsError,dirty,localReview,onClose}:{draft:SalesPlanDraft;blocks:LpBlock[];courses:Academy2Course[];events:Academy2EventSummary[]|null;eventsError?:string;dirty:boolean;localReview?:boolean;onClose:()=>void}){
 const [form,setForm]=useState(false),[mobile,setMobile]=useState(false),panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};},[]);
 useEffect(()=>{if(!form)close.current?.focus();},[form]);
 const keyboard=(e:React.KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key!=='Tab')return;const fields=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]),first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
 if(form)return <SalesPlanApplicationPreview localReview={localReview} headquartersId={draft.headquarters_id} planId={draft.id} planRevision={draft.revision} configuration={draft.configuration} fields={draft.configuration.application_form?.fields??[]} onClose={()=>setForm(false)}/>;
 return <div className={styles.overlay} onKeyDown={keyboard} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={panel} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sales-preview-title"><header className={styles.header}><div><h2 id="sales-preview-title">販売ページのプレビュー</h2><p>{dirty?'編集中の内容です。まだ保存されていません。':'保存済みの内容です。公開中の内容とは異なる場合があります。'}</p></div><div><button type="button" aria-pressed={!mobile} onClick={()=>setMobile(false)}>PC</button><button type="button" aria-pressed={mobile} onClick={()=>setMobile(true)}>スマホ</button><button ref={close} type="button" onClick={onClose}>編集に戻る</button></div></header><div className={styles.body}><div className={styles.page} data-mobile={mobile}><SalesPlanPagePresentation draft={draft} blocks={blocks} courses={courses} events={events} eventsError={eventsError} localReview={localReview} onFormPreview={()=>setForm(true)}><SalesPlanPageContent offeringTitle={draft.configuration.title} blocks={blocks} courses={courses}/></SalesPlanPagePresentation></div></div></div></div>;
}
