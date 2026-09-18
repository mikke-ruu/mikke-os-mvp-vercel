"use client";

import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import type { CourseInput } from "@/lib/academy/courses";

const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-base outline-none focus:border-[var(--mikke-primary)]";

/** Controlled inputs only: the parent retains the complete existing CourseInput. */
export function AcademyCourseInput({ value, onChange }: {
  value: CourseInput;
  onChange: <K extends keyof CourseInput>(key: K, value: CourseInput[K]) => void;
}) {
  return <section aria-label="講座情報" className="space-y-5 bg-white">
    <h2 className="text-lg font-bold">講座情報</h2>
    <label className="block text-sm font-bold">講座名
      <input required maxLength={200} className={inputClass} value={value.name} onChange={event => onChange("name", event.target.value)} autoComplete="off" />
    </label>
    <div className="space-y-1">
      <p className="text-sm font-bold">講座画像</p>
      <AcademyImageUploader currentUrl={value.mainImageUrl || undefined} onUploaded={url => onChange("mainImageUrl", url)} helperText="講座カードのサムネイルに使います。" />
      {value.mainImageUrl ? <button type="button" className="min-h-11 text-sm text-[var(--mikke-danger)]" onClick={() => onChange("mainImageUrl", "")}>画像を外す</button> : null}
    </div>
    <label className="block text-sm font-bold">講座説明
      <textarea className={`${inputClass} min-h-32`} value={value.description} onChange={event => onChange("description", event.target.value)} />
    </label>
    <label className="block text-sm font-bold">受講後にできること
      <textarea className={`${inputClass} min-h-24`} value={value.canDoAfter} onChange={event => onChange("canDoAfter", event.target.value)} />
    </label>
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
