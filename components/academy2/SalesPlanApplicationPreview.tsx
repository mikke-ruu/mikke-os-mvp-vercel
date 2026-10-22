"use client";

import { useEffect, useRef, useState } from "react";
import type { SalesPlanDraftConfiguration } from "@/lib/academy2/sales-plan-drafts";
import type { SalesPlanApplicationField } from "@/lib/academy2/sales-plan.d.mts";
import {applicationContext,visibleApplicationFields} from "@/lib/academy2/application-conditions.mjs";
import {getAcademy2Event,listAcademy2Events,type Academy2EventSummary,type Academy2EventDetail} from '@/lib/academy2/operations';
import {readEventMaterials,type MaterialFulfillment} from '@/lib/academy2/material-fulfillment';
import styles from "./SalesPlanDraftEditor.module.css";

type Props = { headquartersId:string; planId:string; planRevision?:number; configuration: SalesPlanDraftConfiguration; fields: SalesPlanApplicationField[]; selectedEvent?:Academy2EventDetail; onClose: () => void };

/** UI05 v0.10 administrator preview. Inputs never submit, save, or modify the draft. */
export function SalesPlanApplicationPreview({ headquartersId,planId,planRevision,configuration, fields, selectedEvent,onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [reception, setReception] = useState<"fixed" | "consult">("consult");
  const [delivery, setDelivery] = useState(configuration.kit?.methods[0] ?? "venue_handover");
  const [format,setFormat]=useState(configuration.allowed_methods?.[0]??"in_person");
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [events,setEvents]=useState<Academy2EventSummary[]>([]),[eventError,setEventError]=useState(''),[eventsLoading,setEventsLoading]=useState(false),[eventId,setEventId]=useState('');
  const [selectedMaterials,setSelectedMaterials]=useState<{eventId:string;revision:number|null;planRevision:number|null;value:MaterialFulfillment|null}|null>(null),[selectedError,setSelectedError]=useState('');
  const selectedMatches=!selectedEvent||(selectedEvent.headquarters_id===headquartersId&&selectedEvent.sales_plan_id===planId&&(planRevision===undefined||selectedEvent.plan_revision===planRevision));
  const selectedV2=!!selectedEvent&&selectedEvent.kit_settings.contract_version===2;
  const selectedMaterialsReady=!selectedEvent||!!selectedMaterials&&selectedMaterials.eventId===selectedEvent.id&&selectedMaterials.revision===selectedEvent.revision&&selectedMaterials.planRevision===(planRevision??selectedEvent.plan_revision);
  const actualReception=selectedEvent?(selectedEvent.schedule_mode==='fixed'?'fixed':'consult'):reception;
  const actualFormat=selectedEvent?.format??format;
  const actualDelivery=selectedEvent?(selectedV2?(selectedMaterials?.value?.method==='learner_shipping'?'shipping':'venue_handover'):selectedEvent.kit_method??'venue_handover'):delivery;
  const context=applicationContext(configuration,{scheduleMode:actualReception==="consult"?"arranged_after_application":"fixed",format:actualFormat,kitMethod:actualDelivery});
  const instructor = configuration.study_style !== "materials_only";
  const consult = instructor && actualReception === "consult";
  const kitShipping = !!configuration.kit?.enabled && actualDelivery === "shipping" && configuration.kit.recipient !== "instructor";
  const certificate = configuration.after?.certificate;
  const address = kitShipping || !!certificate && certificate.delivery !== "digital";
  const ordinaryFields = visibleApplicationFields(fields,context,answers).filter(field => field.id !== "terms");
  const terms = fields.filter(field => field.id === "terms");
  const termsBody=configuration.terms?.body??'';
  const matchingEvents=events.filter(event=>event.sales_plan_id===planId&&event.schedule_mode==='fixed'&&event.format===actualFormat&&!!event.starts_at);
  useEffect(()=>{if(selectedEvent||!instructor||reception!=='fixed')return;let live=true;setEventsLoading(true);setEventError('');listAcademy2Events(headquartersId).then(rows=>{if(live)setEvents(rows);}).catch(()=>{if(live)setEventError('開催日時を取得できませんでした。');}).finally(()=>{if(live)setEventsLoading(false);});return()=>{live=false;};},[headquartersId,instructor,reception,selectedEvent?.id]);
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
    const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  function fieldInput(field: SalesPlanApplicationField) {
    const id = `preview-${field.id}`;
    return <div className={styles["customer-field"]} key={field.id}>
      {field.type === "agreement" ? <label className={styles.agreementLabel}><input id={id} type="checkbox" /><span>{field.label}{field.required && " *"}</span></label> : <>
        <label htmlFor={id}>{field.label}{field.required && " *"}</label>
        {field.type === "textarea" ? <textarea id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))} /> : field.type === "select" ? <select id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))}><option value="">選択してください</option>{field.options?.map(option=><option key={option} value={option}>{option}</option>)}</select> : <input id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))} type={field.type} placeholder={field.id === "name" ? "例：山田 花子" : field.type === "email" ? "example@email.com" : field.type === "tel" ? "090-0000-0000" : undefined} />}
      </>}
    </div>;
  }
  return <div className={`${styles["form-overlay"]} ${styles.on}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={keyDown}>
    <div ref={panel} className={styles["form-modal"]} role="dialog" aria-modal="true" aria-labelledby="application-preview-title">
      <div className={styles["form-modal-head"]}><strong id="application-preview-title">申込フォームのプレビュー</strong><button ref={close} className={styles["form-close"]} type="button" aria-label="プレビューを閉じる" onClick={onClose}>×</button></div>
      <div className={styles["customer-form"]}>
        <h2>講座のお申し込み</h2>{configuration.title&&<p>{configuration.title}</p>}
        <div className={styles.lead}>プレビューのため、実際の申し込みは送信されません。</div>
        {selectedEvent&&selectedMatches&&selectedMaterialsReady&&!selectedError&&<p>選択した開催：{selectedEvent.title}（{actualFormat==='online'?'オンライン':'対面'}・{consult?(selectedEvent.individual_consultation?'個別に日程を相談':'申込後に日程相談'):'日時指定'}）</p>}
        {!selectedMatches?<p role="alert">選択した開催と販売プランが一致しません。</p>:selectedError?<p role="alert">{selectedError}</p>:!selectedMaterialsReady?<p role="status">開催の受け渡し設定を確認中…</p>:<>
        {!selectedEvent&&(instructor||!!configuration.kit?.enabled&&configuration.kit.methods.length>1)&&<fieldset className={styles.previewConditions}><legend>表示条件</legend>
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-reception">受付方法</label><select id="preview-reception" value={reception} onChange={event => setReception(event.target.value as "fixed" | "consult")}><option value="consult">申込後に日程相談</option><option value="fixed">開催日決定済み</option></select></div>}
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-format">開催方法</label><select id="preview-format" value={format} onChange={event=>{setFormat(event.target.value as "in_person"|"online");setEventId('');}}>{(configuration.allowed_methods?.length?configuration.allowed_methods:["in_person","online"]).map(method=><option key={method} value={method}>{method==="in_person"?"対面":"オンライン"}</option>)}</select></div>}
        {!!configuration.kit?.enabled && configuration.kit.methods.length > 1 && <div className={styles["customer-field"]}><label htmlFor="preview-delivery">表示を確認するキットの受け渡し</label><select id="preview-delivery" value={delivery} onChange={event => setDelivery(event.target.value as "shipping" | "venue_handover")}>{configuration.kit.methods.map(method => <option key={method} value={method}>{method === "shipping" ? "事前に発送" : "会場で手渡し"}</option>)}</select></div>}
        </fieldset>}
        {consult && <div className={styles["consult-note"]}>日程はお申し込み後にご相談のうえ決定します。<br />下記にご希望の日程を入力してください。担当者よりご連絡し、日程を調整いたします。</div>}
        {ordinaryFields.filter(field => field.id !== "notes").map(fieldInput)}
        {consult && <><div className={styles["date-grid"]}>
          <div className={styles["customer-field"]}><label htmlFor="preview-date-1">第1希望日 *</label><input id="preview-date-1" type="date" /></div>
          <div className={styles["customer-field"]}><label htmlFor="preview-time">希望時間帯</label><select id="preview-time"><option>指定なし</option><option>午前</option><option>午後</option><option>夕方以降</option></select></div>
          {[2, 3].map(number => <div key={number} className={styles["customer-field"]}><label htmlFor={`preview-date-${number}`}>第{number}希望日</label><input id={`preview-date-${number}`} type="date" /></div>)}
        </div><div className={styles["customer-field"]}><label htmlFor="preview-date-note">日程についての補足</label><textarea id="preview-date-note" placeholder="例：平日は14時以降希望、土日は終日可能 など" /></div></>}
        {instructor && !consult && <div className={styles["customer-field"]}>{selectedEvent?<><label>開催日時</label><p>{selectedEvent.starts_at?new Date(selectedEvent.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日時未設定'}{selectedEvent.ends_at?` 〜 ${new Date(selectedEvent.ends_at).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'})}`:''}</p><p>{selectedEvent.registration_status==='open'?'受付中':'現在、この開催の申込を受け付けていません。'}</p></>:<><label htmlFor="preview-event">開催日時 *</label><select id="preview-event" value={eventId} onChange={event=>setEventId(event.target.value)} disabled={eventsLoading||!!eventError||!matchingEvents.length}><option value="">{eventsLoading?'確認中…':!matchingEvents.length?'表示できる開催日時はありません':'選択してください'}</option>{matchingEvents.map(event=><option key={event.id} value={event.id}>{new Date(event.starts_at!).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}　{event.title}{event.registration_status!=='open'?'（受付前・終了）':''}</option>)}</select>{eventError&&<p role="alert">{eventError}</p>}</>}</div>}
        {configuration.after?.instructor_license&&fieldInput({id:'instructor_path_notice',label:'講師活動には受講後の登録・契約・条件確認が必要です',type:'select',required:true,options:['確認しました']})}
        {certificate && <div className={styles["customer-field"]}><label htmlFor="preview-certificate-name">証書記載名 *</label><input id="preview-certificate-name" placeholder="証書に記載するお名前" /></div>}
        {address && <div className={styles["customer-field"]}><label htmlFor="preview-shipping">発送先 *</label><textarea id="preview-shipping" placeholder="郵便番号・住所・宛名" /></div>}
        {ordinaryFields.filter(field => field.id === "notes").map(fieldInput)}
        <section className={styles.previewTerms} aria-label="お申し込みに関する注意事項"><h3>お申し込みに関する注意事項</h3>{termsBody.trim()?<div id="preview-terms-body" className={styles.termsBody} tabIndex={0}>{termsBody}</div>:<p>注意事項はまだ設定されていません。</p>}
        {terms.map(field=><div className={styles['customer-field']} key={field.id}><label className={styles.agreementLabel}><input id={`preview-${field.id}`} type="checkbox" required={field.required} disabled={!termsBody.trim()} aria-describedby={termsBody.trim()?'preview-terms-body':undefined}/><span>上記の内容を確認し、同意します。{field.required&&' *'}</span></label></div>)}</section>
        <button type="button" className={styles["submit-demo"]} disabled>この内容で申し込む</button>
        </>}
      </div>
    </div>
  </div>;
}

