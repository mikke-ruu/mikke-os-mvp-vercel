"use client";

import {useSearchParams} from "next/navigation";
import {LocalReviewControls} from "./LocalReviewControls";
import { Fragment, useEffect, useRef, useState } from "react";
import { getSalesPlanDraft, saveSalesPlanDraft, type SalesPlanDraft, type SalesPlanDraftConfiguration } from "@/lib/academy2/sales-plan-drafts";
import { listAcademy2Courses, type Academy2Course } from "@/lib/academy2/courses";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import styles from "./SalesPlanDraftEditor.module.css";
import { SalesPlanApplicationPreview } from "./SalesPlanApplicationPreview";

import type {SalesPlanApplicationField as Question} from "@/lib/academy2/sales-plan.mjs";
import {applicationFormErrors} from "@/lib/academy2/application-conditions.mjs";
import {salesPlanPresetKind,salesPlanSamples,type SalesPlanPreset,type SalesPlanSample} from "@/lib/academy2/sales-plan-presets";
import {SalesPlanTypeFields} from './SalesPlanTypeFields';
import {SalesPlanAfterStep,AfterCourseSummary} from './SalesPlanAfterStep';
import {AfterCourseWizard,WizardSummary} from './AfterCourseWizard';
import {ReviewPaymentSettings} from './ReviewPaymentSettings';
import {readCourseShipping,deriveCourseKit,type CourseShippingRow} from '@/lib/academy2/plan-review';
import {recommendedMonthlyPolicies} from '@/lib/academy2/monthly-policy.mjs';
import {monthlyPolicyMessages} from '@/lib/academy2/monthly-policy-display.mjs';
import {MonthlyPolicySummary} from './MonthlyPolicySummary';
type Configuration = SalesPlanDraftConfiguration & {
  application_form?: { fields: Question[]; conditionalVersion?: 1 };
  kit?: NonNullable<SalesPlanDraftConfiguration["kit"]> & { name?: string };
  after?: NonNullable<SalesPlanDraftConfiguration["after"]> & { record_completion?: boolean };
};
export type SalesPlanPageAction = "standard" | "builder" | "template";
type Props = { headquartersId: string; draftId?: string; initialCourseId?: string; initialPreset?: SalesPlanPreset; initialSample?: SalesPlanSample;
  onSaved?: (draft: SalesPlanDraft) => void;
  onPageAction?: (action: SalesPlanPageAction, draft: SalesPlanDraft) => void | Promise<void> };
const steps = ["講座・順番", "受講スタイル", "金額", "支払い", "受講後", "申込フォーム", "確認・販売ページ"];
const headings = ["講座を選んで、受講する順番を決める", "どうやって受講しますか？", "このコースの金額を決める", "支払い方法を決める", "受講後はどうしますか？", "申込フォームを設定する", "内容を確認して、販売ページを準備する"];
const help = ["作成済みの講座から選び、そのままドラッグして受講する順番に並べます。講座を押すと内容を確認できます。", "この販売プラン全体の受講スタイルを決めます。日程や定員はここでは設定しません。", "単品参考価格を見ながら、この販売プランでの実際の料金を設定します。", "受講者が使える支払い方法を選びます。必要な方法だけ設定してください。", "必要なものだけ選びます。選んだ内容に必要な設定だけが表示されます。", "募集時に、お客様へ入力してもらう内容を決めます。必要な項目は販売プランの設定から自動で追加できます。", "この内容だけでも標準の販売ページとして使えます。必要ならビルダーやテンプレートで見せ方をカスタムできます。"];
const baseFields: Question[] = [{ id: "name", label: "お名前", type: "text", required: true }, { id: "email", label: "メールアドレス", type: "email", required: true }, { id: "phone", label: "電話番号", type: "tel", required: false }, { id: "notes", label: "備考・質問", type: "textarea", required: false }, { id: "terms", label: "申込規約への同意", type: "agreement", required: true }];
const emptyAfter: NonNullable<Configuration["after"]> = { skill_certification: false, commercial_license: false, instructor_license: false };
const yen = (n: number | null | undefined) => n == null ? "未設定" : `¥${n.toLocaleString("ja-JP")}`;
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).map(n => styles[n as string]).join(" ");
const toggle = <T,>(items: T[], value: T) => items.includes(value) ? items.filter(item => item !== value) : [...items, value];
function initial(courseId?: string,preset?:SalesPlanPreset,sample?:SalesPlanSample): Configuration {
  const example=salesPlanSamples.find(item=>item.id===sample);const selectedPreset=preset??sample??'course';const kind=salesPlanPresetKind(selectedPreset);
  return { title: example?.title??"", kind, course_ids: courseId&&!['全講座','月額レッスン'].includes(kind) ? [courseId] : [], price: example?.price??null, purchase_mode: "all", stage_prices: {}, study_style: "instructor", allowed_methods: [], materials: { enabled: false }, payment_methods: [], after: { ...emptyAfter, skill_certification:selectedPreset==='certification',record_completion: true }, terms: { version: "", body: "" }, show_course_introductions: true,...(kind==='全講座'?{catalog_course_ids:[]}:{ }),...(kind==='月額レッスン'?{monthly:{months:[],period:{kind:'unlimited'},past_access:'from_join_month',...recommendedMonthlyPolicies()}}:{}) };
}

/** UI-05 v0.9 base, with STEP6 preview aligned to v0.10. Business data remains in the versioned draft RPC; no publication side effects. */
export function SalesPlanDraftEditor({ headquartersId, draftId, initialCourseId, initialPreset, initialSample, onSaved, onPageAction }: Props) {
  const query=useSearchParams();
  const sixStep=true;
  const navigation=sixStep?[0,1,2,4,5,6]:[0,1,2,3,4,5,6];
  const names=sixStep?['講座・順番','受講スタイル','金額・支払い','受講後','申込フォーム','確認・販売ページ']:steps;
  const [shippingRows,setShippingRows]=useState<CourseShippingRow[]>([]),[shippingError,setShippingError]=useState(''),[shippingRefresh,setShippingRefresh]=useState(0),[shippingLoaded,setShippingLoaded]=useState(false);
  const [configuration, setConfiguration] = useState<Configuration>(() => initial(draftId?undefined:initialCourseId,draftId?undefined:initialPreset,draftId?undefined:initialSample));
  const [courses, setCourses] = useState<Academy2Course[]>([]);
  const [saved, setSaved] = useState<SalesPlanDraft | null>(null);
  const [step, setStep] = useState(()=>({1:0,2:1,3:2,4:4,5:5,6:6}[Number(query.get("step")) as 1|2|3|4|5|6]??0));
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [formPreview, setFormPreview] = useState(false);
  const [formOrder, setFormOrder] = useState(false);
  const stableId = useRef(draftId ?? "");
  const revision = useRef(0);
  const lock = useRef(false);
  const dragged = useRef<string | null>(null);
  const generation = useRef(0);
  const href = (path: string) => toAcademyContextHref(path, headquartersId, "manage");
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setLoaded(false); setError("");
    Promise.all([listAcademy2Courses(headquartersId), draftId ? getSalesPlanDraft(headquartersId, draftId) : Promise.resolve(null)])
      .then(([catalog, row]) => { if (generation.current !== current) return; setCourses(catalog); setSaved(row); if (row) { setConfiguration(row.configuration.kind==='全講座'?{...row.configuration,catalog_course_ids:row.configuration.catalog_course_ids??row.course_snapshot.map(c=>c.course_id)}:row.configuration); revision.current = row.revision; stableId.current = row.id; } else if (!stableId.current) stableId.current = crypto.randomUUID(); setDirty(false); setLoaded(true); })
      .catch(cause => { if (generation.current === current) setError(cause instanceof Error ? cause.message : "下書きを読み込めませんでした。"); })
      .finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current++; };
  }, [headquartersId, draftId, retry]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty, saving]);
  function patch(change: Partial<Configuration>) { setConfiguration(value => ({ ...value, ...change })); setDirty(true); setError(""); }
  function reorder(id: string, target: number) { const ids = [...configuration.course_ids]; const from = ids.indexOf(id); if (from < 0 || target < 0 || target >= ids.length) return; ids.splice(from, 1); ids.splice(target, 0, id); patch({ course_ids: ids }); }
  function remove(id: string) { const prices = { ...configuration.stage_prices }; delete prices[id]; patch({ course_ids: configuration.course_ids.filter(value => value !== id), stage_prices: prices }); }
  function leave(event: React.MouseEvent<HTMLAnchorElement>) { if ((dirty || saving) && !window.confirm("未保存の内容があります。この画面を離れますか？")) event.preventDefault(); }
  const selectedIds=configuration.kind==='月額レッスン'?[...new Set((configuration.monthly?.months??[]).flatMap(item=>item.course_ids))]:configuration.kind==='全講座'?(configuration.catalog_course_ids??saved?.course_snapshot.map(item=>item.course_id)??[]):configuration.course_ids;
  const selected = selectedIds.map(id => courses.find(course => course.id === id));
  const reference = selected.length && selected.every(course => course?.reference_price != null) ? selected.reduce((sum, course) => sum + course!.reference_price!, 0) : null;
  const stageValues = configuration.course_ids.map(id => configuration.stage_prices[id]);
  const price = configuration.purchase_mode === "all" ? configuration.price : stageValues.length && stageValues.every(value => value != null) ? stageValues.reduce<number>((sum, value) => sum + value!, 0) : null;
  const after = configuration.after ?? emptyAfter;
  useEffect(()=>{if(!sixStep||!loaded)return;let live=true;setShippingLoaded(false);setShippingError('');readCourseShipping(headquartersId,selectedIds).then(rows=>{if(live){setShippingRows(rows);setShippingLoaded(true);}}).catch(e=>{if(live)setShippingError(e.message);});return()=>{live=false;};},[sixStep,loaded,headquartersId,JSON.stringify(selectedIds),shippingRefresh]);
  const courseKit=sixStep&&shippingLoaded?deriveCourseKit(shippingRows):null;
  const kit: NonNullable<Configuration["kit"]> = courseKit??configuration.kit??{enabled:false,methods:[]};
  const effectiveConfiguration={...configuration,kit};
  const reviewIssues=sixStep?[...(!selectedIds.length?[{label:'講座を選択してください',step:0}]:[]),...(!shippingLoaded||shippingRows.some(r=>!r.configuration)?[{label:'選択講座の発送物設定を保存してください',step:0}]:[]),...(configuration.price==null?[{label:'販売価格を入力してください',step:2}]:[]),...(!configuration.payment_methods?.length?[{label:'支払い方法を選択してください',step:2}]:[]),...(configuration.study_style!=='materials_only'&&!configuration.allowed_methods?.length?[{label:'開催方法を選択してください',step:1}]:[]),...(!configuration.terms?.body||!configuration.terms?.version?[{label:'申込規約とバージョンを入力してください',step:5}]:[])]:[];
  const fields = configuration.application_form?.fields ?? baseFields;
  function fieldsChange(next: Question[]) { patch({ application_form: { ...configuration.application_form, conditionalVersion: 1, fields: next } }); }
  async function save(notify = true): Promise<SalesPlanDraft | null> {
    if (lock.current) return null;
    if(sixStep&&!shippingLoaded){setError('発送物の読み込みを確認してください。');return null;}
    const formErrors=applicationFormErrors(fields); if(formErrors.length){setError(formErrors.join(" "));return null;}
    if(configuration.kind==='月額レッスン'){
      const invalid=monthlyPolicyMessages(configuration.monthly).filter(issue=>Object.hasOwn(configuration.monthly??{},issue.path.replace('monthly.','')));
      if(invalid.length){setError(invalid.map(issue=>issue.message).join(' '));return null;}
    }
    lock.current = true; setSaving(true); setError("");
    const current = generation.current;
    try {
      const row = await saveSalesPlanDraft(headquartersId, stableId.current, revision.current, {...effectiveConfiguration,...(sixStep?{after:{...after,record_completion:true}}:{}),application_form:{fields,conditionalVersion:1}});
      if (current !== generation.current) return null;
      revision.current = row.revision; setSaved(row); setConfiguration(row.configuration.kind==='全講座'?{...row.configuration,catalog_course_ids:row.configuration.catalog_course_ids??row.course_snapshot.map(c=>c.course_id)}:row.configuration); setDirty(false); if (notify) onSaved?.(row); return row;
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : "保存できませんでした。入力内容は残っています。"); return null; }
    finally { lock.current = false; if (current === generation.current) setSaving(false); }
  }
  async function pageAction(action: SalesPlanPageAction) {
    if (!onPageAction) return;
    const row = dirty || !saved ? await save(false) : saved;
    if (!row) return;
    try { await onPageAction(action, row); } catch (cause) { setError(cause instanceof Error ? cause.message : "販売ページを開けませんでした。下書きは保存されています。"); }
  }
  function Choice({ active, title, description, onClick, type = "study-choice" }: { active: boolean; title: string; description?: string; onClick: () => void; type?: string }) { return <button type="button" className={cx(type, active && "on")} aria-pressed={active} onClick={onClick}>{type === "after-choice" && <span className={styles["after-check"]} aria-hidden="true" />}{type === "toggle-row" && <span className={styles["toggle-box"]} aria-hidden="true" />}<div><strong>{title}</strong>{description && <p>{description}</p>}</div></button>; }
  if (loading) return <p role="status">販売プランを読み込み中…</p>;
  if (!loaded || !stableId.current) return <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>再読み込み</button></div>;
  return <div className={`${styles.root} ${sixStep?styles.sixStepReview:""}`}><main className={styles.wrap}>
    <a className={styles.back} href={href("/academy/offerings")} onClick={leave}>← 販売プラン一覧へ</a>
    <div className={styles.titlebar}><div className={styles.en}>COURSE</div><div className={styles.jp}>{configuration.kind}をつくる</div></div>
    {!draftId&&initialSample&&<p className={styles.note}>見本の名前と金額を入力しています。講座と条件を確認して、ご自身の販売プランとして保存してください。</p>}
    <LocalReviewControls headquartersId={headquartersId}/><div className={styles.intro}><strong>質問に答えていけば、販売プランが完成します。</strong><p>選んだ内容に必要な設定だけを表示します。</p></div>
    <div className={styles.steps} aria-label="作成STEP">{names.map((name, i) => <button key={name} type="button" className={cx("step", navigation[i] === step && "on", navigation[i] < step && "done")} aria-current={navigation[i] === step ? "step" : undefined} onClick={() => setStep(navigation[i])}>{i + 1} {name}</button>)}</div>
    <div className={styles.layout}><section className={styles.card}><h2>{sixStep&&step===2?"金額と支払い方法を決める":headings[step]}</h2><div className={styles.help}>{help[step]}</div>
      <fieldset disabled={saving}>
      <SalesPlanTypeFields headquartersId={headquartersId} step={step} configuration={configuration} courses={courses} saved={saved} patch={patch}/>
      {step === 0 && !['全講座','月額レッスン'].includes(configuration.kind) && <><h3>選択済み講座</h3><div className={styles["course-list"]}>{selected.map((course, i) => { const id = configuration.course_ids[i]; return <div key={id} className={cx("course", expanded.includes(id) && "open")} draggable onDragStart={() => { dragged.current = id; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged.current) reorder(dragged.current, i); dragged.current = null; }}>
        <div className={styles.order}><span className={styles.drag}>☰</span><button aria-label={`${course?.name ?? "講座"}を上へ`} disabled={i === 0} onClick={() => reorder(id, i - 1)}>↑</button><button aria-label={`${course?.name ?? "講座"}を下へ`} disabled={i === selected.length - 1} onClick={() => reorder(id, i + 1)}>↓</button></div>
        <div className={styles.thumb} style={course?.main_image_url ? { backgroundImage: `url(${JSON.stringify(course.main_image_url)})` } : undefined}>{String(i + 1).padStart(2, "0")}</div>
        <button className={styles.courseChoice} onClick={() => setExpanded(value => toggle(value, id))} aria-expanded={expanded.includes(id)}><strong>{course?.name ?? "講座情報を確認してください"}</strong><small>{course?.lesson_count ?? "—"}レッスン・教材数確認中<span className={styles["course-price"]}>参考価格 {yen(course?.reference_price)}</span></small></button>
        <button className={styles.remove} aria-label={`${course?.name ?? "講座"}を外す`} onClick={() => remove(id)}>×</button>
        <div className={styles["course-details"]}><b>講座内容</b><p>{course?.description || "講座の編集画面で内容を確認できます。"}</p><a href={href(`/academy/courses/${id}${sixStep?`?salesPlanReview=${draftId??"new"}`:""}`)} onClick={leave}>講座を確認 →</a></div>
      </div>; })}</div>
      <button className={styles.add} disabled={configuration.kind==='単品講座'&&selected.length>=1} onClick={() => setPicker(value => !value)}>＋ 講座を追加</button>
      {picker && <div className={styles.conditional}><label>講座を検索<input value={search} onChange={event => setSearch(event.target.value)} /></label>{courses.filter(course => !configuration.course_ids.includes(course.id) && course.name.includes(search)).map(course => <button key={course.id} className={styles["form-row"]} disabled={configuration.kind==='単品講座'&&configuration.course_ids.length>=1} onClick={() => {patch({ course_ids: configuration.kind==='単品講座'?[course.id]:[...configuration.course_ids, course.id] });if(sixStep)setPicker(false);}}><strong>{course.name}</strong><p>{course.lesson_count ?? "—"}レッスン · 参考価格 {yen(course.reference_price)}</p></button>)}{courses.length === 0 && <p>講座がありません。講座一覧から作成してください。</p>}</div>}
      <div className={styles.note}>この順番は講座単位です。各講座内のレッスン・教材の順番は、それぞれの「講座」編集で管理します。</div></>}
      {step === 1 && <>{configuration.kind==='ワークショップ'&&<p className={styles.note}>ワークショップは開催を作成して募集します。日時・受付方法・担当者・定員は開催側で設定します。</p>}<div className={styles["study-options"]}><Choice active={configuration.study_style !== "materials_only"} title="先生から受講する" description="対面やオンラインで、先生から直接レッスンを受けます。" onClick={() => patch({ study_style: "instructor" })} /><Choice active={configuration.study_style === "materials_only"} title="教材だけで学ぶ" description="動画・PDF・文章などを使って、自分で学びます。" onClick={() => patch({ study_style: "materials_only", materials: { ...configuration.materials, enabled: true, starts: "from_start" } })} /></div>
      {configuration.study_style !== "materials_only" ? <div className={styles.conditional}><h3>この販売プランで利用できる開催方法</h3><div className={styles["method-options"]}>{([ ["in_person", "対面", "会場で受講できるようにします。"], ["online", "オンライン", "Zoom等で受講できるようにします。"]] as const).map(([value, title, description]) => <Choice key={value} type="method-choice" active={(configuration.allowed_methods ?? []).includes(value)} title={title} description={description} onClick={() => patch({ allowed_methods: toggle(configuration.allowed_methods ?? [], value) })} />)}</div><h3>レッスン教材も使いますか？</h3>{([["none", "使わない", "受講者には教材を公開しません。"], ["from_start", "受講前から見せる", "講座中に一緒に使う場合もこちらです。"], ["after_attendance", "受講後に見せる", "復習教材として受講後から利用できます。"]] as const).map(([value, title, description]) => <label key={value} className={styles["radio-line"]}><input type="radio" name="materials" checked={value === "none" ? !configuration.materials?.enabled : !!configuration.materials?.enabled && configuration.materials.starts === value} onChange={() => patch({ materials: value === "none" ? { ...configuration.materials, enabled: false } : { ...configuration.materials, enabled: true, starts: value } })} /><span><b>{title}</b><br /><small>{description}</small></span></label>)}</div> : <div className={styles.conditional}><h3>レッスン教材について</h3><div className={styles.help}>講座に設定されているレッスン・教材・順番を使います。開催の登録は必要ありません。</div></div>}
      {!sixStep&&<div className={styles["kit-panel"]}><h3>受講に必要なキット・発送物はありますか？</h3><Choice type="toggle-row" active={kit.enabled} title="キット・発送物あり" description="材料セット、道具、冊子などを受講者へ渡す場合に設定します。" onClick={() => patch({ kit: { ...kit, enabled: !kit.enabled } })} />{kit.enabled && <div className={styles.conditional}><label>キット・発送物の名前<input value={kit.name ?? ""} onChange={event => patch({ kit: { ...kit, name: event.target.value } })} /></label><label>キットの受取人<select value={kit.recipient??''} onChange={event=>patch({kit:{...kit,recipient:event.target.value as 'learner'|'instructor'}})}><option value="" disabled>選択してください</option><option value="learner">受講者</option><option value="instructor">担当講師</option></select></label><h3>受け渡し方法</h3><div className={styles["method-options"]}>{([["shipping", "事前に発送", "オンライン受講など、開催前に受講者へ送ります。"], ["venue_handover", "会場で手渡し", "対面開催で、当日に直接お渡しします。"]] as const).map(([value, title, description]) => <Choice key={value} type="method-choice" active={kit.methods.includes(value)} title={title} description={description} onClick={() => patch({ kit: { ...kit, methods: toggle(kit.methods, value) } })} />)}</div><p className={styles.help}>両方選べます。実際にどちらで渡すかは、各「開催」で決めます。</p></div>}<p className={styles.help}>※ 講師が認定講座を開講するときに本部へ注文する「開講用キット」とは別の設定です。</p></div>
      }{sixStep&&<section className={styles.note}><h3>講座の発送物</h3>{selected.map((course,i)=>{const row=shippingRows.find(r=>r.course_id===selectedIds[i]);return <p key={selectedIds[i]}>{course?.name}：{row?.configuration?row.configuration.enabled?`発送物あり（${row.configuration.name}）`:'発送物なし':'発送物の有無が未設定'} <a href={href(`/academy/courses/${selectedIds[i]}?salesPlanReview=${draftId??"new"}`)} onClick={leave}>講座側で設定する →</a></p>;})}<button type="button" onClick={()=>setShippingRefresh(v=>v+1)}>発送物を再確認</button>{shippingError&&<p role="alert">{shippingError}</p>}{!courseKit&&configuration.kit?.enabled&&<p>講座側の設定が揃うまで、既存の販売プランのキット設定を保持しています。</p>}</section>}<div className={styles["schedule-note"]}><b>日程・受付方法・担当者・定員は、作成後に「開催」で設定します。</b></div></>}
      {step === 2 && <><div className={styles["price-summary"]}><div className={styles["price-head"]}>選んだ講座の単品参考価格</div>{selected.map((course, i) => <div key={selectedIds[i]} className={styles["price-row"]}><span>{course?.name ?? "講座情報を確認"}</span><b>{yen(course?.reference_price)}</b></div>)}<div className={styles["price-total"]}><span>参考価格合計</span><strong>{yen(reference)}</strong></div></div>
      {configuration.kind==="コース"&&<div className={styles["billing-model"]}><Choice type="billing-choice" active={configuration.purchase_mode === "all"} title="コースまとめて料金" description="コース全体の価格を決めて、まとめて販売します。" onClick={() => patch({ purchase_mode: "all", stage_prices: {} })} /><Choice type="billing-choice" active={configuration.purchase_mode === "staged"} title="講座ごとに料金" description="前の講座を修了後、次の講座ごとに購入する方式です。" onClick={() => patch({ purchase_mode: "staged" })} /></div>}
      {configuration.purchase_mode === "all" ? <div className={styles.field}><label htmlFor="course-price">{configuration.kind==='月額レッスン'?'月額料金':configuration.kind==='コース'?'コース販売価格':'販売価格'}</label><div className={styles["input-wrap"]}><span>¥</span><input id="course-price" type="number" min="0" step="1" value={configuration.price ?? ""} onChange={event => patch({ price: event.target.value === "" ? null : Number(event.target.value) })} /></div></div> : <><div className={styles["price-summary"]}><div className={styles["price-head"]}>このコースでの価格</div>{selected.map((course, i) => { const id = configuration.course_ids[i]; return <div key={id} className={styles["price-row"]}><label htmlFor={`price-${id}`}>{String(i + 1).padStart(2, "0")} {course?.name}<small> 参考価格 {yen(course?.reference_price)}</small></label><input id={`price-${id}`} aria-label={`${course?.name} このコースでの価格`} type="number" min="0" step="1" value={configuration.stage_prices[id] ?? ""} onChange={event => patch({ stage_prices: { ...configuration.stage_prices, [id]: event.target.value === "" ? null : Number(event.target.value) } })} /></div>; })}<div className={styles["price-total"]}><span>コース内合計</span><strong>{yen(price)}</strong></div></div><div className={styles.note}>これはクレジットカードの分割払いではありません。前の講座を修了し、次の講座のお支払い確認後に次へ進みます。</div></>}
      {reference != null && price != null && <div className={styles.discount}>{price < reference ? `参考合計より ${yen(reference - price)} お得` : price > reference ? `参考合計より ${yen(price - reference)} 高い設定` : "参考価格の合計と同額"}</div>}{reference != null && price != null && price > 0 && price < reference * .65 && <div className={cx("price-warning", "show")}><b>参考価格より大きく下回っています。</b><br />入力間違いや必要な費用が含まれているか確認してください。</div>}</>}
      {step === 2&&sixStep&&<ReviewPaymentSettings headquartersId={headquartersId} configuration={configuration} patch={patch}/>}
      {step === 3 && !sixStep && <div className={styles["pay-options"]}>{([["card", "カード決済", "Academy上でクレジットカード決済を受け付けます。"], ["bank", "銀行振込", "受講者に振込先を案内します。"], ["external", "外部の決済サービスを使う", "Squareなど、すでに利用している決済ページへ案内します。"]] as const).filter(([value])=>configuration.kind!=='月額レッスン'||value==='card').map(([value, title, description]) => <label key={value} className={styles["pay-option"]}><input type="checkbox" checked={(configuration.payment_methods ?? []).includes(value)} onChange={() => patch({ payment_methods: toggle(configuration.payment_methods ?? [], value) })} /><div><strong>{title}</strong><p>{description}</p></div></label>)}{configuration.payment_methods?.includes("external") && <div className={styles["pay-config"]}>{(configuration.purchase_mode === "staged" ? configuration.course_ids : ["plan"]).map(id => <div className={styles.field} key={id}><label>決済URL {courses.find(course => course.id === id)?.name ?? "販売プラン"}<input type="url" value={configuration.external_payment_urls?.[id] ?? ""} onChange={event => patch({ external_payment_urls: { ...configuration.external_payment_urls, [id]: event.target.value } })} /></label></div>)}</div>}</div>}
      {step === 4 && (sixStep?<AfterCourseWizard headquartersId={headquartersId} configuration={configuration} patch={patch} onComplete={()=>setStep(5)}/>:<SalesPlanAfterStep headquartersId={headquartersId} configuration={configuration} patch={patch} onSave={()=>save()}/>)}
      {step === 5 && <div className={styles["form-panel"]}>
        <h3>固定項目・本部が追加した質問</h3><div className={styles["form-builder"]}>{fields.map((field, index) => {
          const fixed = ["name", "email", "terms"].includes(field.id);
          return <div key={field.id} className={styles["form-row"]}>
            {baseFields.some(base => base.id === field.id) ? <><strong>{field.label}{field.required && <span className={styles["form-badge"]}>必須</span>}</strong><p>{({ name: "申込者のお名前", email: "申込確認や連絡に使用します。", phone: "必要な場合のみ入力してもらいます。", notes: "受講前に伝えておきたいことを入力できます。", terms: "申込フォームの最後に表示します。" } as Record<string, string>)[field.id]}</p></> : <div className={styles["customer-field"]}><label htmlFor={`question-${field.id}`}>質問</label><input id={`question-${field.id}`} aria-label="質問文" value={field.label} onChange={event => fieldsChange(fields.map(item => item.id === field.id ? { ...item, label: event.target.value } : item))} /></div>}
            {!fixed && <label className={styles["radio-line"]}><input type="checkbox" checked={field.required} onChange={() => fieldsChange(fields.map(item => item.id === field.id ? { ...item, required: !item.required } : item))} />必須</label>}
            {!baseFields.some(base=>base.id===field.id) && <>
              <div className={styles["customer-field"]}><label htmlFor={`type-${field.id}`}>回答形式</label><select id={`type-${field.id}`} aria-label="回答形式" value={field.type} onChange={event=>fieldsChange(fields.map(item=>item.id===field.id?{...item,type:event.target.value as Question['type'],options:event.target.value==='select'?(item.options??['はい','いいえ']):undefined}:item))}><option value="text">短い文章</option><option value="textarea">長い文章</option><option value="select">選択肢</option></select></div>
              {field.type==='select' && <div className={styles["customer-field"]}><label htmlFor={`options-${field.id}`}>選択肢（1行に1つ）</label><textarea id={`options-${field.id}`} aria-label="選択肢" value={(field.options??[]).join('\n')} onChange={event=>fieldsChange(fields.map(item=>item.id===field.id?{...item,options:event.target.value.split('\n')}:item))}/></div>}
              <div className={styles["customer-field"]}><label htmlFor={`condition-${field.id}`}>この質問を表示する条件</label><select id={`condition-${field.id}`} aria-label="質問の表示条件" value={field.condition?.source??'always'} onChange={event=>fieldsChange(fields.map(item=>item.id!==field.id?item:{...item,condition:event.target.value==='always'?undefined:{source:event.target.value as NonNullable<Question['condition']>['source'],value:({format:'in_person',schedule_mode:'arranged_after_application',kit_shipping:'true',certificate:'true',course:configuration.course_ids[0]??'',answer:''} as Record<string,string>)[event.target.value],...(event.target.value==='answer'?{field_id:fields.slice(0,index).find(f=>!['name','email','terms'].includes(f.id))?.id??''}:{})}}))}><option value="always">いつも表示</option><option value="format">開催方法に応じて</option><option value="schedule_mode">日程の決め方に応じて</option><option value="kit_shipping">キットの発送が必要なとき</option><option value="certificate">証書を発行するとき</option><option value="course">特定の講座を含むとき</option><option value="answer">前の質問への回答に応じて</option></select></div>
              {field.condition && <div className={styles.conditional}>
                {field.condition.source==='answer' && <label>条件にする質問<select aria-label="条件にする質問" value={field.condition.field_id??''} onChange={event=>fieldsChange(fields.map(item=>item.id===field.id?{...item,condition:{...item.condition!,field_id:event.target.value}}:item))}><option value="">選択してください</option>{fields.slice(0,index).filter(item=>!['name','email','terms'].includes(item.id)).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
                {['format','schedule_mode','course'].includes(field.condition.source)?<label>表示する場合<select aria-label="条件の値" value={field.condition.value} onChange={event=>fieldsChange(fields.map(item=>item.id===field.id?{...item,condition:{...item.condition!,value:event.target.value}}:item))}>{field.condition.source==='format'?<><option value="in_person">対面</option><option value="online">オンライン</option></>:field.condition.source==='schedule_mode'?<><option value="arranged_after_application">申込後に日程相談</option><option value="fixed">開催日決定済み</option></>:<><option value="">講座を選択してください</option>{selected.filter(Boolean).map(course=><option key={course!.id} value={course!.id}>{course!.name}</option>)}</>}</select></label>:field.condition.source==='answer'?<label>この回答と一致したとき<input aria-label="条件の回答" value={field.condition.value} onChange={event=>fieldsChange(fields.map(item=>item.id===field.id?{...item,condition:{...item.condition!,value:event.target.value}}:item))}/></label>:null}
                <p>条件に合わない場合、この質問は表示せず回答も保存しません。</p>
              </div>}
              <button type="button" onClick={()=>fieldsChange(fields.filter(item=>item.id!==field.id))}>この質問を削除</button>
            </>}
            {formOrder && <><button disabled={index === 0} onClick={() => { const next = [...fields]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; fieldsChange(next); }}>↑</button><button disabled={index === fields.length - 1} onClick={() => { const next = [...fields]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; fieldsChange(next); }}>↓</button></>}
          </div>;
        })}</div>
        <div className={styles["auto-fields"]}>
          <h3>{sixStep?"STEP1〜4と開催設定から自動追加される質問":"STEP1〜5と開催設定から自動追加される質問"}</h3>
          <p>販売プラン側で同じ質問を作る必要はありません。申込者が選んだ開催・受付方法に合わせて表示します。</p>
          {configuration.study_style !== "materials_only" && <div className={styles["auto-item"]}><b>「申込後に日程相談」を選んだ場合</b>「日程はお申込み後、本部と相談して決定します」と案内し、第1〜第3希望日・希望時間帯・補足を表示します。</div>}
          {kit.enabled && kit.methods.includes("shipping") && kit.recipient !== "instructor" && <div className={styles["auto-item"]}><b>受講者への事前発送が必要な場合</b>発送先を追加します。対面で当日手渡しのみなら表示しません。</div>}
          {after.instructor_license&&<div className={styles["auto-item"]}><b>講師制度を設定した場合</b>活動には受講後の登録・契約・条件確認が必要であることへの確認を追加します。申込時の回答は活動希望や契約同意の代わりにはなりません。</div>}{after.certificate && <div className={styles["auto-item"]}><b>証書を発行する場合</b>証書記載名を追加し、現物発送なら必要な発送情報も表示します。</div>}
        </div>
        <div className={styles["form-actions"]}><button onClick={() => fieldsChange([...fields, { id: crypto.randomUUID(), label: "", type: "text", required: false }])}>＋ 質問を追加</button><button onClick={() => setFormOrder(value => !value)}>項目の並び替え</button></div>
        <button type="button" className={styles["preview-form-btn"]} onClick={() => setFormPreview(true)}>受講者の申込フォームをプレビュー →</button>
        <div className={styles["customer-field"]}><label htmlFor="application-terms">申込規約</label><textarea id="application-terms" value={configuration.terms?.body ?? ""} onChange={event => patch({ terms: { ...configuration.terms, version: configuration.terms?.version ?? "", body: event.target.value } })} /></div>
        <div className={styles["customer-field"]}><label htmlFor="application-terms-version">規約バージョン</label><input id="application-terms-version" value={configuration.terms?.version ?? ""} onChange={event => patch({ terms: { body: configuration.terms?.body ?? "", version: event.target.value } })} /></div>
      </div>}
      {step === 6 && <div className={styles["review-panel"]}>{sixStep&&<section aria-label="不足設定"><h3>公開前の確認</h3>{reviewIssues.map(issue=><p key={issue.label}>{issue.label} <button type="button" onClick={()=>setStep(issue.step)}>STEP{navigation.indexOf(issue.step)+1}へ戻る</button></p>)}<p>保存だけでは公開・課金・権限付与は行いません。販売ページ側でも契約・開催・後続業務の公開条件を確認します。</p></section>}<div className={styles.field}><label>販売プラン名<input maxLength={200} value={configuration.title} onChange={event => patch({ title: event.target.value })} /></label></div><div className={styles["review-grid"]}>{[["販売タイプ", configuration.kind, `${selected.length}講座を順番に受講`], ["受講スタイル", configuration.study_style === "materials_only" ? "レッスン教材だけで学ぶ" : "先生から受講", configuration.study_style === "materials_only" ? "開催の登録は不要" : (configuration.allowed_methods ?? []).map(value => value === "in_person" ? "対面" : "オンライン").join("・")], ["講座構成", `${selected.length}講座`, selected.map(course => course?.name ?? "講座情報を確認").join(" → ")], ["金額", yen(price), ""], ["支払い", (configuration.payment_methods ?? []).map(value => ({ card: "カード", bank: "銀行振込", external: "外部決済", onsite: "現地払い" })[value]).join("・") || "未設定", ""], ["申込フォーム", `${fields.length}項目`, ""]].map(([title, value, note]) => <div key={title} className={styles["review-box"]}><b>{title}</b><strong>{value}</strong>{note && <p>{note}</p>}</div>)}</div>{sixStep?<WizardSummary configuration={configuration}/>:<AfterCourseSummary configuration={configuration}/>}{configuration.kind==='月額レッスン'&&<MonthlyPolicySummary monthly={configuration.monthly} showIssues/>}<div className={styles.ready}><b>{sixStep?"設定と公開条件を確認して販売ページを準備します。":"この内容だけでも販売ページとして使えます。"}</b><br />販売プランの情報から標準ページを自動生成します。</div><div className={styles["launch-options"]}>{([["standard", "このまま使う", "標準ページをそのまま利用します。", "標準ページを確認 →", "plain"], ["builder", "ビルダーでカスタム", "標準ページを土台に、配置・写真・文章・セクションを自由に編集します。", "ビルダーで編集 →", "builder"], ["template", "テンプレートから作る", "完成テンプレートに販売プランの内容を流し込みます。", "テンプレートを選ぶ →", "template"]] as const).map(([action, title, note, label, className]) => <div key={action} className={styles["launch-card"]}><strong>{title}</strong><p>{note}</p><button className={styles[className]} disabled={!onPageAction || saving} onClick={() => void pageAction(action)}>{label}</button></div>)}</div>{!onPageAction && <p className={styles.help}>販売ページへの接続を準備しています。下書きは保存できます。</p>}</div>}
      </fieldset>
      <div className={styles.actions}><button className={styles["back-step"]} disabled={saving} onClick={() => step > 0 ? setStep(navigation[Math.max(0,navigation.indexOf(step)-1)]) : window.location.assign(href("/academy/offerings"))}>← 戻る</button>{step < 6 ? <button className={styles.next} onClick={() => setStep(navigation[navigation.indexOf(step)+1])}>次へ：{names[navigation.indexOf(step)+1]} →</button> : <button className={styles.next} disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "販売プランを保存"}</button>}</div>
      <div role="status" className={styles.status}>{saving ? "保存中…" : dirty ? "未保存の変更があります" : saved ? "保存しました" : "未保存"}</div>{error && <p role="alert" className={styles.error}>{error}</p>}
    </section><aside className={cx("card", "preview")}><div className={styles["preview-label"]}>現在選んでいる講座</div>{selected.map((course, index) => <Fragment key={selectedIds[index]}>{index > 0 && <div className={styles.down}>↓</div>}<div className={styles.pitem}><b>COURSE {String(index + 1).padStart(2, "0")}</b><strong>{course?.name ?? "講座情報を確認"}</strong><span>{course?.subtitle ?? ""}{sixStep&&<> / 参考価格 {yen(course?.reference_price)}</>}</span></div></Fragment>)}</aside></div>
  </main>{formPreview && <SalesPlanApplicationPreview configuration={{...effectiveConfiguration,course_ids:selectedIds}} fields={fields} onClose={() => setFormPreview(false)} />}</div>;
}



