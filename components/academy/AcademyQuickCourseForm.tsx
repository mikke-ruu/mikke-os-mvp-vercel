"use client";

import { useRef, useState } from "react";
import { BookOpen, Check, LoaderCircle } from "lucide-react";
import type { CourseInput } from "@/lib/academy/courses";
import { getAcademyCourseSaveErrorMessage } from "@/lib/academy/course-save-errors";
import { createAcademyDraftInput } from "@/lib/academy/draft-input";

export function AcademyQuickCourseForm({ onSubmit }: { onSubmit: (input: CourseInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim() || !price.trim() || !Number.isSafeInteger(Number(price)) || Number(price) < 0) {
      setError("講座名と、0円以上の整数の受講料を入力してください。");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    try {
      const input = createAcademyDraftInput(name, price);
      submitting.current = true;
      setSaving(true);
      setError(null);
      await onSubmit(input);
    } catch (cause) {
      setError(getAcademyCourseSaveErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-base outline-none focus:border-[#3f4eb5] focus:ring-2 focus:ring-[#3f4eb5]/20";
  return <form onSubmit={submit} className="mx-auto max-w-xl space-y-6">
    <header>
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#ffd370]"><BookOpen size={24} /></span>
      <p className="text-sm font-bold text-[#3f4eb5]">最初は、2つだけ</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">どんな講座をつくりますか？</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">名前と受講料を決めて、下書きをつくりましょう。<br />紹介文・写真・日程・教材は、保存してから追加できます。</p>
    </header>
    {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6"><p className="font-bold">下書きを保存できませんでした</p><p>{error}</p><p>入力内容は残っています。確認してもう一度保存してください。</p></div> : null}
    <fieldset disabled={saving} className="space-y-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 sm:p-6">
      <label className="block text-sm font-bold">講座名<span className="ml-2 text-xs text-[var(--mikke-muted)]">必須</span><input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder="例：はじめてのキャンドルづくり" autoComplete="off" /><span className="mt-2 block text-sm font-normal text-[var(--mikke-muted)]">仮の名前でも大丈夫。後から変更できます。</span></label>
      <label className="block text-sm font-bold">受講料（税込）<span className="ml-2 text-xs text-[var(--mikke-muted)]">必須</span><span className="mt-2 flex items-center gap-3"><input required type="number" min={0} step={1} value={price} onChange={event => setPrice(event.target.value)} inputMode="numeric" className={inputClass + " !mt-0"} placeholder="例：5000" /><span>円</span></span><span className="mt-2 block text-sm font-normal leading-6 text-[var(--mikke-muted)]">無料の講座は0円。受講者が払う金額です。<br />Academyの利用料とは別で、ここで決済は行いません。</span></label>
    </fieldset>
    <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-[var(--mikke-line)] bg-white p-3 shadow-sm min-[900px]:bottom-4">
      <button disabled={saving} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f75a3b] px-4 py-3 text-base font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}{saving ? "保存しています…" : "下書きを保存して、続きをつくる"}</button>
      <p className="mt-2 text-center text-xs text-[var(--mikke-muted)]">まだ公開されません。保存後は講座一覧から再開できます。</p>
    </div>
  </form>;
}
