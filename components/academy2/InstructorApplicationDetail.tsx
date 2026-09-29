"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InstructorApplicationView, ApplicationProjectionHold } from "@/lib/academy2/instructor-application-view.mjs";
import styles from "./instructor-application-detail.module.css";

export type InstructorScheduleInput = { date: string; startsAt: string; endsAt: string; onlineUrl: string };
type Details = { statusLabel?: string; appliedAt?: string; phone?: string; requestedDates?: string; notes?: string;
  shippingAddress?: string; shippedAt?: string; trackingNumber?: string; licenseIncludes?: string[];
  scheduleInput?: InstructorScheduleInput; kitDestination?: {recipient: "instructor" | "learner" | null; options: {id:string;label:string;address:string}[]; selectedAddress:string|null; selectedAddressId?:string|null} };
type Actions = { confirmKitDestination?: (addressId:string)=>Promise<void>; confirmSchedule?: (input: InstructorScheduleInput) => Promise<void>; confirmTuition?: () => Promise<void>;
  payOpeningLicense?: () => Promise<void>; recordAttendance?: () => Promise<void>; openCompletionReport?: () => Promise<void>;
  resendPaymentInstructions?: () => Promise<void>; openCompletionFeedback?: () => Promise<void> };
export type InstructorApplicationDetailProps = { view: InstructorApplicationView | ApplicationProjectionHold; details?: Details;
  actions?: Actions; operationsConnected?: boolean; onBack?: () => void; onReload?: () => Promise<void>; loading?: boolean; error?: string | null };

const labels: Record<string, string> = { unknown: "確認中", unpaid: "未入金", paid: "入金済み", partially_refunded: "一部返金済み", refunded: "返金済み",
  bank_transfer: "銀行振込", external_url: "外部の決済サービス", card: "カード決済", cash: "現金", fixed: "日時を決めて募集", arranged_after_application: "申込後に日程相談",
  in_person: "対面", online: "オンライン", unconfirmed: "未確認", confirmed: "確定済み", completed: "開催済み", present: "出席済み", absent: "欠席",
  not_reported: "未報告", submitted: "本部確認待ち", returned: "差戻し", accepted: "確認済み", none: "なし", pending: "確認待ち", certified: "認定済み", revoked: "取消済み",
  not_required: "不要", not_applicable: "対象外", cancelled: "取消済み", preparing: "発送準備中", shipped: "発送済み", delivered: "配達済み",
  scheduled: "送信予定", unsent: "未送信", sent: "送信済み", resent: "再送済み", failed: "送信失敗" };
const label = (value: string) => labels[value] ?? "確認中";
const fee = (value: number | null, currency: string | null) => value === null || !currency ? "確認中" : `${currency === "JPY" ? "¥" : `${currency} `}${value.toLocaleString("ja-JP")}`;
function displayDate(value: string | null | undefined): string {
  if (!value) return "未確定";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
    : "日時を確認してください";
}
function mailHref(value: string | null): string | undefined {
  return value && /^[^\s@<>?#%]+@[^\s@<>?#%]+\.[^\s@<>?#%]+$/.test(value) && !/[\r\n]/.test(value) ? `mailto:${encodeURIComponent(value)}` : undefined;
}
function Row({ title, children }: { title: string; children: ReactNode }) { return <div className={styles.row}><b>{title}</b><span>{children}</span></div>; }

/** UI18 v0.3 structure; LOCK46 supersedes its manual license request. Server callbacks
 * must reauthorize each action. This component never fetches, invoices or grants rights.
 * Do not pass this instructor-only view to learner pages. */
export function InstructorApplicationDetail(props: InstructorApplicationDetailProps) {
  if (props.loading) return <p className={styles.wrap} role="status">申込を読み込み中…</p>;
  if (props.view.outcome !== "ready") return <p className={styles.wrap} role="status">{props.view.message}</p>;
  return <Detail key={props.view.applicationId} {...props} view={props.view} />;
}
function Detail({ view, details = {}, actions = {}, operationsConnected = false, onBack, onReload, error }: Omit<InstructorApplicationDetailProps, "view"> & { view: InstructorApplicationView }) {
  const [schedule, setSchedule] = useState<InstructorScheduleInput>(details.scheduleInput ?? { date: "", startsAt: "", endsAt: "", onlineUrl: "" });
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [kitAddressId,setKitAddressId]=useState(details.kitDestination?.selectedAddressId??"");
  const [kitDirty,setKitDirty]=useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [mail, setMail] = useState<InstructorApplicationView["automaticMailHistory"][number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (mail && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [mail]);
  async function run(key: string, callback: (() => Promise<void>) | undefined) {
    if (!callback || inFlight.current) return;
    inFlight.current = true; setBusy(key); setActionError(null); setResult(null);
    try { await callback(); setResult("処理が完了しました。"); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "処理できませんでした。入力内容は残っています。"); }
    finally { inFlight.current = false; setBusy(null); }
  }
  function Action({ actionKey, callback, children, primary = false, blocked = false }: { actionKey: string; callback?: () => Promise<void>; children: ReactNode; primary?: boolean; blocked?: boolean }) {
    return <button type="button" className={`${styles.btn} ${primary ? styles.orange : ""}`} disabled={!!busy || !callback || blocked} onClick={() => run(actionKey, callback)}>{busy === actionKey ? "処理中…" : children}{!callback && !(operationsConnected && ["schedule", "tuition", "attendance", "completion", "license", "kit-address"].includes(actionKey)) ? "（準備中）" : ""}</button>;
  }
  const contactHref = mailHref(view.contact.email);
  const next = view.nextAction.outcome === "action" ? view.nextAction.key : null;
  const nextCards: Record<string, { title: string; id: string }> = { contact_learner: { title: "受講者へ連絡してください", id: "mail" },
    confirm_schedule: { title: "日程を確認してください", id: "schedule" }, confirm_tuition: { title: "受講料の入金を確認してください", id: "tuition" },
    pay_opening_license: { title: "開講ライセンス料をお支払いください", id: "license" }, record_attendance: { title: "出欠を確認してください", id: "completion" },
    completion_report: { title: "修了報告をしてください", id: "completion" }, view_completion_feedback: { title: "本部からの回答を確認してください", id: "completion" } };
  const nextCard = next ? nextCards[next] : null;
  const id = (section: string) => `application-${view.applicationId}-${section}`;
  const licenseApplicable = view.openingLicense.status !== "not_applicable";
  const licenseLabel = view.openingLicense.status === "unpaid" ? "開講ライセンス未払い" : view.openingLicense.status === "paid" ? "支払済み" : label(view.openingLicense.status);
  return <section className={styles.wrap} aria-label="講師の申込詳細">
    <header className={styles.detailHead}><div className={styles.detailTitle}><button type="button" className={styles.back} disabled={!onBack || !!busy} onClick={onBack}>← 申込一覧へ</button><h1>{view.learnerName ?? "申込詳細"}</h1><p>{view.planTitle ?? "販売プランを確認中"}</p></div></header>
    {(error || actionError) && <div role="alert" className={styles.error}><p>{error || actionError}</p>{onReload && <Action actionKey="reload" callback={onReload}>最新の状態を確認</Action>}</div>}{result && <p role="status" className={styles.result}>{result}</p>}
    <div className={styles.progress} aria-label="対応の流れ">{["申込", "日程", "支払い", "開講準備", "開催", "修了"].map((step, index) => <div className={styles.step} key={step}><b>{index + 1}</b>{step}</div>)}</div>
    <div className={styles.detailGrid}>
      <section className={`${styles.stack} ${styles.statusRegion}`} aria-label="ステータス">
      <section className={`${styles.card} ${styles.mobileStatus}`}><h2>ステータス</h2><Row title="現在">{details.statusLabel ?? "状況を確認中"}</Row></section>
      <section className={`${styles.card} ${styles.greenSoft} ${styles.mobileNext}`}><h2>今やること</h2><div className={styles.actionbox}>{nextCard ? <><strong>{nextCard.title}</strong><button type="button" className={`${styles.btn} ${styles.orange}`} onClick={() => document.getElementById(id(nextCard.id))?.scrollIntoView({ block: "start" })}>確認する</button></> : <p>{view.nextAction.outcome === "hold" ? "次の対応を確認中です。" : "現在、次の対応はありません。"}</p>}</div></section>
      <section className={`${styles.card} ${styles.mobileCurrent}`}><h2>現在の状況</h2><Row title="日程">{label(view.schedule.status)}</Row><Row title="受講料">{label(view.tuition.status)}</Row>{licenseApplicable && <Row title="開講ライセンス">{licenseLabel}</Row>}<Row title="キット">{label(view.kit.status)}</Row><Row title="修了報告">{label(view.completion.report)}</Row></section>
      </section>
      <div className={`${styles.stack} ${styles.mainColumn}`}>
        <section className={styles.applicantRegion} aria-label="申込者">
      <section className={`${styles.card} ${styles.greenSoft} ${styles.application}`}><h2>申込者</h2><p className={styles.desc}>お客様が申込時に入力した内容です。</p>
        <Row title="お名前">{view.learnerName ?? "未確認"}</Row>{details.appliedAt && <Row title="申込日">{displayDate(details.appliedAt)}</Row>}<Row title="メール">{view.contact.email ?? "未登録"}</Row>{details.phone && <Row title="電話番号">{details.phone}</Row>}
        <Row title="受講方法">{label(view.schedule.format)}</Row>{details.requestedDates && <Row title="希望日">{details.requestedDates}</Row>}{details.notes && <Row title="備考">{details.notes}</Row>}
      </section>
        </section>
        <section className={`${styles.stack} ${styles.eventRegion}`} aria-label="開催">
      <section id={id("schedule")} className={`${styles.card} ${styles.greenSoft} ${styles.schedule}`}><h2>日程</h2><p className={styles.desc}>{label(view.schedule.mode)}</p><Row title="保存済みの日程">{displayDate(view.schedule.startsAt)}{view.schedule.endsAt ? ` 〜 ${displayDate(view.schedule.endsAt)}` : ""}</Row>
        <fieldset className={styles.fields} disabled={!!busy || !actions.confirmSchedule}><div className={styles.grid2}><label className={styles.field}>開催日<input type="date" value={schedule.date} onChange={e => { setSchedule({ ...schedule, date: e.target.value }); setScheduleDirty(true); }} /></label><div className={styles.grid2}><label className={styles.field}>開始時間<input type="time" value={schedule.startsAt} onChange={e => { setSchedule({ ...schedule, startsAt: e.target.value }); setScheduleDirty(true); }} /></label><label className={styles.field}>終了時間<input type="time" value={schedule.endsAt} onChange={e => { setSchedule({ ...schedule, endsAt: e.target.value }); setScheduleDirty(true); }} /></label></div></div>
          {view.schedule.format === "online" && <label className={styles.field}>参加URL<input type="url" value={schedule.onlineUrl} onChange={e => { setSchedule({ ...schedule, onlineUrl: e.target.value }); setScheduleDirty(true); }} /></label>}
        </fieldset><div className={styles.buttons}><Action actionKey="schedule" primary callback={actions.confirmSchedule ? async () => { if (!schedule.date || !schedule.startsAt || !schedule.endsAt) throw new Error("開催日と開始・終了時間を入力してください。"); await actions.confirmSchedule!(schedule); setScheduleDirty(false); } : undefined}>この日程で確定</Action></div>{scheduleDirty && <p role="status" className={styles.desc}>日程の入力内容は未保存です。</p>}
      </section>
      <section id={id("tuition")} className={`${styles.card} ${styles.tuition}`}><h2>受講料</h2><p className={styles.desc}>この講座の受講料です。受講者様からの入金を確認します。</p><Row title="受講料">{fee(view.tuition.amountMinor, view.tuition.currency)}</Row><Row title="支払方法">{label(view.tuition.method)}</Row><Row title="入金状態">{label(view.tuition.status)}</Row><div className={styles.buttons}><Action actionKey="tuition" callback={actions.confirmTuition} blocked={view.tuition.recipient !== "instructor" || view.tuition.status !== "unpaid"}>入金済みにする</Action><Action actionKey="resend" callback={actions.resendPaymentInstructions}>支払い案内を再送</Action><button className={styles.btn} type="button" onClick={() => document.getElementById(id("mail"))?.scrollIntoView({ block: "start" })}>メール内容を見る</button></div></section>
      {licenseApplicable && <section id={id("license")} className={`${styles.card} ${styles.greenSoft} ${styles.license}`}><h2>開講ライセンス</h2><p className={styles.desc}>受講料の入金確認後に請求が作成されます。開講ライセンス料は本部へ支払います。</p><div className={styles.licenseBox}><h3>{view.planTitle}</h3><Row title="開講ライセンス料">{fee(view.openingLicense.amountMinor, view.openingLicense.currency)}</Row>{details.licenseIncludes?.length ? <div className={styles.licenseItems}>{details.licenseIncludes.map(item => <span key={item}>{item}</span>)}</div> : null}</div><Row title="状態">{licenseLabel}</Row><div className={styles.buttons}><Action actionKey="license" primary callback={actions.payOpeningLicense} blocked={view.openingLicense.status !== "unpaid"}>開講ライセンス料を支払う</Action></div></section>}
      <section className={`${styles.card} ${styles.kit}`}><h2>キット・発送</h2><Row title="キット">{view.kit.required === true ? "あり" : view.kit.required === false ? "なし" : "確認中"}</Row>{view.kit.required !== false && <><Row title="発送状態">{label(view.kit.status)}</Row>{details.kitDestination?.recipient === "instructor" && actions.confirmKitDestination && <fieldset className={styles.fields} disabled={!!busy || !actions.confirmKitDestination}><legend className={styles.field}>キット受取住所</legend><div className={styles.addressList}>{details.kitDestination.options.map(address=><label className={styles.addressChoice} key={address.id}><input type="radio" name={id("kit-address")} value={address.id} checked={kitAddressId===address.id} onChange={()=>{setKitAddressId(address.id);setKitDirty(true);}}/><span><strong>{address.label}</strong><span>{address.address}</span></span></label>)}</div>{!details.kitDestination.options.length&&<p className={styles.desc}>登録済みのキット受取住所はありません。</p>}<div className={styles.buttons}><Action actionKey="kit-address" primary blocked={!kitAddressId||!kitDirty} callback={actions.confirmKitDestination?async()=>{await actions.confirmKitDestination!(kitAddressId);setKitDirty(false);}:undefined}>この受取先で確定</Action></div>{kitDirty&&<p role="status" className={styles.desc}>受取先の変更は未保存です。</p>}</fieldset>}{details.kitDestination?.recipient === "learner" && !details.kitDestination.selectedAddress && <p className={styles.desc}>本部で発送先を確認中です。</p>}{details.shippingAddress && <Row title="発送先">{details.shippingAddress}</Row>}{details.shippedAt && <Row title="発送日">{displayDate(details.shippedAt)}</Row>}{details.trackingNumber && <Row title="追跡番号">{details.trackingNumber}</Row>}</>}</section>
      <section id={id("completion")} className={`${styles.card} ${styles.greenSoft} ${styles.completion}`}><h2>開催・修了</h2><p className={styles.desc}>開催後は出席を確認し、修了報告を行います。</p><Row title="出席">{label(view.completion.attendance)}</Row><Row title="修了報告">{label(view.completion.report)}</Row><Row title="認定">{label(view.completion.certification)}</Row><div className={styles.buttons}><Action actionKey="attendance" callback={actions.recordAttendance}>出席済みにする</Action><Action actionKey="completion" callback={actions.openCompletionReport} blocked={view.progression.completion_report.state !== "allow"}>修了報告をする</Action>{view.completion.report === "returned" && <Action actionKey="feedback" callback={actions.openCompletionFeedback}>本部からの回答を見る</Action>}</div>{view.progression.completion_report.state !== "allow" && <p className={styles.desc}>{view.openingLicense.status === "unpaid" ? "開講ライセンス料のお支払い後に修了報告へ進めます。" : "修了報告の条件を確認中です。"}</p>}</section>
        </section>
        <section className={styles.contactRegion} aria-label="連絡履歴">
      <section id={id("mail")} className={`${styles.card} ${styles.mail}`}><h2>連絡履歴</h2><h3 className={styles.subheading}>自動メール履歴</h3><p className={styles.desc}>{view.tuition.recipient === "instructor" ? "申込や日程確定時に、講師の登録メールアドレスを返信先として自動送信されます。" : "本部が受講者への案内を行います。"}</p>
        <div className={styles.timeline}>{view.automaticMailHistory.length ? view.automaticMailHistory.map((entry, index) => <div className={styles.log} key={entry.id ?? index}><span className={styles.dot} /><div><strong>{entry.subject ?? "案内メール"}</strong><p>{displayDate(entry.sentAt)} {label(entry.status)}</p><button type="button" className={styles.btn} onClick={() => setMail(entry)}>内容を見る</button></div></div>) : <p className={styles.desc}>自動メール履歴はありません。</p>}</div>
        {view.tuition.recipient === "instructor" && <div className={styles.actionbox}><strong>日程調整などの個別連絡</strong><p>講師のメールから受講者と直接連絡を取り、日程を決めてください。</p><Row title="受講者メール">{view.contact.email ?? "未登録"}</Row><div className={styles.buttons}>{contactHref ? <a className={`${styles.btn} ${styles.blue}`} href={contactHref}>受講者にメールする</a> : <button type="button" className={styles.btn} disabled>受講者にメールする（メール未確認）</button>}</div></div>}
      </section>
        </section>
        <section className={`${styles.card} ${styles.memoRegion}`} aria-label="メモ"><h2>メモ</h2><p className={styles.desc}>講師用メモの保存機能は準備中です。申込時の備考は「申込者」で確認できます。</p></section>
      </div>
    </div>
    <dialog ref={dialog} className={styles.modal} onCancel={() => setMail(null)} onClose={() => setMail(null)}><div className={styles.modalHead}><strong>メール内容</strong><button type="button" aria-label="メール内容を閉じる" onClick={() => { dialog.current?.close(); setMail(null); }}>×</button></div>{mail && <div className={styles.modalBody}><Row title="送信状態">{label(mail.status)}</Row><h3>{mail.subject ?? "件名未設定"}</h3><pre>{mail.body ?? "本文はまだありません。"}</pre><p className={styles.desc}>メール本文は本部が編集します。</p></div>}</dialog>
  </section>;
}




