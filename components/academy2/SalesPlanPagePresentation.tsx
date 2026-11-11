'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import type {Academy2Course} from '@/lib/academy2/courses';
import {getHeadquartersFront,type HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {getSellerProfile,type SellerDocument} from '@/lib/academy2/seller-disclosure';
import {getHeadquartersSettings,type HeadquartersSettings} from '@/lib/academy2/headquarters-settings';
import {getCourseIntroductionPreview} from '@/lib/academy2/course-introduction';
import {getAcademy2Event,type Academy2EventSummary} from '@/lib/academy2/operations';
import {readEventMaterials} from '@/lib/academy2/material-fulfillment';
import {FixedPageRegion} from './EditorPageRegion';
import {CoursePagePresentation} from './CoursePagePresentation';
import {PublicSiteFooter} from './PublicSiteFrame';
import {readFrontDocument} from '@/lib/academy/front-design';
import type {CoursePublicEvent} from './PublicCourseFacts';
import styles from './public-course-page.module.css';
type PreviewCourse=Academy2Course&{physical_items?:{enabled:boolean;name:string;contents:string}|null};
/** Authenticated draft projection only. Never used to grant anonymous access. */
export function SalesPlanPagePresentation({draft,blocks,courses,events,eventsError,children,onFormPreview,localReview=false,editing=false}:{editing?:boolean;draft:SalesPlanDraft;blocks:LpBlock[];courses:Academy2Course[];events:Academy2EventSummary[]|null;eventsError?:string;children:ReactNode;onFormPreview:()=>void;localReview?:boolean}){
 const [state,setState]=useState<{hq:string;front:HeadquartersFront|null;seller:SellerDocument|null;documents:HeadquartersSettings['documents'];courses:PreviewCourse[];failed:boolean}|null>(null);
 const [dates,setDates]=useState<{key:string;events:CoursePublicEvent[];failed:boolean}|null>(null),[document,setDocument]=useState<string|null>(null);

 const policyPanel=useRef<HTMLElement>(null),policyTrigger=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(document){policyPanel.current?.scrollIntoView({block:'center'});policyPanel.current?.focus({preventScroll:true});}},[document]);
 const showPolicy=(kind:string,trigger:HTMLElement)=>{policyTrigger.current=trigger;setDocument(kind);};
 const ids=draft.configuration.course_ids,courseKey=ids.join(','),eventKey=JSON.stringify(events?.map(e=>[e.id,e.revision]));
 useEffect(()=>{let live=true;setState(null);if(localReview)return;async function load(){const results=await Promise.allSettled([getHeadquartersFront(draft.headquarters_id),getSellerProfile(draft.headquarters_id),getHeadquartersSettings(draft.headquarters_id),Promise.all(ids.map(id=>getCourseIntroductionPreview(draft.headquarters_id,id)))] as const);if(!live)return;const [front,seller,settings,introductions]=results;setState({hq:draft.headquarters_id,front:front.status==='fulfilled'?front.value:null,seller:seller.status==='fulfilled'?seller.value.document:null,documents:settings.status==='fulfilled'?settings.value.documents:[],courses:courses.map(course=>({...course,physical_items:introductions.status==='fulfilled'?introductions.value.find(c=>c?.id===course.id)?.physical_items:null})),failed:results.some(r=>r.status==='rejected')});}void load();return()=>{live=false;};},[draft.headquarters_id,courseKey,localReview]);
 useEffect(()=>{let live=true;setDates(null);if(localReview||!events)return;Promise.all(events.filter(e=>e.registration_status==='open').map(async summary=>{const e=await getAcademy2Event(draft.headquarters_id,summary.id);if(e.headquarters_id!==draft.headquarters_id||e.sales_plan_id!==draft.id||e.revision!==summary.revision)throw Error('event_changed');let kitMethod=e.kit_method;if(e.kit_settings.contract_version===2){const m=await readEventMaterials(draft.headquarters_id,e.id);if(!m)throw Error('materials_unavailable');kitMethod=m.method==='learner_shipping'?'shipping':'venue_handover';}return {id:e.id,title:e.title,startsAt:e.starts_at,endsAt:e.ends_at,scheduleMode:e.schedule_mode,format:e.format,kitMethod,formReady:e.registration_status==='open'};})).then(rows=>{if(live)setDates({key:eventKey,events:rows,failed:false});}).catch(()=>{if(live)setDates({key:eventKey,events:[],failed:true});});return()=>{live=false;};},[draft.headquarters_id,draft.id,eventKey,localReview]);
 const current=state?.hq===draft.headquarters_id?state:null,front=current?.front,seller=current?.seller;
 const shownDates=dates&&dates.key===eventKey?dates.events:[];
 const legalBody=document==='about'?[front?.name,front?.tagline,front?.front_message,front?.contact_email].filter(Boolean).join('\n\n'):document==='terms'?draft.configuration.terms?.body:current?.documents.find(d=>d.kind===(document==='privacy'?'privacy':document==='cancellation'?'cancellation':document==='commerce'?'commerce':'application'))?.body;
 return <div className={styles.surface} onClickCapture={e=>{const a=e.target instanceof Element?e.target.closest('a'):null;if(a){e.preventDefault();if(a.getAttribute('href')?.startsWith('#preview-legal'))showPolicy(a.hash.split('#').at(-1)||'terms',a);}}}>
 {front&&<header className={styles.siteBar}>{readFrontDocument(front.front_blocks).design.visibility?.name!==false&&<span>{front.name}</span>}<span>ホームへ戻る（プレビュー）</span></header>}
 {!localReview&&!current&&<p role="status">本部情報を読み込んでいます…</p>}{current?.failed&&<p role="alert">一部の保存情報を読み込めませんでした。表示内容を確かめるには、ページを開き直してください。</p>}
 {(eventsError||dates?.failed)&&<p role="alert">開催日程の表示を確認できませんでした。</p>}
 <CoursePagePresentation decorateFixed={editing?(title,content)=><FixedPageRegion title={title} note="保存した設定から自動表示">{content}</FixedPageRegion>:undefined} title={draft.configuration.title} blocks={blocks} price={draft.sale_price_snapshot.price} staged={draft.sale_price_snapshot.purchase_mode==='staged'} configuration={draft.configuration} methods={draft.configuration.payment_methods??[]} events={shownDates} courses={current?.courses??courses} fees={seller?.additional_fees} deadline={seller?.payment_deadline} legalHref="#preview-legal" accepting={false} preview application={<button type="button" onClick={onFormPreview}>この講座に申し込む（プレビュー）</button>}>{children}</CoursePagePresentation>
 {document&&<section ref={policyPanel} tabIndex={-1} className={styles.page} role="region" aria-label="規約のプレビュー"><button type="button" onClick={()=>{setDocument(null);policyTrigger.current?.focus();}}>規約を閉じる</button><h2>{document==='about'?'本部について':'規約のプレビュー'}</h2><p style={{whiteSpace:'pre-wrap'}}>{legalBody||'この規約の保存内容を確認できませんでした。本部設定で確認してください。'}</p></section>}
 {front&&<div onClickCapture={e=>{if(e.target instanceof Element&&e.target.closest('a')?.getAttribute('href')?.includes('/information#')){e.preventDefault();const hash=e.target.closest('a')!.hash.slice(1);showPolicy(hash==='application'?'terms':hash,e.target.closest('a')!);}}}><PublicSiteFooter front={front}/></div>}
 </div>;
}
