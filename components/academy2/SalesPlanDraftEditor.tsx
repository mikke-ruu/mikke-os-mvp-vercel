"use client";
import {CreationReturnLink} from './CreationReturnLink';
import {CreationRelations} from './CreationRelations';

import { AcademyManagementActions } from './AcademyManagementActions';
import {useRouter,useSearchParams} from "next/navigation";
import {LocalReviewControls} from "./LocalReviewControls";
import { Fragment, useEffect, useRef, useState } from "react";
import { getSalesPlanDraft, saveSalesPlanDraft, type SalesPlanDraft, type SalesPlanDraftConfiguration } from "@/lib/academy2/sales-plan-drafts";
import { listAcademy2Courses, type Academy2Course } from "@/lib/academy2/courses";
import {seedNewPlanFromCourse} from '@/lib/academy2/course-plan-initial';
import { toAcademyContextHref } from "@/lib/academy/access-context";
import styles from "./SalesPlanDraftEditor.module.css";
import {SalesPlanCourseConfirmation} from './SalesPlanCourseConfirmation';
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
const steps = ["講座を選ぶ", "受講スタイル", "金額", "支払い", "受講後", "申込フォーム", "確認・販売ページ"];
const headings = ["講座を選んで、受講する順番を決める", "受講方法を選んでください", "このコースの金額を決める", "支払い方法を決める", "受講後の設定", "申込フォームの設定", "販売プランの確認"];
const help = ["作成済みの講座から選び、そのままドラッグして受講する順番に並べます。講座を押すと内容を確認できます。", "", "講座の参考価格を見ながら、販売価格を設定します。", "受講者が使える支払い方法を選びます。必要な方法だけ設定してください。", "", "申込時に入力してもらう項目を設定します。", ""];
const baseFields: Question[] = [{ id: "name", label: "お名前", type: "text", required: true }, { id: "email", label: "メールアドレス", type: "email", required: true }, { id: "phone", label: "電話番号", type: "tel", required: false }, { id: "notes", label: "備考・質問", type: "textarea", required: false }, { id: "terms", label: "申込規約への同意", type: "agreement", required: true }];
const emptyAfter: NonNullable<Configuration["after"]> = { skill_certification: false, commercial_license: false, instructor_license: false };
const yen = (n: number | null | undefined) => n == null ? "未設定" : `¥${n.toLocaleString("ja-JP")}`;
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).map(n => styles[n as string]).join(" ");
const sortedConfiguration=(value:unknown):unknown=>Array.isArray(value)?value.map(sortedConfiguration):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,sortedConfiguration(item)])):value;
const toggle = <T,>(items: T[], value: T) => items.includes(value) ? items.filter(item => item !== value) : [...items, value];
function initial(courseId?: string,preset?:SalesPlanPreset,sample?:SalesPlanSample): Configuration {
  const example=salesPlanSamples.find(item=>item.id===sample);const selectedPreset=preset??sample??(courseId?'single':'course');const kind=salesPlanPresetKind(selectedPreset);
  return { title: example?.title??"", kind, course_ids: courseId&&!['全講座','月額レッスン'].includes(kind) ? [courseId] : [], price: example?.price??null, purchase_mode: "all", stage_prices: {}, study_style: "instructor", allowed_methods: [], materials: { enabled: false }, payment_methods: [], after: { ...emptyAfter, skill_certification:selectedPreset==='certification',record_completion: true }, terms: { version: "", body: "" }, show_course_introductions: true,...(kind==='全講座'?{catalog_course_ids:[]}:{ }),...(kind==='月額レッスン'?{monthly:{months:[],period:{kind:'unlimited'},past_access:'from_join_month',...recommendedMonthlyPolicies()}}:{}) };
}

/** UI-05 v0.9 base, with STEP6 preview aligned to v0.10. Business data remains in the versioned draft RPC; no publication side effects. */
export function SalesPlanDraftEditor({ headquartersId, draftId, initialCourseId, initialPreset, initialSample, onSaved, onPageAction }: Props) {
  const query=useSearchParams();
  const router=useRouter();
  const resumedDraftId=useRef(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.get('savedDraft')??'')?query.get('savedDraft')!:undefined);
  const loadedDraftId=draftId??resumedDraftId.current;
  const [offerEvent,setOfferEvent]=useState(query.get('saved')==='1');
  const sixStep=true;
  const navigation=sixStep?[0,1,2,4,5,6]:[0,1,2,3,4,5,6];
  const names=sixStep?['講座を選ぶ','受講スタイル','金額・支払い','受講後','申込フォーム','確認・販売ページ']:steps;
  const [shippingRows,setShippingRows]=useState<CourseShippingRow[]>([]),[shippingError,setShippingError]=useState(''),[shippingLoaded,setShippingLoaded]=useState(false),[shippingRetry,setShippingRetry]=useState(0);
  const [confirmCourseId,setConfirmCourseId]=useState<string|null>(null);
  const [saveOutcome,setSaveOutcome]=useState<'idle'|'success'|'failed'|'unconfirmed'>('idle');
  const [configuration, setConfiguration] = useState<Configuration>(() => initial(loadedDraftId?undefined:initialCourseId,loadedDraftId?undefined:initialPreset,loadedDraftId?undefined:initialSample));
  const [courses, setCourses] = useState<Academy2Course[]>([]);
  const [saved, setSaved] = useState<SalesPlanDraft | null>(null);
  const [step, setStep] = useState(()=>({1:0,2:1,3:2,4:4,5:5,6:6}[Number(query.get("step")) as 1|2|3|4|5|6]??0));
  const lastShippingStep=useRef(step);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [formPreview, setFormPreview] = useState(false);
  const [afterReady, setAfterReady] = useState(false);
  const [formOrder, setFormOrder] = useState(false);
  const stableId = useRef(loadedDraftId ?? "");
  const revision = useRef(0);
  const lock = useRef(false);
  const dragged = useRef<string | null>(null);
  const generation = useRef(0);
  const href = (path: string) => toAcademyContextHref(path, headquartersId, "manage");
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setLoaded(false); setError("");
    Promise.all([listAcademy2Courses(headquartersId), loadedDraftId ? getSalesPlanDraft(headquartersId, loadedDraftId) : Promise.resolve(null)])
      .then(([catalog, row]) => { if (generation.current !== current) return; setCourses(catalog); setSaved(row); if (row) { setConfiguration(row.configuration.kind==='全講座'?{...row.configuration,catalog_course_ids:row.configuration.catalog_course_ids??row.course_snapshot.map(c=>c.course_id)}:row.configuration); revision.current = row.revision; stableId.current = row.id; } else if (!stableId.current) { if(initialCourseId){const source=catalog.find(course=>course.id===initialCourseId);if(!source)throw new Error('選択した講座を確認できません。講座一覧から選び直してください。');setConfiguration(value=>seedNewPlanFromCourse(value,source));}stableId.current = crypto.randomUUID(); } setDirty(false); setLoaded(true); })
      .catch(cause => { if (generation.current === current) setError(cause instanceof Error ? cause.message : "下書きを読み込めませんでした。"); })
      .finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current++; };
  }, [headquartersId, loadedDraftId, retry]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty, saving]);
  function patch(change: Partial<Configuration>) { setConfiguration(value => ({ ...value, ...change })); setDirty(true); setError(""); setSaveOutcome('idle'); }
  function reorder(id: string, target: number) { const ids = [...configuration.course_ids]; const from = ids.indexOf(id); if (from < 0 || target < 0 || target >= ids.length) return; ids.splice(from, 1); ids.splice(target, 0, id); patch({ course_ids: ids }); }
  function remove(id: string) { const prices = { ...configuration.stage_prices }; delete prices[id]; patch({ course_ids: configuration.course_ids.filter(value => value !== id), stage_prices: prices }); }
  function leave(event: React.MouseEvent<HTMLAnchorElement>) { if ((dirty || saving) && !window.confirm("未保存の内容があります。この画面を離れますか？")) event.preventDefault(); }
  const selectedIds=configuration.kind==='月額レッスン'?[...new Set((configuration.monthly?.months??[]).flatMap(item=>item.course_ids))]:configuration.kind==='全講座'?(configuration.catalog_course_ids??saved?.course_snapshot.map(item=>item.course_id)??[]):configuration.course_ids;
  const selected = selectedIds.map(id => courses.find(course => course.id === id));
  const reference = selected.length && selected.every(course => course?.reference_price != null) ? selected.reduce((sum, course) => sum + course!.reference_price!, 0) : null;
  const stageValues = configuration.course_ids.map(id => configuration.stage_prices[id]);
  const price = configuration.purchase_mode === "all" ? configuration.price : stageValues.length && stageValues.every(value => value != null) ? stageValues.reduce<number>((sum, value) => sum + value!, 0) : null;
  const after = configuration.after ?? emptyAfter;
  useEffect(()=>{if(!sixStep||!loaded)return;let live=true;setShippingLoaded(false);setShippingError('');readCourseShipping(headquartersId,selectedIds).then(rows=>{if(live){setShippingRows(rows);setShippingLoaded(true);}}).catch(e=>{if(live)setShippingError(e.message);});return()=>{live=false;};},[sixStep,loaded,headquartersId,JSON.stringify(selectedIds),shippingRetry]);
  useEffect(()=>{const previous=lastShippingStep.current;lastShippingStep.current=step;if(step===0&&previous!==0&&loaded)setShippingRetry(value=>value+1);if(step!==0||!loaded)return;const refresh=()=>{if(document.visibilityState==='visible')setShippingRetry(value=>value+1);};window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);};},[step,loaded]);
  const courseKit=sixStep&&shippingLoaded?deriveCourseKit(shippingRows):null;
  const kit: NonNullable<Configuration["kit"]> = courseKit??configuration.kit??{enabled:false,methods:[]};
  const effectiveConfiguration={...configuration,kit};
  const reviewIssues=sixStep?[...(!configuration.title.trim()?[{label:'販売プラン名を入力してください',step:0}]:[]),...(!selectedIds.length?[{label:'講座を選択してください',step:0}]:[]),...(!shippingLoaded||shippingRows.some(r=>!r.configuration)?[{label:'選択講座の発送物設定を保存してください',step:0}]:[]),...(configuration.price==null?[{label:'販売価格を入力してください',step:2}]:[]),...(!configuration.payment_methods?.length?[{label:'支払い方法を選択してください',step:2}]:[]),...(configuration.study_style!=='materials_only'&&!configuration.allowed_methods?.length?[{label:'開催方法を選択してください',step:1}]:[]),...(!configuration.terms?.body||!configuration.terms?.version?[{label:'申込規約とバージョンを入力してください',step:5}]:[])]:[];
  const fields = configuration.application_form?.fields ?? baseFields;
  function fieldsChange(next: Question[]) { patch({ application_form: { ...configuration.application_form, conditionalVersion: 1, fields: next } }); }
  async function save(notify = true): Promise<SalesPlanDraft | null> {
    if (lock.current) return null;
    if(sixStep&&!shippingLoaded){setSaveOutcome('failed');setError(shippingError||'発送物の読み込みを確認してください。');return null;}
    const formErrors=applicationFormErrors(fields); if(formErrors.length){setSaveOutcome('failed');setError(formErrors.join(" "));return null;}
    if(configuration.kind==='月額レッスン'){
      const invalid=monthlyPolicyMessages(configuration.monthly).filter(issue=>Object.hasOwn(configuration.monthly??{},issue.path.replace('monthly.','')));
      if(invalid.length){setSaveOutcome('failed');setError(invalid.map(issue=>issue.message).join(' '));return null;}
    }
    lock.current = true; setSaving(true); setError(""); setSaveOutcome('idle');
    const current = generation.current;
    let saveResponded=false;
    try {
      const row = await saveSalesPlanDraft(headquartersId, stableId.current, revision.current, {...effectiveConfiguration,...(sixStep?{after:{...after,record_completion:true}}:{}),application_form:{fields,conditionalVersion:1}});
      if (current !== generation.current) return null;
      saveResponded=true;
      if(!row||row.id!==stableId.current||row.headquarters_id!==headquartersId||!Number.isInteger(row.revision)||row.revision!==revision.current+1||!row.configuration)throw new Error('保存結果を確認できませんでした。入力内容は残っています。');
      revision.current = row.revision; setSaved(row);
      if(!draftId&&window.location.pathname.endsWith('/offerings/new')){const params=new URLSearchParams(window.location.search);params.set('step',String(navigation.indexOf(step)+1));params.set('savedDraft',row.id);window.history.replaceState(null,'',window.location.pathname+'?'+params.toString());}
      {
        const confirmed=await getSalesPlanDraft(headquartersId,row.id);
        if(current!==generation.current)return null;
        if(confirmed?.id!==row.id||confirmed.headquarters_id!==headquartersId||confirmed.revision!==row.revision||JSON.stringify(sortedConfiguration(confirmed.configuration))!==JSON.stringify(sortedConfiguration(row.configuration)))throw new Error('保存結果を確認できませんでした。入力内容は残っています。');
        setSaveOutcome('success');
      }
      setConfiguration(row.configuration.kind==='全講座'?{...row.configuration,catalog_course_ids:row.configuration.catalog_course_ids??row.course_snapshot.map(c=>c.course_id)}:row.configuration); setDirty(false); if(step===6)setOfferEvent(true); if (notify) onSaved?.(row); return row;
    } catch (cause) { if (current === generation.current) {setSaveOutcome(saveResponded?'unconfirmed':'failed');setError(saveResponded?'保存結果を確認できませんでした。入力内容は残っています。':cause instanceof Error ? cause.message : "保存できませんでした。入力内容は残っています。");} return null; }
    finally { lock.current = false; if (current === generation.current) setSaving(false); }
  }
  async function openPaymentSettings() {
    const row = dirty || !saved ? await save(false) : saved;
    if (!row) return;
    const returnTo = href(`/academy/offerings/${row.id}`) + '?step=3';
    router.push(href('/academy/settings') + '?tab=payment&return=' + encodeURIComponent(returnTo));
  }
  async function openCourseSettings(courseId: string, shipping = false) {
    const row = dirty || !saved ? await save(false) : saved;
    if (!row) return;
    router.push(href(`/academy/courses/${courseId}`) + `?salesPlanReview=${encodeURIComponent(row.id)}&salesPlanStep=1${shipping?'#course-shipping':''}`);
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
  return <div className={`${styles.root} ${configuration.kind==="コース"?styles.coursePricing:""} ${sixStep?styles.sixStepReview:""} ${step===0?styles.stepOne:""} ${[1,2,4].includes(step)?styles.steps234:""} ${step===5?styles.stepFive:""} ${step===6?styles.stepSix:""}`}><main className={styles.wrap}>
    <CreationReturnLink headquartersId={headquartersId} canLeave={()=>!saving&&(!dirty||window.confirm("未保存の内容があります。作成画面へ戻りますか？"))}/>
    <a className={styles.back} href={href("/academy/offerings")} onClick={leave}>← 販売プラン一覧へ</a>
    <div className={styles.titlebar}><div className={styles.en}>SALES PLAN</div><div className={styles.jp}>販売プランの編集</div></div>
    {!loadedDraftId&&initialSample&&<p className={styles.note}>見本の名前と金額を入力しています。講座と条件を確認して、ご自身の販売プランとして保存してください。</p>}
    <div className={styles.compactHead}><div><h1>{configuration.title||'新しい販売プラン'}</h1>{saved&&<p>更新 {new Date(saved.updated_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'})}</p>}</div>{saved&&<AcademyManagementActions compact key={saved.id+':'+saved.revision} headquartersId={headquartersId} kind="plan" id={saved.id} title={configuration.title} disabled={dirty||saving} onChanged={()=>setRetry(value=>value+1)}/>}</div>
    {saved?.hold_reasons.includes('legacy_settings_review_required')&&<p className={styles.note} role="status">以前の販売プランを引き継いでいます。募集を更新する前に、受講方法・教材・支払い方法・申込規約を確認してください。下書きの保存だけでは公開中のページは変わりません。</p>}
    {saved&&<div className={styles.relatedActions}><CreationRelations compact key={saved.id+':'+saved.revision} headquartersId={headquartersId} planId={saved.id} showEvents/><a className={styles.addEvent} aria-disabled={dirty||saving} href={href('/academy/create?plan='+encodeURIComponent(saved.id)+'&tab=event')} onClick={event=>{if(dirty||saving){event.preventDefault();setError(saving?'保存中です。完了するまでお待ちください。':'変更を保存してから開催日を追加してください。');}}}>＋ 開催日を追加</a></div>}
    <LocalReviewControls headquartersId={headquartersId}/>
    <div className={styles.steps} aria-label="作成STEP">{names.map((name, i) => <button key={name} type="button" className={cx("step", navigation[i] === step && "on", navigation[i] < step && "done")} aria-current={navigation[i] === step ? "step" : undefined} disabled={step===0&&saving||step===4&&!afterReady&&navigation[i]>step} onClick={() => setStep(navigation[i])}>{i + 1} {name}</button>)}</div>
    <div className={styles.layout}><section className={styles.card}><h2>{step===0?"販売する講座を選びます。複数選んだ場合は、受講する順番を並べ替えられます。":sixStep&&step===2?"料金と支払い方法":headings[step]}</h2>{step!==0&&help[step]&&<div className={styles.help}>{help[step]}</div>}
      <fieldset disabled={saving}>
      {step===0&&<div className={styles.field}><label htmlFor="sales-plan-name">販売プラン名</label><input id="sales-plan-name" maxLength={200} value={configuration.title} onChange={event=>patch({title:event.target.value})} placeholder="例：はじめてのキャンドル講座" /></div>}
      {step===0&&<><p className={styles.help}>選んだ講座の紹介文や学べる内容は、販売ページと講座詳細ページに表示されます。販売価格はこの販売プランで確認してください。</p><div className={styles.field}><label htmlFor="sales-plan-description">このプランについて（任意）</label><textarea id="sales-plan-description" maxLength={10000} rows={3} value={configuration.description??''} onChange={event=>patch({description:event.target.value})}/></div></>}
      <SalesPlanTypeFields headquartersId={headquartersId} step={step} configuration={configuration} courses={courses} saved={saved} patch={patch}/>
      {step === 0 && !['全講座','月額レッスン'].includes(configuration.kind) && <><h3>選択済み講座</h3><div className={styles["course-list"]}>{selected.map((course, i) => { const id = configuration.course_ids[i]; return <div key={id} className={styles.course} draggable onDragStart={() => { dragged.current = id; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged.current) reorder(dragged.current, i); dragged.current = null; }}>
        <div className={styles.order}><span className={styles.drag}>☰</span><button aria-label={`${course?.name ?? "講座"}を上へ`} disabled={i === 0} onClick={() => reorder(id, i - 1)}>↑</button><button aria-label={`${course?.name ?? "講座"}を下へ`} disabled={i === selected.length - 1} onClick={() => reorder(id, i + 1)}>↓</button></div>
        <div className={styles.thumb} style={course?.main_image_url ? { backgroundImage: `url(${JSON.stringify(course.main_image_url)})` } : undefined}>{String(i + 1).padStart(2, "0")}</div>
        <button type="button" className={styles.courseChoice} onClick={() => setConfirmCourseId(id)} aria-label={`${course?.name ?? '講座'}の講座内容を確認する`}><strong>{course?.name ?? "講座情報を確認してください"}</strong><small>{course?.lesson_count ?? "—"}レッスン<span className={styles["course-price"]}>参考価格 {yen(course?.reference_price)}</span></small><span>講座内容を確認 →</span></button>
        <button className={styles.remove} aria-label={`${course?.name ?? "講座"}を外す`} onClick={() => remove(id)}>×</button>
      </div>; })}</div>
      <button className={styles.add} disabled={configuration.kind==='単品講座'&&selected.length>=1} onClick={() => setPicker(value => !value)}>＋ 講座を追加</button>
      {picker && <div className={styles.conditional}><label>講座を検索<input value={search} onChange={event => setSearch(event.target.value)} /></label>{courses.filter(course => !configuration.course_ids.includes(course.id) && course.name.includes(search)).map(course => <button key={course.id} className={styles["form-row"]} disabled={configuration.kind==='単品講座'&&configuration.course_ids.length>=1} onClick={() => {patch({ course_ids: configuration.kind==='単品講座'?[course.id]:[...configuration.course_ids, course.id] });if(sixStep)setPicker(false);}}><strong>{course.name}</strong><p>{course.lesson_count ?? "—"}レッスン · 参考価格 {yen(course.reference_price)}</p></button>)}{courses.length === 0 && <p>講座がありません。講座一覧から作成してください。</p>}</div>}
      <p className={styles.sequenceHelp}>ここでは講座の順番を設定します。レッスン・教材の順番は各講座で設定します。</p></>}
      {step === 0 && sixStep&&<section className={styles.materialsSection} aria-label="受講に必要な材料・教材"><h3>受講に必要な材料・教材</h3><p>選んだ講座に、受講者へ渡す材料や教材がある場合は設定してください。</p><div className={styles.materialsList}>{selected.map((course,i)=>{const row=shippingRows.find(r=>r.course_id===selectedIds[i]);const value=row?.configuration;const unconfigured=shippingLoaded&&!value;return <article className={styles.materialCard} key={selectedIds[i]}><h4>{course?.name??'講座情報を確認してください'}</h4><div className={styles.materialStatus}><span>材料・教材</span><span className={unconfigured?styles.materialPending:value?.enabled?styles.materialDone:styles.materialValue}>{!shippingLoaded?shippingError?'確認できませんでした':'確認中…':!value?'未設定':value.enabled?'あり':'なし'}</span>{shippingLoaded&&value?.enabled&&value.name&&<span>{value.name}</span>}</div><button type="button" className={styles.materialAction} onClick={()=>void openCourseSettings(selectedIds[i],true)}>{value?'確認・変更 →':'設定する →'}</button></article>;})}</div>{shippingError&&<div role="alert"><p>材料・教材を確認できませんでした。</p><p>{shippingError}</p><button type="button" onClick={()=>setShippingRetry(value=>value+1)}>材料・教材を再確認</button></div>}{!courseKit&&configuration.kit?.enabled&&<p>講座側の設定が揃うまで、既存の販売プランのキット設定を保持しています。</p>}</section>}
      {step === 1 && <>{configuration.kind==='ワークショップ'&&<p className={styles.note}>ワークショップは開催を作成して募集します。日時・受付方法・担当者・定員は開催側で設定します。</p>}<div className={styles["study-options"]}><Choice active={configuration.study_style !== "materials_only"} title="講師から受講する" description="対面やオンラインで、講師から講座を受けます。" onClick={() => patch({ study_style: "instructor" })} /><Choice active={configuration.study_style === "materials_only"} title="教材だけで学ぶ" description="動画・PDF・文章などを使って、自分で学びます。" onClick={() => patch({ study_style: "materials_only", materials: { ...configuration.materials, enabled: true, starts: "from_start" } })} /></div>
      {configuration.study_style !== "materials_only" ? <div className={styles.conditional}><h3>受講方法</h3><div className={styles["method-options"]}>{([ ["in_person", "対面", "会場で受講します。"], ["online", "オンライン", "Zoomなどを使ってオンラインで受講します。"]] as const).map(([value, title, description]) => <Choice key={value} type="method-choice" active={(configuration.allowed_methods ?? []).includes(value)} title={title} description={description} onClick={() => patch({ allowed_methods: toggle(configuration.allowed_methods ?? [], value) })} />)}</div><h3>レッスン教材をいつ見られるようにしますか？</h3>{([["none", "使用しない", "受講者には教材を公開しません。"], ["from_start", "受講前から公開", "講座中に一緒に使う場合もこちらです。"], ["after_attendance", "受講後に公開", "復習教材として受講後から利用できます。"]] as const).map(([value, title, description]) => <label key={value} className={styles["radio-line"]}><input type="radio" name="materials" checked={value === "none" ? !configuration.materials?.enabled : !!configuration.materials?.enabled && configuration.materials.starts === value} onChange={() => patch({ materials: value === "none" ? { ...configuration.materials, enabled: false } : { ...configuration.materials, enabled: true, starts: value } })} /><span><b>{title}</b><br /><small>{description}</small></span></label>)}</div> : <div className={styles.conditional}><h3>レッスン教材について</h3><div className={styles.help}>講座に設定されているレッスン・教材・順番を使います。開催の登録は必要ありません。</div></div>}
      {!sixStep&&<div className={styles["kit-panel"]}><h3>受講に必要なキット・発送物はありますか？</h3><Choice type="toggle-row" active={kit.enabled} title="キット・発送物あり" description="材料セット、道具、冊子などを受講者へ渡す場合に設定します。" onClick={() => patch({ kit: { ...kit, enabled: !kit.enabled } })} />{kit.enabled && <div className={styles.conditional}><label>キット・発送物の名前<input value={kit.name ?? ""} onChange={event => patch({ kit: { ...kit, name: event.target.value } })} /></label><label>キットの受取人<select value={kit.recipient??''} onChange={event=>patch({kit:{...kit,recipient:event.target.value as 'learner'|'instructor'}})}><option value="" disabled>選択してください</option><option value="learner">受講者</option><option value="instructor">担当講師</option></select></label><h3>受け渡し方法</h3><div className={styles["method-options"]}>{([["shipping", "事前に発送", "オンライン受講など、開催前に受講者へ送ります。"], ["venue_handover", "会場で手渡し", "対面開催で、当日に直接お渡しします。"]] as const).map(([value, title, description]) => <Choice key={value} type="method-choice" active={kit.methods.includes(value)} title={title} description={description} onClick={() => patch({ kit: { ...kit, methods: toggle(kit.methods, value) } })} />)}</div><p className={styles.help}>両方選べます。実際にどちらで渡すかは、各「開催」で決めます。</p></div>}<p className={styles.help}>※ 講師が認定講座を開講するときに本部へ注文する「開講用キット」とは別の設定です。</p></div>
      }<div className={styles["schedule-note"]}><b>日程・受付方法・担当者・定員は「開催」で設定します。</b></div></>}
      {step === 2 && <><div className={styles["price-summary"]}><div className={styles["price-head"]}>選んだ講座の参考価格</div>{selected.map((course, i) => <div key={selectedIds[i]} className={styles["price-row"]}><span>{course?.name ?? "講座情報を確認"}</span><b>{yen(course?.reference_price)}</b></div>)}<div className={styles["price-total"]}><span>参考価格合計</span><strong>{yen(reference)}</strong></div></div>
      {configuration.kind==="コース"&&<div className={styles["billing-model"]}><Choice type="billing-choice" active={configuration.purchase_mode === "all"} title="コース一括払い" description="コース全体をまとめて購入できます。" onClick={() => patch({ purchase_mode: "all", stage_prices: {} })} /><Choice type="billing-choice" active={configuration.purchase_mode === "staged"} title="講座ごとに支払う" description="前の講座を修了後、次の講座ごとに購入する方式です。" onClick={() => patch({ purchase_mode: "staged" })} /></div>}
      {configuration.purchase_mode === "all" ? <div className={styles.field}><label htmlFor="course-price">{configuration.kind==='月額レッスン'?'月額料金':configuration.kind==='コース'?'コース販売価格':'販売価格'}</label><div className={styles["input-wrap"]}><span>¥</span><input id="course-price" type="number" min="0" step="1" value={configuration.price ?? ""} onChange={event => patch({ price: event.target.value === "" ? null : Number(event.target.value) })} /></div></div> : <><div className={styles["price-summary"]}><div className={styles["price-head"]}>講座ごとの販売価格</div>{selected.map((course, i) => { const id = configuration.course_ids[i]; return <div key={id} className={styles["price-row"]}><label htmlFor={`price-${id}`}>{String(i + 1).padStart(2, "0")} {course?.name}<small> 参考価格 {yen(course?.reference_price)}</small></label><div className={styles.courseStageAmount}><input id={`price-${id}`} aria-label={`${course?.name} 講座ごとの販売価格`} type="number" min="0" step="1" value={configuration.stage_prices[id] ?? ""} onChange={event => patch({ stage_prices: { ...configuration.stage_prices, [id]: event.target.value === "" ? null : Number(event.target.value) } })} /><span>円</span></div></div>; })}<div className={styles["price-total"]}><span>販売価格の合計</span><strong>{yen(price)}</strong></div></div><p className={styles.coursePaymentHelp}>各講座の修了・支払い確認後に、次の講座へ進みます。</p></>}
      {reference != null && price != null && <div className={styles.discount}>{price < reference ? `参考合計より ${yen(reference - price)} お得` : price > reference ? `参考合計より ${yen(price - reference)} 高い設定` : "参考価格の合計と同額"}</div>}{reference != null && price != null && price > 0 && price < reference * .65 && <div className={cx("price-warning", "show")}><b>参考価格より大きく下回っています。</b><br />入力間違いや必要な費用が含まれているか確認してください。</div>}</>}
      {step === 2&&sixStep&&<ReviewPaymentSettings headquartersId={headquartersId} configuration={configuration} patch={patch} onOpenSettings={()=>void openPaymentSettings()}/>}
      {step === 3 && !sixStep && <div className={styles["pay-options"]}>{([["card", "カード決済", "Academy上でクレジットカード決済を受け付けます。"], ["bank", "銀行振込", "受講者に振込先を案内します。"], ["external", "外部の決済サービスを使う", "Squareなど、すでに利用している決済ページへ案内します。"]] as const).filter(([value])=>configuration.kind!=='月額レッスン'||value==='card').map(([value, title, description]) => <label key={value} className={styles["pay-option"]}><input type="checkbox" checked={(configuration.payment_methods ?? []).includes(value)} onChange={() => patch({ payment_methods: toggle(configuration.payment_methods ?? [], value) })} /><div><strong>{title}</strong><p>{description}</p></div></label>)}{configuration.payment_methods?.includes("external") && <div className={styles["pay-config"]}>{(configuration.purchase_mode === "staged" ? configuration.course_ids : ["plan"]).map(id => <div className={styles.field} key={id}><label>決済URL {courses.find(course => course.id === id)?.name ?? "販売プラン"}<input type="url" value={configuration.external_payment_urls?.[id] ?? ""} onChange={event => patch({ external_payment_urls: { ...configuration.external_payment_urls, [id]: event.target.value } })} /></label></div>)}</div>}</div>}
      {step === 4 && (sixStep?<AfterCourseWizard headquartersId={headquartersId} configuration={configuration} patch={patch} onReadyChange={setAfterReady}/>:<SalesPlanAfterStep headquartersId={headquartersId} configuration={configuration} patch={patch} onSave={()=>save()}/>)}
      {step === 5 && <div className={styles["form-panel"]}>
        <h3>申込フォームの項目</h3><div className={styles["form-builder"]}>{fields.map((field, index) => {
          const fixed = ["name", "email", "terms"].includes(field.id);
          return <div key={field.id} className={styles["form-row"]}>
            {baseFields.some(base => base.id === field.id) ? <><strong>{field.label}<span className={styles["form-badge"]}>{field.required?"必須":"任意"}</span></strong><p>{({ name: "申込者のお名前", email: "申込確認や連絡に使用します。", phone: "連絡が必要な場合に使用します。", notes: "受講前に伝えておきたいことを入力できます。", terms: "" } as Record<string, string>)[field.id]}</p></> : <div className={styles["customer-field"]}><label htmlFor={`question-${field.id}`}>質問</label><input id={`question-${field.id}`} aria-label="質問文" value={field.label} onChange={event => fieldsChange(fields.map(item => item.id === field.id ? { ...item, label: event.target.value } : item))} /></div>}
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
        <div className={styles["form-actions"]}><button onClick={() => fieldsChange([...fields, { id: crypto.randomUUID(), label: "", type: "text", required: false }])}>＋ 質問を追加</button><button onClick={() => setFormOrder(value => !value)}>項目の並び替え</button></div>
        <button type="button" className={styles["preview-form-btn"]} onClick={() => setFormPreview(true)}>申込フォームをプレビュー →</button>
        <p className={styles.help}>料金・支払い、キャンセル・返金、参加条件など、申込前に同意が必要な内容を入力してください。</p><div className={styles["customer-field"]}><label htmlFor="application-terms">お申し込みに関する注意事項</label><textarea id="application-terms" placeholder="キャンセルをご希望の場合は、開催日の3日前までにご連絡ください。お支払い期限や返金条件などもご記入ください。" value={configuration.terms?.body ?? ""} onChange={event => patch({ terms: { ...configuration.terms, version: configuration.terms?.version ?? "", body: event.target.value } })} /></div>
        <div className={styles["customer-field"]}><label htmlFor="application-terms-version">規約バージョン（管理用）</label><input id="application-terms-version" value={configuration.terms?.version ?? ""} onChange={event => patch({ terms: { body: configuration.terms?.body ?? "", version: event.target.value } })} /></div>
      </div>}
      {step === 6 && <div className={styles["review-panel"]}>{sixStep&&<section aria-label="不足設定"><h3>公開前に確認すること</h3>{reviewIssues.length?<ul className={styles.reviewIssueList}>{reviewIssues.map(issue=><li key={issue.label}><span>{issue.label}</span><button type="button" onClick={()=>setStep(issue.step)}>STEP{navigation.indexOf(issue.step)+1}で設定する →</button></li>)}</ul>:<p>入力内容を確認できました。販売ページへ進めます。</p>}<p>販売ページの作成後、募集公開は『開催』で設定します。</p></section>}<div className={styles["review-grid"]}>{[["販売タイプ", configuration.kind, `${selected.length}講座を順番に受講`], ["受講スタイル", configuration.study_style === "materials_only" ? "レッスン教材だけで学ぶ" : "先生から受講", configuration.study_style === "materials_only" ? "開催の登録は不要" : (configuration.allowed_methods ?? []).map(value => value === "in_person" ? "対面" : "オンライン").join("・")], ["講座構成", `${selected.length}講座`, selected.map(course => course?.name ?? "講座情報を確認").join(" → ")], ["金額", yen(price), ""], ["支払い", (configuration.payment_methods ?? []).map(value => ({ card: "カード", bank: "銀行振込", external: "外部決済", onsite: "現地払い" })[value]).join("・") || "未設定", ""], ["申込フォーム", `${fields.length}項目`, ""]].map(([title, value, note]) => <div key={title} className={styles["review-box"]}><b>{title}</b><strong>{value}</strong>{note && <p>{note}</p>}</div>)}</div>{sixStep?<WizardSummary configuration={configuration} compact/>:<AfterCourseSummary configuration={configuration}/>}{configuration.kind==='月額レッスン'&&<MonthlyPolicySummary monthly={configuration.monthly} showIssues/>}<div className={styles.ready}><b>{sixStep?"販売プランを保存すると、販売ページを編集できます。":"この内容だけでも販売ページとして使えます。"}</b></div><div className={styles["launch-options"]}>{([["standard", "販売ページを確認", "写真と文章を整えるための下書きを確認します。", "販売ページを確認 →", "plain"], ["builder", "販売ページを編集", "標準ページを土台に、配置・写真・文章・セクションを自由に編集します。", "販売ページを編集 →", "builder"]] as const).map(([action, title, note, label, className]) => <div key={action} className={styles["launch-card"]}><strong>{title}</strong><p>{note}</p><button className={styles[className]} disabled={!onPageAction || saving} onClick={() => void pageAction(action)}>{label}</button></div>)}</div>{!onPageAction && <p className={styles.help}>販売ページへの接続を準備しています。下書きは保存できます。</p>}</div>}
      </fieldset>
      {offerEvent&&saved&&!dirty&&!saving&&!['failed','unconfirmed'].includes(saveOutcome)&&<section className={styles.nextAction} aria-label="保存後の次の操作"><h3>このプランで募集を始めますか？</h3><p>開催を保存した後、販売ページと募集条件を確認して公開します。</p><a href={href(`/academy/create?plan=${encodeURIComponent(saved.id)}&tab=event`)}>開催・募集を設定する</a><button type="button" onClick={()=>setOfferEvent(false)}>あとで</button></section>}
      <div className={styles.actions}><button className={styles["back-step"]} disabled={saving} onClick={() => step > 0 ? setStep(navigation[Math.max(0,navigation.indexOf(step)-1)]) : window.location.assign(href("/academy/offerings"))}>{step===0?"← 販売プラン一覧へ":step===4||step===6?"← 前へ":"← 戻る"}</button>{step===0?<div className={styles.saveControl}><button className={styles.secondary} type="button" disabled={saving} onClick={()=>void save(false)}>{saving?'保存中…':step===0||step===4||step===5||step===6?'保存する':'ここまで保存'}</button>{step===0&&<span role="status" aria-live="polite" className={saveOutcome==='failed'||saveOutcome==='unconfirmed'?styles.saveFailure:styles.saveResult}>{saving?'保存中…':saveOutcome==='success'?'✓ 保存しました':saveOutcome==='failed'?'保存できませんでした':saveOutcome==='unconfirmed'?'保存結果を確認できませんでした':''}</span>}</div>:<button className={styles.secondary} type="button" disabled={saving} onClick={()=>void save(false)}>{saving?'保存中…':step===0||step===4||step===5||step===6?'保存する':'ここまで保存'}</button>}{step < 6 ? <button className={styles.next} disabled={step===0&&saving||step===4&&!afterReady} onClick={() => setStep(navigation[navigation.indexOf(step)+1])}>次へ：{names[navigation.indexOf(step)+1]} →</button> : <button className={styles.next} disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "販売プランを保存"}</button>}</div>
      <div role="status" className={styles.status}>{saving ? "保存中…" : saveOutcome==='unconfirmed'?'保存結果を確認できませんでした':saveOutcome==='failed'?'保存できませんでした':dirty ? "未保存の変更があります" : saved ? step===0?"保存済みの内容です":"保存しました" : "未保存"}</div>{error && <p role="alert" className={styles.error}>{error}</p>}
    </section><aside className={cx("card", "preview")}><div className={styles["preview-label"]}>現在選んでいる講座</div>{selected.map((course, index) => <Fragment key={selectedIds[index]}>{index > 0 && <div className={styles.down}>↓</div>}<div className={styles.pitem}><b>COURSE {String(index + 1).padStart(2, "0")}</b><strong>{course?.name ?? "講座情報を確認"}</strong><span>{course?.subtitle ?? ""}{sixStep&&<> / 参考価格 {yen(course?.reference_price)}</>}</span></div></Fragment>)}</aside></div>
  </main>{confirmCourseId&&<SalesPlanCourseConfirmation key={confirmCourseId} headquartersId={headquartersId} courseId={confirmCourseId} course={courses.find(course=>course.id===confirmCourseId)} onClose={()=>setConfirmCourseId(null)}/>} {formPreview && <SalesPlanApplicationPreview headquartersId={headquartersId} planId={stableId.current} configuration={{...effectiveConfiguration,course_ids:selectedIds}} fields={fields} onClose={() => setFormPreview(false)} />}</div>;
}



