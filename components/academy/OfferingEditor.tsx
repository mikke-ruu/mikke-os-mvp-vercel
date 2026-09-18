"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AcademyCourse } from "@/types/database";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { blankOfferingInput, offeringError, offeringInput, offeringKinds, offeringProblem, type AcademyOffering, type OfferingInput } from "@/lib/academy/offerings";
import { AcademyCourseCard } from "./AcademyCourseCard";
import { AcademyContentRenderer } from "./AcademyContentRenderer";
import { AcademyImageUploader } from "./AcademyImageUploader";
import { LpCanvas } from "@/components/mikkeos/page-builder/LpCanvas";
import { LpDesignFields } from "@/components/mikkeos/page-builder/LpDesign";
import { LpGalleryFields } from "@/components/mikkeos/page-builder/LpGalleryFields";
import { LpRichWriting } from "@/components/mikkeos/page-builder/LpRichWriting";
import { MikkeBlockFields, type ContentImagePickerProps } from "@/components/mikkeos/content/MikkeBlockFields";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";

const field = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-base";
const action = "min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm font-bold disabled:opacity-50";
function ImagePicker({ currentUrl, onSelect }: ContentImagePickerProps) {
  return <div><AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })} />{currentUrl && <button type="button" onClick={() => onSelect({ publicUrl: "" })}>画像を外す</button>}</div>;
}
function LinkEditor({ block, onChange }: { block: LpBlock; onChange: (block: LpBlock) => void }) {
  return <div><label>リンク先<input className={field} value={block.url ?? ""} onChange={event => onChange({ ...block, url: event.target.value })} /></label><label>表示名<input className={field} value={block.title ?? ""} onChange={event => onChange({ ...block, title: event.target.value })} /></label></div>;
}
function card(course: AcademyCourse): LpBlock {
  return { id: crypto.randomUUID(), type: "paragraph", title: course.name, lp: { reference: { kind: "academy-course", id: course.id, imageSide: course.feature_settings?.marketing?.imageSide ?? "left" }, desktop: { padding: 24 }, mobile: { padding: 16 } } };
}
function hasCard(blocks: LpBlock[], id: string): boolean {
  return blocks.some(block => (block.lp?.reference?.kind === "academy-course" && block.lp.reference.id === id) || hasCard(block.lp?.children ?? [], id));
}

export function OfferingEditor({ initial, courses, onSave, onArchive }: {
  initial?: AcademyOffering; courses: AcademyCourse[];
  onSave: (input: OfferingInput) => Promise<AcademyOffering>;
  onArchive?: () => Promise<AcademyOffering>;
}) {
  const [form, setForm] = useState<OfferingInput>(() => initial ? offeringInput(initial) : blankOfferingInput());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const top = useRef<HTMLDivElement>(null);
  const selected = form.course_ids.map(id => courses.find(course => course.id === id)).filter((course): course is AcademyCourse => Boolean(course));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change<K extends keyof OfferingInput>(key: K, value: OfferingInput[K]) { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setNotice(""); }
  function go(next: number) { setStep(next); top.current?.scrollIntoView({ block: "start" }); }
  function toggleCourse(course: AcademyCourse) {
    const exists = form.course_ids.includes(course.id);
    change("course_ids", exists ? form.course_ids.filter(id => id !== course.id) : [...form.course_ids, course.id]);
    if (exists) { const prices = { ...form.stage_prices }; delete prices[course.id]; change("stage_prices", prices); }
    if (!exists && !hasCard(form.lp_blocks, course.id)) change("lp_blocks", [...form.lp_blocks, card(course)]);
  }
  async function save() {
    if (inFlight.current) return;
    if (form.status === "published" && selected.some(course => !course.is_published || course.learner_access_mode === "days_after_completion")) { setError("公開前に講座の公開状態と教材の閲覧期限を確認してください。修了後の日数で期限を決める講座は、この募集ではまだ受け付けられません。"); setStep(2); return; }
    const input = form.purchase_mode === "staged" ? { ...form, price: form.course_ids.reduce((sum, id) => sum + (form.stage_prices[id] ?? 0), 0) } : form;
    const problem = offeringProblem(input);
    if (problem) { setError(problem); top.current?.scrollIntoView({ block: "start" }); return; }
    inFlight.current = true; setSaving(true); setError(""); setNotice("");
    try { const result = await onSave(input); setForm(offeringInput(result)); setDirty(false); setNotice("募集を保存しました。"); }
    catch (cause) { setError(offeringError(cause)); }
    finally { inFlight.current = false; setSaving(false); }
  }
  async function archive() {
    if (!onArchive || inFlight.current || !window.confirm(`募集をアーカイブします。公開ページでの受付を終了します。申込履歴は残ります。${dirty ? "保存していない変更は破棄されます。" : ""}`)) return;
    inFlight.current = true; setSaving(true); setError("");
    try { const result = await onArchive(); setForm(offeringInput(result)); setDirty(false); setNotice("募集をアーカイブしました。"); }
    catch (cause) { setError(offeringError(cause)); }
    finally { inFlight.current = false; setSaving(false); }
  }
  const price = <section className="space-y-2 border-t border-[var(--mikke-line)] p-5"><small>{form.purchase_mode === "staged" ? "初回のお支払い（税込）" : "募集価格（税込）"}</small><p className="text-xl font-bold">{Number.isFinite(form.purchase_mode === "staged" ? form.stage_prices[form.course_ids[0]] : form.price) ? `¥${(form.purchase_mode === "staged" ? form.stage_prices[form.course_ids[0]] : form.price).toLocaleString("ja-JP")}` : "価格未入力"}</p><p className="text-sm">{form.payment_methods.map(method => method === "bank" ? "振込" : "現地決済").join(" ／ ")}</p><button type="button" disabled className="min-h-12 w-full rounded-lg bg-[var(--mikke-accent)] p-3 font-bold text-white">申し込む</button><p className="text-xs text-[var(--mikke-muted)]">編集画面では送信されません。公開後の募集ページから申し込めます。</p></section>;
  return <div ref={top} className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link className={action} href={toCurrentAcademyContextHref("/academy/offerings")} onClick={event => { if (dirty && !window.confirm("保存していない変更があります。一覧に戻りますか？")) event.preventDefault(); }}>募集一覧へ</Link><span className="text-xs">{dirty ? "未保存" : initial ? "保存済み" : "新しい募集"}</span></div>
    {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 p-3 text-sm">{error} 入力内容は残っています。</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    <nav aria-label="募集作成の手順" className="grid grid-cols-3 border-b border-[var(--mikke-line)]">{["1–3 募集・販売設定", "4 ページを編集", "5 公開設定"].map((label, index) => <button key={label} type="button" disabled={saving} aria-current={step === index ? "step" : undefined} onClick={() => go(index)} className={`min-h-12 border-b-2 px-2 py-2 text-xs font-bold sm:text-sm ${step === index ? "border-[var(--mikke-primary)] text-[var(--mikke-primary)]" : "border-transparent"}`}>{label}</button>)}</nav>
    <fieldset disabled={saving} className="min-w-0 space-y-5">
      {step === 2 && selected.some(course => !course.is_published || course.learner_access_mode === "days_after_completion") && <section className="space-y-2 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm"><h3 className="font-bold">公開前に確認する講座</h3><p>新しい講座は下書きで保存されます。講座の編集画面で公開状態を設定してください。変更後はこの募集を下書きで保存し、再読み込みしてください。</p>{selected.filter(course => !course.is_published || course.learner_access_mode === "days_after_completion").map(course => <p key={course.id}><Link className="underline" target="_blank" rel="noopener noreferrer" href={toCurrentAcademyContextHref(`/academy/courses/${course.id}`)}>{course.name}を確認</Link>{course.learner_access_mode === "days_after_completion" ? "（修了後の日数による閲覧期限は未対応）" : "（下書き）"}</p>)}</section>}
      {step === 0 && <label className="block text-sm font-bold">講座の修了確認<select className={field} value={form.completion_mode} onChange={event => change("completion_mode", event.target.value as OfferingInput["completion_mode"])}><option value="learner">受講者が修了を記録</option><option value="hq">本部が修了を確認</option></select></label>}
      {step === 0 && form.purchase_mode === "staged" && <p className="text-sm">講座の順番は選択した順です。初回 ¥{(form.stage_prices[form.course_ids[0]] ?? 0).toLocaleString()} ／ 全講座合計 ¥{form.course_ids.reduce((total, id) => total + (form.stage_prices[id] ?? 0), 0).toLocaleString()}。前の講座の修了後に次の講座へ進みます。</p>}
      {step === 0 && <div className="mx-auto max-w-3xl space-y-6">
        <section className="space-y-4"><h2 className="text-lg font-bold">募集内容</h2><label className="block text-sm font-bold">募集名<input className={field} value={form.title} maxLength={200} onChange={event => change("title", event.target.value)} /></label><label className="block text-sm font-bold">種類<select className={field} value={form.kind} onChange={event => change("kind", event.target.value as OfferingInput["kind"])}>{offeringKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
          <div><h3 className="mb-2 text-sm font-bold">募集する講座</h3>{courses.length ? courses.map(course => <label key={course.id} className="flex min-h-11 items-center gap-3 border-b border-[var(--mikke-line)] py-2 text-sm"><input type="checkbox" checked={form.course_ids.includes(course.id)} onChange={() => toggleCourse(course)} /><span>{course.name}</span></label>) : <p className="text-sm">先に講座を登録してください。</p>}{form.course_ids.some(id => !courses.some(course => course.id === id)) && <p role="alert" className="text-sm text-red-700">読み込めない講座が含まれています。本部と講座の設定を確認してください。</p>}</div>
        </section>
        <section className="space-y-4 border-t border-[var(--mikke-line)] pt-5"><h2 className="text-lg font-bold">販売条件</h2><label className="block text-sm font-bold">{form.purchase_mode === "staged" ? "全講座の合計（税込・円）" : "募集価格（税込・円）"}<input className={field} type="number" min={0} step={1} inputMode="numeric" readOnly={form.purchase_mode === "staged"} value={form.purchase_mode === "staged" ? form.course_ids.reduce((sum, id) => sum + (form.stage_prices[id] ?? 0), 0) : Number.isFinite(form.price) ? form.price : ""} onChange={event => change("price", event.target.value === "" ? Number.NaN : Number(event.target.value))} /></label><p className="text-xs text-[var(--mikke-muted)]">講座の基本価格とは別に、この募集の金額を設定します。</p><div><h3 className="text-sm font-bold">支払い方法</h3>{([['bank', '振込'], ['onsite', '現地決済']] as const).map(([value, label]) => <label key={value} className="mr-5 inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.payment_methods.includes(value)} onChange={event => change("payment_methods", event.target.checked ? [...form.payment_methods, value] : form.payment_methods.filter(method => method !== value))} />{label}</label>)}</div><label className="block text-sm font-bold">お支払いの単位<select className={field} value={form.purchase_mode} onChange={event => change("purchase_mode", event.target.value as OfferingInput["purchase_mode"])}><option value="all">まとめてお支払い</option><option value="staged">講座ごとにお支払い</option></select></label>
          {form.purchase_mode === "staged" && selected.map(course => <label key={course.id} className="block text-sm">{course.name}の価格<input className={field} type="number" min={0} step={1} value={form.stage_prices[course.id] ?? ""} onChange={event => { const next = { ...form.stage_prices }; if (event.target.value === "") delete next[course.id]; else next[course.id] = Number(event.target.value); change("stage_prices", next); }} /></label>)}
          {(form.kind === "月額レッスン") && <p role="status" className="text-sm">月額レッスンはまだ受付に接続していません。下書きとして保存できます。</p>}
        </section>
        <section className="space-y-3 border-t border-[var(--mikke-line)] pt-5"><h2 className="text-lg font-bold">受講内容</h2><p className="text-sm">教材は各講座で編集します。募集ページには教材本文を公開しません。</p>{selected.map(course => <div key={course.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><span className="text-sm">{course.name}</span><div className="flex gap-3 text-sm"><Link target="_blank" rel="noopener noreferrer" href={toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page?audience=learner`)}>レッスン教材</Link><Link target="_blank" rel="noopener noreferrer" href={toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page`)}>講師マニュアル</Link></div></div>)}</section>
      </div>}
      {step === 1 && <LpCanvas title={form.title} pageLabel="募集ページ" blocks={form.lp_blocks} onChange={blocks => change("lp_blocks", blocks)} footer={price} extraTemplates={selected.map(course => ({ label: course.name, description: "講座カード", create: () => card(course) }))} renderContent={blocks => <>{blocks.map(block => {
        if (block.lp?.reference?.kind !== "academy-course") return <AcademyContentRenderer key={block.id} blocks={[block]} />;
        const course = selected.find(item => item.id === block.lp?.reference?.id);
        return course ? <AcademyCourseCard key={block.id} course={course} imageSide={block.lp?.reference?.imageSide} hidePrice /> : <p key={block.id}>募集対象から外れた講座です。このBOXを削除するか、講座を選び直してください。</p>;
      })}</>} renderFields={(block, update, tab) => {
        if (tab === "design") return <LpDesignFields expanded block={block} onChange={update} imagePicker={<ImagePicker currentUrl={block.lp?.backgroundImage} onSelect={asset => update({ ...block, lp: { ...block.lp, backgroundImage: asset.publicUrl } })} />} />;
        if (block.lp?.reference?.kind === "academy-course") return <label>PCの画像位置<select value={block.lp.reference.imageSide ?? "left"} onChange={event => update({ ...block, lp: { ...block.lp, reference: { ...block.lp!.reference!, imageSide: event.target.value === "right" ? "right" : "left" } } })}><option value="left">左</option><option value="right">右</option></select><p>講座情報で保存した内容を表示します。</p></label>;
        if (block.type === "gallery") return <LpGalleryFields block={block} onChange={update} ImagePicker={ImagePicker} />;
        if (block.type === "heading" || block.type === "paragraph") return <LpRichWriting compact block={block} onChange={update} />;
        return <MikkeBlockFields block={block} onChange={update} onSplit={() => {}} ImagePicker={ImagePicker} LinkEditor={LinkEditor} />;
      }} />}
      {step === 2 && <section className="mx-auto max-w-3xl space-y-4"><h2 className="text-lg font-bold">公開設定</h2><p className="text-sm">公開して保存すると、募集ページのURLから内容を見られるようになります。</p><label className="block text-sm font-bold">公開状態<select className={field} value={form.status} onChange={event => change("status", event.target.value as OfferingInput["status"])}><option value="draft">下書き</option><option value="published">公開する</option><option value="archived">受付を終了（アーカイブ）</option></select></label><dl className="grid grid-cols-[auto_1fr] gap-3 text-sm"><dt>募集名</dt><dd>{form.title || "未入力"}</dd><dt>講座</dt><dd>{selected.map(course => course.name).join(" ／ ") || "未選択"}</dd><dt>募集価格</dt><dd>{Number.isFinite(form.price) ? `¥${form.price.toLocaleString()}` : "未入力"}</dd></dl>{initial?.status === "published" && <Link href={`/academy/o/${initial.id}`} target="_blank" rel="noopener noreferrer" className={action}>公開ページを確認</Link>}{onArchive && initial?.status !== "archived" && <button type="button" className={action} onClick={archive}>募集をアーカイブ</button>}</section>}
    </fieldset>
    <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--mikke-line)] bg-white py-4"><div className="flex gap-2"><button type="button" className={action} disabled={step === 0 || saving} onClick={() => go(step - 1)}>戻る</button>{step < 2 && <button type="button" className={action} disabled={saving} onClick={() => go(step + 1)}>{step === 0 ? "次へ：ページを編集" : "次へ：公開設定"}</button>}</div><button type="button" disabled={saving} onClick={save} className={`${action} bg-[var(--mikke-accent)] text-white`}>{saving ? "保存中…" : "保存する"}</button></div>
  </div>;
}
