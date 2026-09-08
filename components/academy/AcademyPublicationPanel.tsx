"use client";

import { useEffect, useRef, useState } from "react";
import type { AcademyCourse } from "@/types/database";
import { AcademyHelp } from "./AcademyHelp";

/** Confirmation only. Publication permissions and billing remain owned by the existing API. */
export function AcademyPublicationPanel({ course, sample, onChange }: {
  course: AcademyCourse;
  sample: boolean;
  onChange: (published: boolean) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [target, setTarget] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (target !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [target]);
  function cancel() {
    if (busy.current) return;
    setTarget(null);
    setConfirmed(false);
    setError("");
  }
  async function submit() {
    if (target === null || !confirmed || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await onChange(target);
      setNotice(sample ? "この画面内だけで表示を切り替えました。実際の公開・保存はしていません。" : target ? "保存済みの内容を公開しました。" : "講座の紹介ページを非公開にしました。");
      setTarget(null);
      setConfirmed(false);
    } catch {
      setError("変更できませんでした。通信や利用権限を確認して、もう一度お試しください。入力内容はそのままです。");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const button = "min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm disabled:opacity-40";
  return <section id="course-publication" data-academy-local-publication={process.env.NODE_ENV === "development" && sample ? "true" : undefined} className="mb-4 space-y-3 rounded-lg border border-[var(--mikke-line)] border-t-4 border-t-[#8bc7ad] bg-white p-4">
    <h2 className="text-lg font-bold">講座を公開する</h2>
    <p className="text-sm">現在：<strong>{course.is_published ? "公開中" : "下書き（非公開）"}</strong></p>
    <p className="text-sm leading-6">公開すると、保存済みの講座紹介ページが受講希望者に表示されます。編集途中の内容は、先に「変更を保存する」で保存してください。</p>
    {sample ? <p className="text-sm">ローカル確認中です。実際の公開・課金は行いません。</p> : null}
    <AcademyHelp title="公開と利用契約の違い">公開・非公開は講座紹介ページの表示設定です。下書きに戻す操作は利用契約の解約ではありません。利用期限・料金は本部ホームの「利用状態・料金を確認」で確認できます。</AcademyHelp>
    {process.env.NODE_ENV === "development" && sample ? <p className="text-sm leading-6"><a href="/academy/flow-review" className="text-[var(--mikke-primary)] underline">初公開から7日無料の新しい案を試す →</a><br />別画面の操作見本です。この講座や現在の契約には適用しません。</p> : null}
    <button type="button" className={`${button} bg-[var(--mikke-accent)] font-bold text-white`} onClick={() => { setNotice(""); setTarget(!course.is_published); }}>
      {course.is_published ? "非公開にする前に確認" : "公開前の確認へ"}
    </button>
    {notice ? <p role="status" className="text-sm leading-6">{notice}</p> : null}
    <dialog ref={dialog} aria-labelledby="academy-publication-title" onCancel={event => { event.preventDefault(); cancel(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-[var(--mikke-line)] bg-white p-5 text-[var(--mikke-text)]">
      <h2 id="academy-publication-title" className="text-xl font-bold">{target ? "公開する内容を確認" : "非公開にする前に確認"}</h2>
      <p className="mt-2 text-sm leading-6">{sample ? "操作見本です。公開・保存・課金は行いません。" : "この操作は講座紹介ページの表示を変更します。"}</p>
      <dl className="my-4 space-y-3 rounded-lg border border-[var(--mikke-line)] p-4 text-sm">
        <div><dt>保存済みの講座名</dt><dd className="mt-1 break-words font-bold">{course.name}</dd></div>
        <div><dt>保存済みの受講料（Academyの月額料金ではありません）</dt><dd className="mt-1 font-bold">{new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(course.price)}</dd></div>
      </dl>
      <p className="text-sm leading-7">{target ? "未保存の編集内容は含まれません。講座名・受講料・紹介内容を保存してから公開してください。" : "受講希望者向けの紹介ページを非公開にします。講座の削除や、Academy利用契約の解約ではありません。"}</p>
      <label className="my-4 flex min-h-11 items-start gap-2 text-sm leading-7"><input type="checkbox" className="mt-2" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} />{target ? "保存済みの内容を公開することを確認しました" : "非公開にしても利用契約は終了しないことを確認しました"}</label>
      {error ? <p role="alert" className="mb-3 text-sm leading-6">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={saving} onClick={cancel}>戻って確認する</button><button type="button" disabled={!confirmed || saving} className={`${button} bg-[var(--mikke-accent)] font-bold text-white`} onClick={submit}>{saving ? "変更中…" : sample ? "見本の表示を切り替える" : target ? "保存済みの内容を公開する" : "非公開にする"}</button></div>
    </dialog>
  </section>;
}
