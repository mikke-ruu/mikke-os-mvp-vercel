"use client";

import { useId, useRef, useState } from "react";

type Role = "learner" | "instructor";
type Stage = "applied" | "learning" | "completed";
type Props = { role: Role; title: string; courseNames: string[]; price?: number };
const menus = {
  learner: [
    ["教材・復習", "入金確認と閲覧期間の条件を満たすと、受講する講座の教材が表示されます。ここには教材本文を読み込んでいません。"],
    ["申し込んだ募集", "申込時の金額・支払方法・入金状況を確認します。段階購入は前の講座の修了後に、元の募集ページから次の講座へ進みます。"],
  ],
  instructor: [
    ["講師マニュアル", "本部が用意した講座運営のマニュアルや資料を確認します。実際の表示は講師登録と権限に従います。"],
    ["自分の募集ページ", "有効な資格がある講座の本部募集を選びます。本部の講座内容・価格はそのままで、プロフィールと追加の案内を編集します。"],
    ["募集ページからの申込", "自分の募集ページから届いた担当申込だけを確認します。入金確認は本部で行います。"],
    ["プロフィール・紹介URL・QR", "営業プロフィールを整え、紹介URLやQRコードで案内します。この見本には実際のURLやQRコードを表示していません。"],
    ["Community", "参加しているCommunityを確認します。講師認定だけで自動参加にはならず、別途招待・参加が必要です。"],
  ],
} as const;

export function AcademyRolePreview({ role, title, courseNames, price }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const [stage, setStage] = useState<Stage>("applied");
  const [selected, setSelected] = useState(0);
  const label = role === "learner" ? "受講者マイページの見本" : "認定後の講師マイページの見本";
  const items = menus[role];
  function open() { setStage("applied"); setSelected(0); dialog.current?.showModal(); }
  function close() { dialog.current?.close(); }
  return <>
    <button ref={trigger} type="button" onClick={open} className="min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-primary)]">{label}を見る</button>
    <dialog ref={dialog} aria-labelledby={headingId} onClose={() => trigger.current?.focus()} className="m-auto max-h-[90dvh] w-[min(760px,calc(100%_-_24px))] overflow-y-auto rounded-xl border border-[var(--mikke-line)] bg-white p-0 text-[var(--mikke-text)] backdrop:bg-black/40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--mikke-line)] bg-white px-4 py-2"><h2 id={headingId} className="font-bold">{label}</h2><button type="button" onClick={close} className="min-h-11 shrink-0 px-3 text-sm" aria-label="見本を閉じる">閉じる ×</button></header>
      <div className="space-y-4 p-4 sm:p-5">
        <p className="border-l-2 border-[var(--mikke-accent)] pl-3 text-sm leading-6">画面構成の見本です。入力中の講座・募集の情報だけを使っています。申込・保存・認定・決済は行わず、実際の受講者や講師の情報は表示しません。</p>
        {role === "learner" ? <div className="flex flex-wrap gap-2" aria-label="見本の受講状況">{([["applied", "申込直後"], ["learning", "利用開始後"], ["completed", "修了後"]] as const).map(([value, text]) => <button type="button" key={value} aria-pressed={stage === value} onClick={() => setStage(value)} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 text-sm aria-pressed:bg-[var(--mikke-accent-soft)] aria-pressed:font-bold">{text}</button>)}</div> : <p className="text-sm">認定・講師登録が完了した後の画面構成です。実際のメニューは登録状況や権限によって変わります。</p>}
        <div className="grid gap-5 md:grid-cols-[1fr_240px]">
          <section className="min-w-0 border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4" aria-label="マイページ見本">
            <p className="text-xs font-bold text-[var(--mikke-primary)]">ACADEMY ／ 見本</p><h3 className="mt-2 text-lg font-bold">{role === "learner" ? "受講する講座" : "教える・案内する"}</h3>
            <p className="mt-1 text-xs text-[var(--mikke-muted)]">{role === "learner" ? "受講者の見本" : "講師の見本（個人情報は未使用）"}</p>
            <div className="my-4 border-y border-[var(--mikke-line)] py-3"><h4 className="break-words font-bold">{title.trim() || "入力した講座・募集名"}</h4><p className="mt-1 text-xs">{role === "instructor" ? "認定済みの表示例" : stage === "applied" ? "入金確認待ちの表示例" : stage === "learning" ? "教材利用中の表示例" : "修了済みの表示例（自動認定ではありません）"}</p>{courseNames.length > 0 ? <ul className="mt-3 space-y-1 text-sm">{courseNames.map((name, index) => <li key={index}>{name || "講座名未入力"}</li>)}</ul> : <p className="mt-3 text-sm">講座を選ぶと、ここに講座名が表示されます。</p>}{role === "learner" && Number.isFinite(price) ? <p className="mt-3 text-sm">入力中の募集価格 ¥{price!.toLocaleString("ja-JP")} <span className="text-xs">（実際の申込金額ではありません）</span></p> : null}</div>
            <div className="divide-y divide-[var(--mikke-line)]">{items.map(([name], index) => <button type="button" key={name} aria-pressed={selected === index} onClick={() => setSelected(index)} className="flex min-h-12 w-full items-center justify-between gap-2 py-3 text-left text-sm aria-pressed:font-bold aria-pressed:text-[var(--mikke-primary)]"><span>{name}</span><span aria-hidden="true">›</span></button>)}</div>
            <div className="mt-4 flex justify-around gap-2 border-t border-[var(--mikke-line)] pt-3 text-xs" aria-label="下部メニューの見本"><span>ホーム</span><span>{role === "learner" ? "復習・資料" : "募集"}</span><span>{role === "learner" ? "自分の申込" : "募集の申込"}</span></div>
          </section>
          <aside className="text-sm leading-7" aria-live="polite"><h3 className="font-bold">{items[selected]?.[0]}</h3><p className="mt-2">{items[selected]?.[1]}</p>{role === "learner" && selected === 0 ? <p className="mt-3">{stage === "applied" ? "この段階では教材を開けません。" : stage === "learning" ? "実際の教材は入金確認・閲覧期間の条件に従って表示されます。" : "修了後の閲覧は設定した期間に従います。修了後に期間が始まる教材は、修了記録後に利用できます。"}</p> : null}<p className="mt-4 text-xs text-[var(--mikke-muted)]">メニューを押すと説明が変わります。実際のページには移動しません。</p></aside>
        </div>
      </div>
    </dialog>
  </>;
}
