"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const guide = [
  { title: "まず、一つの講座をつくります", body: "Academyは教室・講座を運営する人のための場所です。講座名と受講料で下書きを保存し、紹介・開催方法・申込を順番に整えます。教材や認定は、必要な場合だけ設定します。" },
  { title: "紹介ページで、申込を受け付けます", body: "講座の編集後、紹介ページの見せ方を整えて公開します。受講者にはそのページを案内します。届いた申込や講師からの注文は「申込・受注管理」で確認します。下書き保存だけで公開や課金は行いません。" },
  { title: "開催日と参加者を管理します", body: "「開催日程・担当講師」で、登録した講座の開催日や参加者を管理します。複数の講師で教える場合は「講師管理」も使います。普段はホームの業務メニューから直接進めます。迷ったら「？」と、このガイドをいつでも開いてください。" }
];

export function AcademyGettingStarted({ empty, scope }: { empty: boolean; scope: string }) {
  const [dismissed, setDismissed] = useState(true);
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const storageKey = `academy:guide:v1:${scope}`;
  useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey) === "dismissed"); }
    catch { setDismissed(false); }
  }, [storageKey]);
  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "dismissed"); } catch { /* Guidance remains usable without storage. */ }
    dialog.current?.close();
  }
  function openGuide() { setStep(0); dialog.current?.showModal(); }
  return <section>
    <button type="button" onClick={openGuide} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)]">？ 使い方ガイド</button>
    {empty && !dismissed ? <div className="mt-2 border border-[var(--mikke-line)] p-4">
      <p className="font-bold">はじめての講座づくりをお手伝いします</p>
      <p className="mt-2 text-sm leading-7">何から始めるかを、3つの短い案内で確認できます。</p>
      <div className="mt-2 flex flex-wrap gap-x-5"><button type="button" onClick={openGuide} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)]">案内を見る →</button><button type="button" onClick={dismiss} className="min-h-11 text-sm text-[var(--mikke-muted)]">今はスキップ</button></div>
    </div> : null}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={dismiss} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border border-[var(--mikke-line)] bg-white p-5 text-[var(--mikke-text)] backdrop:bg-black/20">
      <div className="flex items-center justify-between gap-3"><p className="text-sm">使い方ガイド · {step + 1} / {guide.length}</p><button type="button" onClick={dismiss} className="min-h-11 px-2 text-sm">閉じる</button></div>
      <div aria-live="polite"><h2 id={titleId} className="mt-3 text-xl font-bold">{guide[step].title}</h2><p className="mt-4 text-sm leading-8">{guide[step].body}</p></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)} className="min-h-11 px-2 text-sm disabled:opacity-30">← 前へ</button>
        {step < guide.length - 1 ? <button type="button" onClick={() => setStep(value => value + 1)} className="min-h-11 border border-[var(--mikke-primary)] px-4 text-sm font-bold text-[var(--mikke-primary)]">次へ →</button> : <Link href="/academy/courses/new" onClick={dismiss} className="inline-flex min-h-11 items-center bg-[var(--mikke-accent)] px-4 text-sm font-bold text-white">最初の講座をつくる</Link>}
      </div>
    </dialog>
  </section>;
}
