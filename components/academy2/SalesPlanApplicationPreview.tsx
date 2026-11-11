"use client";

import {GuestApplicationForm} from './GuestApplicationForm';
import pageStyles from './public-course-page.module.css';
import {getHeadquartersSettings} from '@/lib/academy2/headquarters-settings';
import {getCourseIntroductionPreview,type CourseIntroduction} from '@/lib/academy2/course-introduction';
import { useEffect, useRef, useState } from "react";
import type { SalesPlanDraftConfiguration } from "@/lib/academy2/sales-plan-drafts";
import type { SalesPlanApplicationField } from "@/lib/academy2/sales-plan.d.mts";
import {getAcademy2Event,listAcademy2Events,type Academy2EventSummary,type Academy2EventDetail} from '@/lib/academy2/operations';
import {readEventMaterials,type MaterialFulfillment} from '@/lib/academy2/material-fulfillment';
import styles from "./SalesPlanDraftEditor.module.css";

type Props = { localReview?:boolean;headquartersId:string; planId:string; planRevision?:number; configuration: SalesPlanDraftConfiguration; fields: SalesPlanApplicationField[]; selectedEvent?:Academy2EventDetail; onClose: () => void };

/** UI05 v0.10 administrator preview. Inputs never submit, save, or modify the draft. */
export function SalesPlanApplicationPreview({ localReview=false,headquartersId,planId,planRevision,configuration, fields, selectedEvent,onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [reception, setReception] = useState<"fixed" | "consult">("fixed");
  const [delivery, setDelivery] = useState(configuration.kit?.methods[0] ?? "venue_handover");
  const [format,setFormat]=useState(configuration.allowed_methods?.[0]??"in_person");
  const [previewCourses,setPreviewCourses]=useState<CourseIntroduction[]>([]),[documents,setDocuments]=useState<{cancellation?:string;privacy?:string}>({}),[previewError,setPreviewError]=useState('');
  useEffect(()=>{let live=true;if(localReview)return;Promise.all([Promise.all(configuration.course_ids.map(id=>getCourseIntroductionPreview(headquartersId,id))),getHeadquartersSettings(headquartersId)]).then(([courses,settings])=>{if(live){setPreviewCourses(courses.filter((c):c is CourseIntroduction=>!!c));setDocuments({cancellation:settings.documents.find(d=>d.kind==='cancellation')?.body,privacy:settings.documents.find(d=>d.kind==='privacy')?.body});}}).catch(()=>{if(live)setPreviewError('教材や規約の保存内容を一部確認できませんでした。');});return()=>{live=false;};},[headquartersId,configuration.course_ids.join(','),localReview]);
  const [events,setEvents]=useState<(Academy2EventSummary&{previewKitMethod?:string|null})[]>([]),[eventError,setEventError]=useState(''),[eventsLoading,setEventsLoading]=useState(false);
  const [selectedMaterials,setSelectedMaterials]=useState<{eventId:string;revision:number|null;planRevision:number|null;value:MaterialFulfillment|null}|null>(null),[selectedError,setSelectedError]=useState('');
  const selectedMatches=!selectedEvent||(selectedEvent.headquarters_id===headquartersId&&selectedEvent.sales_plan_id===planId&&(planRevision===undefined||selectedEvent.plan_revision===planRevision));
  const selectedV2=!!selectedEvent&&selectedEvent.kit_settings.contract_version===2;
  const selectedMaterialsReady=!selectedEvent||!!selectedMaterials&&selectedMaterials.eventId===selectedEvent.id&&selectedMaterials.revision===selectedEvent.revision&&selectedMaterials.planRevision===(planRevision??selectedEvent.plan_revision);
  const actualReception=selectedEvent?(selectedEvent.schedule_mode==='fixed'?'fixed':'consult'):reception;
  const actualFormat=selectedEvent?.format??format;
  const actualDelivery=selectedEvent?(selectedV2?(selectedMaterials?.value?.method==='learner_shipping'?'shipping':'venue_handover'):selectedEvent.kit_method??'venue_handover'):delivery;

  const instructor = configuration.study_style !== "materials_only";
  const consult = instructor && actualReception === "consult";

  const matchingEvents=events.filter(event=>event.sales_plan_id===planId&&event.schedule_mode==='fixed'&&event.format===actualFormat&&!!event.starts_at);
  useEffect(()=>{if(localReview||selectedEvent||!instructor||reception!=='fixed')return;let live=true;setEventsLoading(true);setEventError('');listAcademy2Events(headquartersId).then(async rows=>{const detailed=await Promise.all(rows.filter(row=>row.sales_plan_id===planId).map(async row=>{const e=await getAcademy2Event(headquartersId,row.id);if(e.headquarters_id!==headquartersId||e.sales_plan_id!==planId||e.revision!==row.revision)throw Error('開催が更新されています。プレビューを開き直してください。');let method:string|null=e.kit_method;if(e.kit_settings.contract_version===2){const fulfillment=await readEventMaterials(headquartersId,e.id);if(!fulfillment)throw Error('開催の受け渡し方法を確認できませんでした。');method=fulfillment.method==='learner_shipping'?'shipping':'venue_handover';}return {...e,previewKitMethod:method};}));if(live)setEvents(detailed);}).catch(()=>{if(live)setEventError('開催日時を取得できませんでした。');}).finally(()=>{if(live)setEventsLoading(false);});return()=>{live=false;};},[headquartersId,instructor,reception,selectedEvent?.id]);
  useEffect(()=>{let live=true;setSelectedMaterials(null);setSelectedError('');if(!selectedEvent)return;
   if(!selectedMatches){setSelectedError('選択した開催と販売プランが一致しません。');return;}
   const check=(event:Academy2EventDetail)=>{if(event.id!==selectedEvent.id||event.headquarters_id!==headquartersId||event.sales_plan_id!==planId||event.plan_revision!==(planRevision??selectedEvent.plan_revision)||event.revision!==selectedEvent.revision)throw new Error('開催が更新されています。共通作成画面で保存済みの内容を読み直してから確認してください。');};
   const run=async()=>{try{check(await getAcademy2Event(headquartersId,selectedEvent.id));let value:MaterialFulfillment|null=null;if(selectedV2){value=await readEventMaterials(headquartersId,selectedEvent.id);if(!value)throw new Error('開催の受け渡し設定を確認できませんでした。');check(await getAcademy2Event(headquartersId,selectedEvent.id));}if(live)setSelectedMaterials({eventId:selectedEvent.id,revision:selectedEvent.revision,planRevision:planRevision??selectedEvent.plan_revision,value});}catch(cause){if(live)setSelectedError(cause instanceof Error?cause.message:'開催の保存状態を確認できませんでした。');}};void run();return()=>{live=false;};
  },[headquartersId,planId,planRevision,selectedEvent?.id,selectedEvent?.revision,selectedEvent?.plan_revision,selectedV2,selectedMatches]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]') ?? []);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className={`${styles["form-overlay"]} ${styles.on}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={keyDown}>
    <div ref={panel} className={styles["form-modal"]} role="dialog" aria-modal="true" aria-labelledby="application-preview-title">
      <div className={styles["form-modal-head"]}><strong id="application-preview-title">申込フォームのプレビュー</strong><button ref={close} className={styles["form-close"]} type="button" aria-label="プレビューを閉じる" onClick={onClose}>×</button></div>
      <div className={styles["customer-form"]}>

        <div className={styles.lead}>プレビューのため、実際の申し込みは送信されません。</div>
        {selectedEvent&&selectedMatches&&selectedMaterialsReady&&!selectedError&&<p>選択した開催：{selectedEvent.title}（{actualFormat==='online'?'オンライン':'対面'}・{consult?(selectedEvent.individual_consultation?'個別に日程を相談':'申込後に日程相談'):'日時指定'}）</p>}
        {!selectedMatches?<p role="alert">選択した開催と販売プランが一致しません。</p>:selectedError?<p role="alert">{selectedError}</p>:!selectedMaterialsReady?<p role="status">開催の受け渡し設定を確認中…</p>:<>
        {!selectedEvent&&(instructor||!!configuration.kit?.enabled&&configuration.kit.methods.length>1)&&<fieldset className={styles.previewConditions}><legend>表示条件</legend>
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-reception">受付方法</label><select id="preview-reception" value={reception} onChange={event => setReception(event.target.value as "fixed" | "consult")}><option value="consult">申込後に日程相談</option><option value="fixed">開催日決定済み</option></select></div>}
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-format">開催方法</label><select id="preview-format" value={format} onChange={event=>{setFormat(event.target.value as "in_person"|"online");}}>{(configuration.allowed_methods?.length?configuration.allowed_methods:["in_person","online"]).map(method=><option key={method} value={method}>{method==="in_person"?"対面":"オンライン"}</option>)}</select></div>}
        {!!configuration.kit?.enabled && configuration.kit.methods.length > 1 && <div className={styles["customer-field"]}><label htmlFor="preview-delivery">表示を確認するキットの受け渡し</label><select id="preview-delivery" value={delivery} onChange={event => setDelivery(event.target.value as "shipping" | "venue_handover")}>{configuration.kit.methods.map(method => <option key={method} value={method}>{method === "shipping" ? "事前に発送" : "会場で手渡し"}</option>)}</select></div>}
        </fieldset>}
        {previewError&&<p role="alert">{previewError}</p>}
        <div className={pageStyles.formPage}><header className={pageStyles.formHeader}><h1>講座のお申し込み</h1><div className={pageStyles.formSummary}><h2>{configuration.title}</h2><p>{configuration.purchase_mode==='staged'?'講座ごとにお支払い':Number(configuration.price??0).toLocaleString('ja-JP')+'円（税込）'}</p></div></header><section className={pageStyles.formBody}>
        {eventError?<p role="alert">{eventError}</p>:eventsLoading?<p role="status">開催日程を確認しています…</p>:<GuestApplicationForm key={[actualReception,actualFormat,actualDelivery,selectedEvent?.id].join(':')} preview initialEventId={selectedEvent?.id} id={planId} price={Number(configuration.price??0)} purchaseMode={configuration.purchase_mode} title={configuration.title} methods={configuration.payment_methods??[]} terms={configuration.terms??{body:'',version:''}} configuration={configuration} form={{fields,conditionalVersion:1}} eventRequired={instructor} courses={previewCourses} previewDocuments={documents} events={selectedEvent?[{id:selectedEvent.id,title:selectedEvent.title,startsAt:selectedEvent.starts_at,endsAt:selectedEvent.ends_at,scheduleMode:actualReception==='consult'?'arranged_after_application':'fixed',format:actualFormat,kitMethod:actualDelivery,formReady:true}]:actualReception==='consult'?[{id:'preview-consult',title:configuration.title,startsAt:null,scheduleMode:'arranged_after_application',format:actualFormat,kitMethod:actualDelivery,formReady:true}]:matchingEvents.map(event=>({id:event.id,title:event.title,startsAt:event.starts_at,endsAt:event.ends_at,scheduleMode:event.schedule_mode,format:event.format,kitMethod:event.previewKitMethod,formReady:event.registration_status==='open'}))}/>}
        </section></div>
        </>}
      </div>
    </div>
  </div>;
}

