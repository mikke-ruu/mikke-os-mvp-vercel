"use client";

import Link from "next/link";
import { AcademyHelp } from "./AcademyHelp";
import { AcademyGettingStarted } from "./AcademyGettingStarted";
import { ArrowRight, Plus } from "lucide-react";
import type { AcademyCourse } from "@/types/database";

export function AcademyStudioHome({ name, courses, pendingCount, guideScope = "local-review" }: { name: string; courses: AcademyCourse[]; pendingCount: number; guideScope?: string }) {
  const draft = courses.find(course => !course.is_published);
  const activities = [
    { title: "申込・受注管理", detail: "申込・受注管理｜受講者や講師からの申込、入金・発送を確認します。", href: "/academy/applications" },
    { title: "講師管理", detail: "講師管理｜一緒に教える人の情報や認定状況を管理します。一人で教える場合は後で構いません。", href: "/academy/instructors" },
    { title: "講座一覧・編集", detail: "登録した講座の内容や紹介ページを整える。", href: "/academy/courses" },
    { title: "開催日程・担当講師", detail: "開催日時、担当する講師、参加者を確認。", href: "/academy/classes" }
  ];
  return <div className="space-y-8 bg-white">
    <header className="border-b border-[var(--mikke-line)] pb-5">
      <p className="text-sm text-[var(--mikke-muted)]">{name}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">運営ホーム</h2>
        <Link href="/academy/courses/new" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white"><Plus size={18} />講座をつくる</Link>
      </div>
    </header>
    <AcademyGettingStarted key={guideScope} empty={courses.length === 0} scope={guideScope} />
    <nav aria-label="運営のメニュー" className="grid gap-x-8 sm:grid-cols-2">
      {activities.map(({ title, detail, href }) => <div key={href} className="border-b border-[var(--mikke-line)] py-3"><Link href={href} className="flex min-h-11 items-center justify-between gap-4 font-bold hover:text-[var(--mikke-primary)]"><span>{title}</span><ArrowRight size={18} className="shrink-0" /></Link><AcademyHelp title={title}>{detail}</AcademyHelp></div>)}
    </nav>
    {pendingCount > 0 ? <Link href="/academy/applications" className="flex min-h-11 items-center justify-between gap-3 border-l-2 border-[var(--mikke-accent)] pl-4 text-sm font-bold"><span>確認待ちの申込が {pendingCount} 件あります</span><ArrowRight size={18} /></Link> : null}
    {draft ? <section className="border-b border-[var(--mikke-line)] pb-5">
      <h2 className="text-sm text-[var(--mikke-muted)]">作成途中の講座</h2>
      <Link href={`/academy/courses/${draft.id}`} className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-3"><span className="min-w-0 break-words font-bold">{draft.name}</span><span className="text-sm text-[var(--mikke-primary)]">編集を続ける →</span></Link>
    </section> : null}
    <AcademyHelp title="Academyでできること">ここは教室・講座を運営する人の画面です。講座をつくり、紹介と申込のページを公開し、申込・入金・開催を管理できます。受講者には講座の紹介ページを案内します。「ホームページ編集」は教室全体、「講座の紹介ページ」は一つの講座の募集に使います。</AcademyHelp>
  </div>;
}
