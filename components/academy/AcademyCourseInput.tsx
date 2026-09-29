"use client";
import { useRef, useState, type ReactNode } from "react";
import type { CourseInput } from "@/lib/academy/courses";
import type { AcademyCourseMarketing } from "@/types/database";
import { courseMarketing, courseImages } from "@/lib/academy/course-marketing";
import { AcademyCourseImages } from "./AcademyCourseImages";
import styles from "./academy-course-input.module.css";

/** Only merge edited fields; CourseForm retains the complete legacy payload. */
export function AcademyCourseInput({ value, onChange, priceField, basicOnly = false }: { value: CourseInput; onChange: <K extends keyof CourseInput>(key: K, value: CourseInput[K]) => void; priceField?: ReactNode; basicOnly?: boolean }) {
  const marketing = courseMarketing(value.featureSettings.marketing);
  const images = courseImages(marketing, value.mainImageUrl);
  const [kit, setKit] = useState(Boolean(value.materialContents || value.kitContents));
  const kitDraft = useRef({ material: value.materialContents, contents: value.kitContents });
  const kitField = useRef<"materialContents" | "kitContents">(value.materialContents || !value.kitContents ? "materialContents" : "kitContents");
  function changeMarketing(patch: AcademyCourseMarketing) { onChange("featureSettings", { ...value.featureSettings, marketing: { ...value.featureSettings.marketing, ...patch } }); }
  function changeImages(next: string[]) { changeMarketing({ images: next }); onChange("mainImageUrl", next[0] ?? ""); }
  function toggleKit(enabled: boolean) {
    setKit(enabled);
    if (!enabled) { kitDraft.current = { material: value.materialContents, contents: value.kitContents }; onChange("materialContents", ""); onChange("kitContents", ""); }
    else { onChange("materialContents", kitDraft.current.material); onChange("kitContents", kitDraft.current.contents); }
  }
  if (basicOnly) return <div className={styles.fields}><section className={styles.section} aria-label="基本情報"><h2>基本情報</h2>
    <label className={styles.field}>講座名<input required maxLength={200} value={value.name} onChange={event => onChange("name", event.target.value)} /></label>
    <div className={styles.field}><span>講座画像</span><AcademyCourseImages maxImages={1} images={value.mainImageUrl ? [value.mainImageUrl] : []} onChange={next => onChange("mainImageUrl", next[0] ?? "")} /></div>
    <label className={styles.field}>講座説明<textarea rows={4} value={value.description} onChange={event => onChange("description", event.target.value)} /></label>
    <label className={styles.field}>カード用の短い紹介文<input value={value.subtitle} onChange={event => onChange("subtitle", event.target.value)} /></label>
    <div className={styles.columns}><label className={styles.field}>目安の学習時間<input value={value.durationText} onChange={event => onChange("durationText", event.target.value)} /></label>{priceField}</div>
    <p className={styles.note}>この画面では基本情報と単品参考価格を保存できます。既存のカリキュラム・教材は保持しています。</p>
  </section></div>;
  return <div className={styles.fields}>
    <section className={styles.section} aria-label="講座情報"><h2>講座情報</h2>
      <label className={styles.field}>講座名<input required maxLength={200} value={value.name} onChange={event => onChange("name", event.target.value)} placeholder="例：COLOR BASICS" /></label>
      <label className={styles.field}>カテゴリー（任意）<input maxLength={100} value={marketing.category ?? ""} onChange={event => changeMarketing({ category: event.target.value })} placeholder="例：アクセサリー、キャンドル、アロマ" /></label>
      <div className={styles.field}><span>講座画像</span><AcademyCourseImages images={images} onChange={changeImages} /></div>
      <label className={styles.field}>講座説明<textarea rows={4} value={value.description} onChange={event => onChange("description", event.target.value)} placeholder="どんなことを学ぶ講座ですか？" /></label>
      <label className={styles.field}>受講後にできること<textarea rows={2} value={value.canDoAfter} onChange={event => onChange("canDoAfter", event.target.value)} /></label>
      <div className={styles.field}><span>カリキュラム</span><div className={styles.curriculum}>{(marketing.curriculum ?? []).map((title, index) => <div className={styles.curriculumRow} key={index}><span>{index + 1}</span><input aria-label={`カリキュラム ${index + 1}`} value={title} onChange={event => changeMarketing({ curriculum: marketing.curriculum!.map((item, i) => i === index ? event.target.value : item) })} /><button className={styles.plainButton} type="button" aria-label={`カリキュラム ${index + 1}を削除`} onClick={() => changeMarketing({ curriculum: marketing.curriculum!.filter((_, i) => i !== index) })}>×</button></div>)}<button className={styles.plainButton} type="button" onClick={() => changeMarketing({ curriculum: [...(marketing.curriculum ?? []), ""] })}>＋ カリキュラムを追加</button></div><small>カリキュラムはサービスページにも表示されます。教材本文は次の画面で編集します。</small></div>
      <div className={styles.columns}><label className={styles.field}>所要時間<input value={value.durationText} onChange={event => onChange("durationText", event.target.value)} placeholder="例：約60分" /></label>{priceField !== undefined ? priceField : <label className={styles.field}>基本価格（税込）<input required type="number" min={0} step={1} inputMode="numeric" value={Number.isFinite(value.price) ? value.price : ""} onChange={event => onChange("price", event.target.value === "" ? Number.NaN : Number(event.target.value))} /><small>サービスを作るときに変更できます。</small></label>}</div>
    </section>
    <section className={styles.section} aria-label="教材・キット"><h2>教材・キット</h2><label className={styles.toggle}><input type="checkbox" checked={kit} onChange={event => toggleKit(event.target.checked)} />教材・キットを使う</label>{kit && <label className={styles.field}>教材・キットの内容<textarea rows={3} value={value[kitField.current]} onChange={event => onChange(kitField.current, event.target.value)} /></label>}</section>
  </div>;
}
