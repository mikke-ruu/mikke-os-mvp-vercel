"use client";

import { useEffect, useRef, useState } from "react";
import type { SalesPlanDraftConfiguration } from "@/lib/academy2/sales-plan-drafts";
import type { SalesPlanApplicationField } from "@/lib/academy2/sales-plan.d.mts";
import {applicationContext,visibleApplicationFields} from "@/lib/academy2/application-conditions.mjs";
import styles from "./SalesPlanDraftEditor.module.css";

type Props = { configuration: SalesPlanDraftConfiguration; fields: SalesPlanApplicationField[]; onClose: () => void };

/** UI05 v0.10 administrator preview. Inputs never submit, save, or modify the draft. */
export function SalesPlanApplicationPreview({ configuration, fields, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [reception, setReception] = useState<"fixed" | "consult">("consult");
  const [delivery, setDelivery] = useState(configuration.kit?.methods[0] ?? "venue_handover");
  const [format,setFormat]=useState(configuration.allowed_methods?.[0]??"in_person");
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const context=applicationContext(configuration,{scheduleMode:reception==="consult"?"arranged_after_application":"fixed",format,kitMethod:delivery});
  const instructor = configuration.study_style !== "materials_only";
  const consult = instructor && reception === "consult";
  const kitShipping = !!configuration.kit?.enabled && delivery === "shipping" && configuration.kit.recipient !== "instructor";
  const certificate = configuration.after?.certificate;
  const address = kitShipping || !!certificate && certificate.delivery !== "digital";
  const ordinaryFields = visibleApplicationFields(fields,context,answers).filter(field => field.id !== "terms");
  const terms = fields.filter(field => field.id === "terms");
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
      {field.type === "agreement" ? <label><input id={id} type="checkbox" /> {field.label}{field.required && " *"}</label> : <>
        <label htmlFor={id}>{field.label}{field.required && " *"}</label>
        {field.type === "textarea" ? <textarea id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))} /> : field.type === "select" ? <select id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))}><option value="">選択してください</option>{field.options?.map(option=><option key={option} value={option}>{option}</option>)}</select> : <input id={id} value={answers[field.id]??""} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))} type={field.type} placeholder={field.id === "name" ? "例：山田 花子" : field.type === "email" ? "example@email.com" : field.type === "tel" ? "090-0000-0000" : undefined} />}
      </>}
    </div>;
  }
  return <div className={`${styles["form-overlay"]} ${styles.on}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={keyDown}>
    <div ref={panel} className={styles["form-modal"]} role="dialog" aria-modal="true" aria-labelledby="application-preview-title">
      <div className={styles["form-modal-head"]}><strong id="application-preview-title">受講者から見る｜申込フォーム</strong><button ref={close} className={styles["form-close"]} type="button" aria-label="プレビューを閉じる" onClick={onClose}>×</button></div>
      <div className={styles["customer-form"]}>
        <h2>{configuration.title || "販売プラン"} お申込み</h2>
        <div className={styles.lead}>入力内容は送信されません。開催の条件を切り替えて表示を確認できます。</div>
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-reception">表示を確認する受付方法</label><select id="preview-reception" value={reception} onChange={event => setReception(event.target.value as "fixed" | "consult")}><option value="consult">申込後に日程相談</option><option value="fixed">開催日決定済み</option></select></div>}
        {instructor && <div className={styles["customer-field"]}><label htmlFor="preview-format">表示を確認する開催方法</label><select id="preview-format" value={format} onChange={event=>setFormat(event.target.value as "in_person"|"online")}>{(configuration.allowed_methods?.length?configuration.allowed_methods:["in_person","online"]).map(method=><option key={method} value={method}>{method==="in_person"?"対面":"オンライン"}</option>)}</select></div>}
        {!!configuration.kit?.enabled && configuration.kit.methods.length > 1 && <div className={styles["customer-field"]}><label htmlFor="preview-delivery">表示を確認するキットの受け渡し</label><select id="preview-delivery" value={delivery} onChange={event => setDelivery(event.target.value as "shipping" | "venue_handover")}>{configuration.kit.methods.map(method => <option key={method} value={method}>{method === "shipping" ? "事前に発送" : "会場で手渡し"}</option>)}</select></div>}
        {consult && <div className={styles["consult-note"]}><b>日程はお申込み後、本部と相談して決定します。</b><br />下記にご希望の日程を入力してください。担当者よりご連絡し、日程を調整いたします。</div>}
        {ordinaryFields.filter(field => field.id !== "notes").map(fieldInput)}
        {consult && <><div className={styles["date-grid"]}>
          <div className={styles["customer-field"]}><label htmlFor="preview-date-1">第1希望日 *</label><input id="preview-date-1" type="date" /></div>
          <div className={styles["customer-field"]}><label htmlFor="preview-time">希望時間帯</label><select id="preview-time"><option>指定なし</option><option>午前</option><option>午後</option><option>夕方以降</option></select></div>
          {[2, 3].map(number => <div key={number} className={styles["customer-field"]}><label htmlFor={`preview-date-${number}`}>第{number}希望日</label><input id={`preview-date-${number}`} type="date" /></div>)}
        </div><div className={styles["customer-field"]}><label htmlFor="preview-date-note">日程についての補足</label><textarea id="preview-date-note" placeholder="例：平日は14時以降希望、土日は終日可能 など" /></div></>}
        {instructor && !consult && <div className={styles["customer-field"]}><label htmlFor="preview-event">開催日時 *</label><select id="preview-event" disabled><option>開催で設定した日時を表示します</option></select></div>}
        {configuration.after?.instructor_license&&fieldInput({id:'instructor_path_notice',label:'講師活動には受講後の登録・契約・条件確認が必要です',type:'select',required:true,options:['確認しました']})}
        {certificate && <div className={styles["customer-field"]}><label htmlFor="preview-certificate-name">証書記載名 *</label><input id="preview-certificate-name" placeholder="証書に記載するお名前" /></div>}
        {address && <div className={styles["customer-field"]}><label htmlFor="preview-shipping">発送先 *</label><textarea id="preview-shipping" placeholder="郵便番号・住所・宛名" /></div>}
        {ordinaryFields.filter(field => field.id === "notes").map(fieldInput)}
        {terms.map(fieldInput)}
        <button type="button" className={styles["submit-demo"]} disabled>この内容で申し込む</button>
      </div>
    </div>
  </div>;
}

