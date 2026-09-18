"use client";

import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import type { CourseInput } from "@/lib/academy/courses";
import type { AcademyCourseMarketing } from "@/types/database";
import { courseMarketing, courseImages } from "@/lib/academy/course-marketing";

const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-base outline-none focus:border-[var(--mikke-primary)]";

/** Controlled inputs only: the parent retains the complete existing CourseInput. */
export function AcademyCourseInput({ value, onChange }: {
  value: CourseInput;
  onChange: <K extends keyof CourseInput>(key: K, value: CourseInput[K]) => void;
}) {
  const marketing = courseMarketing(value.featureSettings.marketing);
  const images = courseImages(marketing, value.mainImageUrl);
  function changeMarketing(patch: AcademyCourseMarketing) { onChange("featureSettings", { ...value.featureSettings, marketing: { ...value.featureSettings.marketing, ...patch } }); }
  function changeImages(next: string[]) { changeMarketing({ images: next }); onChange("mainImageUrl", next[0] ?? ""); }
  return <section aria-label="講座情報" className="space-y-5 bg-white">
    <h2 className="text-lg font-bold">講座情報</h2>
    <label className="block text-sm font-bold">講座名
      <input required maxLength={200} className={inputClass} value={value.name} onChange={event => onChange("name", event.target.value)} autoComplete="off" />
    </label>
    <label className="block text-sm font-bold">カテゴリー<input className={inputClass} maxLength={100} value={marketing.category ?? ""} onChange={event => changeMarketing({ category: event.target.value })} placeholder="例：アクセサリー" /></label>
    <div className="space-y-3">
      <p className="text-sm font-bold">講座画像</p>
      <p className="text-xs">1枚目をサムネイルに使います。複数の画像は5秒ごとに切り替わります。</p>
      {images.map((url, index) => <div key={`${index}:${url}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--mikke-line)] pb-3"><div className="max-w-[180px]"><AcademyImageUploader compact currentUrl={url} onUploaded={next => changeImages(images.map((image, i) => i === index ? next : image))} /></div><div className="flex flex-wrap gap-2 text-sm"><span className="w-full">{index === 0 ? "1枚目・サムネイル" : `${index + 1}枚目`}</span><button type="button" disabled={index === 0} className="min-h-11 px-2 disabled:opacity-40" onClick={() => { const next = [...images]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; changeImages(next); }}>前へ</button><button type="button" disabled={index === images.length - 1} className="min-h-11 px-2 disabled:opacity-40" onClick={() => { const next = [...images]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; changeImages(next); }}>次へ</button><button type="button" className="min-h-11 px-2 text-[var(--mikke-danger)]" onClick={() => changeImages(images.filter((_, i) => i !== index))}>画像を削除</button></div></div>)}
      <AcademyImageUploader compact onUploaded={url => changeImages([...images, url])} helperText="講座画像を追加します。" />
    </div>
    <label className="block text-sm font-bold">講座説明
      <textarea className={`${inputClass} min-h-32`} value={value.description} onChange={event => onChange("description", event.target.value)} />
    </label>
    <label className="block text-sm font-bold">受講後にできること
      <textarea className={`${inputClass} min-h-24`} value={value.canDoAfter} onChange={event => onChange("canDoAfter", event.target.value)} />
    </label>
    <label className="block text-sm font-bold">カリキュラム<textarea className={`${inputClass} min-h-28`} value={(marketing.curriculum ?? []).join("\n")} onChange={event => changeMarketing({ curriculum: event.target.value.split("\n") })} placeholder="1行に1つずつ入力してください。" /><span className="mt-1 block text-xs font-normal">募集ページに表示する項目です。レッスン教材の本文は次の画面で編集します。</span></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-bold">所要時間
        <input className={inputClass} value={value.durationText} onChange={event => onChange("durationText", event.target.value)} placeholder="例：90分" />
      </label>
      <label className="block text-sm font-bold">基本価格（税込・円）
        <input required type="number" min={0} step={1} inputMode="numeric" className={inputClass} value={Number.isFinite(value.price) ? value.price : ""} onChange={event => onChange("price", event.target.value === "" ? Number.NaN : Number(event.target.value))} />
      </label>
    </div>
    <label className="block text-sm font-bold">教材・キットの案内（任意）
      <textarea className={`${inputClass} min-h-24`} value={value.materialContents} onChange={event => onChange("materialContents", event.target.value)} placeholder="例：当日テキストを配布します。" />
      <span className="mt-1 block text-xs font-normal leading-5 text-[var(--mikke-muted)]">受講者向けの紹介文です。教材本文は次の画面で編集します。</span>
    </label>
  </section>;
}
