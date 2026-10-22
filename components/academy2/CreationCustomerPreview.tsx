'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarCheck,ClipboardPen,GraduationCap,Search} from 'lucide-react';
import {defaultApplicationFields} from '@/lib/academy2/application-conditions.mjs';
import {getSalesPlanDraft,type SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getSalesPage,type SalesPageDraft} from '@/lib/academy2/sales-pages';
import {listAcademy2Courses,type Academy2Course} from '@/lib/academy2/courses';
import {getAcademy2Event,listAcademy2Events,type Academy2EventSummary,type Academy2EventDetail} from '@/lib/academy2/operations';
import {getHeadquartersFront,type HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {getCourseEditor,type CourseEditorDocument} from '@/lib/academy2/course-editor';
import {readFrontDocument,frontMaxWidth} from '@/lib/academy/front-design';
import {readSalesPageDisplay} from '@/lib/academy2/sales-page-display';
import {isStandardSalesPageV2,isStandardSalesPageV5} from '@/lib/academy2/standard-sales-page';
import {SalesPlanPageContent} from './SalesPlanPageEditor';
import {SalesPageBottom} from './SalesPageBottom';
import {SalesPlanApplicationPreview} from './SalesPlanApplicationPreview';
import {AcademyFrontHero} from '@/components/academy/AcademyFrontHero';
import {AcademyPublicServices} from '@/components/academy/AcademyPublicServices';
import {PageBlocks} from '@/components/academy/PageBlocks';
import {AcademyLessonContent} from '@/components/academy/AcademyLessonContent';
import styles from './SalesPlanDraftEditor.module.css';
import v5Styles from './standard-sales-page-v5.module.css';

const homepagePreviewSteps = [
  { icon: Search, no: "01", title: "講座を選ぶ", desc: "学びたい講座を見つけます" },
  { icon: ClipboardPen, no: "02", title: "申し込む", desc: "フォームからお申込み" },
  { icon: CalendarCheck, no: "03", title: "受講する", desc: "当日を楽しみにお越しください" },
  { icon: GraduationCap, no: "04", title: "受講後のご案内", desc: "受講後の流れは各講座の案内をご確認ください" }
];

type Props={kind:'sales'|'home'|'materials';headquartersId:string;plan?:SalesPlanDraft;courseId?:string;selectedEvent?:Academy2EventDetail;onClose:()=>void;editHref?:string};
/** Saved customer presentation only. Opening this dialog never saves or publishes. */
export function CreationCustomerPreview({kind,headquartersId,plan,courseId,selectedEvent,onClose,editHref}:Props){
 const panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const [serviceAvailability,setServiceAvailability]=useState<{headquartersId:string;available:boolean}|null>(null);
 const onServicesAvailability=useCallback((headquartersId:string,available:boolean)=>setServiceAvailability({headquartersId,available}),[]);
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
 const design=front?readFrontDocument(front.front_blocks):null;
 const canApply=!!front&&serviceAvailability?.headquartersId===front.id&&serviceAvailability.available;
 function keyboard(event:React.KeyboardEvent){if(formPreview)return;if(event.key==='Escape'){event.preventDefault();onClose();}if(event.key!=='Tab')return;const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 return <div className={`${styles['form-overlay']} ${styles.on}`} onKeyDown={keyboard} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={panel} className={styles['form-modal']} style={{width:'min(1100px,calc(100vw - 24px))'}} role="dialog" aria-modal="true" aria-labelledby="creation-preview-title">
  <div className={styles['form-modal-head']}><strong id="creation-preview-title">{label}のプレビュー</strong><div>{safeEdit&&<a href={safeEdit}>編集する</a>}<button ref={close} type="button" onClick={onClose} aria-label="プレビューを閉じる">×</button></div></div>
  <div style={{padding:kind==='home'?0:16}}><p style={kind==='home'?{padding:16}:undefined}>保存済みの内容を表示しています。この確認操作では保存・公開しません。</p>{loading?<p role="status">読み込み中…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>:<>
   {sales&&kind==='sales'&&<div className={isStandardSalesPageV5(sales.page.blocks)?v5Styles.page:undefined}><SalesPlanPageContent blocks={sales.page.blocks} courses={sales.courses} previewHq={headquartersId}/><SalesPageBottom previewEvent={selectedEvent} draft={sales.draft} events={sales.events} display={readSalesPageDisplay(sales.page.blocks)} standard={isStandardSalesPageV2(sales.page.blocks)} v5={isStandardSalesPageV5(sales.page.blocks)} onFormPreview={()=>setFormPreview(true)}/></div>}
   {front&&design&&kind==='home'&&<main className="min-h-screen bg-white"><div>
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 backdrop-blur">
        <div style={{ maxWidth: frontMaxWidth(design.design, 1024) }} className="mx-auto flex  items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-base font-bold leading-none text-[var(--mikke-accent)]">{front.name}</p>
            <p className="mt-0.5 text-[9px] font-bold tracking-[0.3em] text-[var(--mikke-muted-light)]">Academy</p>
          </div>
          {canApply ? <a
            href="#services"
            className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            講座に申し込む
          </a> : null}
        </div>
      </header>

      <AcademyFrontHero design={design.design} title={front.tagline || "わたしらしい学びで、誰かの未来を照らす。"} message={front.front_message || `${front.name}の講座やワークショップをご紹介します。`} imageUrl={front.hero_image_url || ""} applicationHref={canApply ? "#services" : null} coursesHref={null} />

      {/* Wave F (AC-F3): フロントの自由ブロック（ヒーローと講座一覧の間） */}
      {design.blocks.length ? (
        <section className="border-t border-[var(--mikke-line)] px-5 py-12 md:py-16">
          <div style={{ maxWidth: frontMaxWidth(design.design, 768) }} className="mx-auto ">
            <PageBlocks blocks={design.blocks} />
          </div>
        </section>
      ) : null}

      <div style={{ maxWidth: frontMaxWidth(design.design, 1024) }} className="mx-auto px-5"><AcademyPublicServices key={front.id} headquartersId={front.id} hideWhenEmpty onAvailabilityChange={onServicesAvailability} /></div>

      {/* 申込から受講後まで */}
      <section className="px-5 py-12 md:py-16">
        <div style={{ maxWidth: frontMaxWidth(design.design, 896) }} className="mx-auto ">
          <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">申込から受講後まで</h2>
          <ol className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {homepagePreviewSteps.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.no} className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
                    <Icon size={22} />
                  </span>
                  <p className="mt-2 text-[10px] font-bold tracking-[0.25em] text-[var(--mikke-accent-strong)]">STEP {s.no}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--mikke-text)]">{s.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{s.desc}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <footer className="border-t border-[var(--mikke-line)] px-5 py-10 text-center">
        <p className="text-sm font-bold text-[var(--mikke-accent)]">{front.name}</p>
        {front.contact_email ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">お問い合わせ: {front.contact_email}</p> : null}
        <p className="mt-3 text-[10px] tracking-widest text-[var(--mikke-muted-light)]">POWERED BY Academy</p>
      </footer>
</div></main>}
   {course&&kind==='materials'&&<section style={{maxWidth:768,margin:'0 auto'}}><h2>{course.course.name}</h2>{course.materials.blocks.length?<AcademyLessonContent blocks={course.materials.blocks}/>:<p>教材の本文はまだ登録されていません。</p>}<p>保存済み教材の管理者プレビューです。受講者が閲覧できる時期は申込・入金・教材公開条件に従います。</p></section>}
  </>}</div>
  {formPreview&&sales&&<SalesPlanApplicationPreview headquartersId={headquartersId} planId={sales.draft.id} planRevision={sales.draft.revision} configuration={sales.draft.configuration} fields={sales.draft.configuration.application_form?.fields??defaultApplicationFields} selectedEvent={selectedEvent} onClose={()=>setFormPreview(false)}/>}
 </div></div>;
}
