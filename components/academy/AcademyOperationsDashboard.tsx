"use client";

import Link from "next/link";
import { AcademyGettingStarted } from "./AcademyGettingStarted";
import { AcademyHelp } from "./AcademyHelp";
import { academyMonth, matchesApplication, matchesOrder } from "@/lib/academy/dashboard-summary";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import type { AcademyApplication, AcademyClass, AcademyCourse, AcademyInstructor, AcademyKitOrder } from "@/types/database";

export type AcademyDashboardData = { courses: AcademyCourse[]; apps: AcademyApplication[]; kits: AcademyKitOrder[]; instructors: AcademyInstructor[]; classes: AcademyClass[] };
const dateLabel = (value: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const panel = "rounded-lg border border-[var(--mikke-line)] bg-white p-4 sm:p-5";

export function AcademyOperationsDashboard({ name, scope, data, classesError = false }: { name: string; scope: string; data: AcademyDashboardData; classesError?: boolean }) {
  const { courses, apps, kits, instructors, classes } = data;
  const now = new Date();
  const month = academyMonth(now);
  const link = (path: string) => toCurrentAcademyContextHref(path);
  const intake = (filter = "", tab = "all") => link(`/academy/applications?tab=${tab}&filter=${filter}&month=${month}`);
  const newApps = apps.filter(a => matchesApplication(a, "new"));
  const unpaid = apps.filter(a => matchesApplication(a, "unpaid"));
  const activeKits = kits.filter(k => matchesOrder(k, "active"));
  const shipping = kits.filter(k => matchesOrder(k, "shipping"));
  const courseName = (id: string) => courses.find(c => c.id === id)?.name || "講座名を確認";
  const nextClasses = classes.filter(c => c.starts_at && !["cancelled", "completed"].includes(c.status) && new Date(c.ends_at || c.starts_at).getTime() >= now.getTime()).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!)).slice(0, 4);
  const undated = classes.filter(c => !c.starts_at && !["cancelled", "completed"].includes(c.status));
  const renewal = instructors.filter(i => i.is_active && i.renewal_due && new Date(i.renewal_due).getTime() <= now.getTime() + 30 * 86400000);
  const recorded = apps.filter(a => a.intake_source !== "koushi" && a.payment_status === "paid" && a.status !== "cancelled").reduce((n,a) => n + a.honbu_revenue, 0) + kits.filter(k => k.payment_status === "paid" && k.status !== "cancelled").reduce((n,k) => n + k.amount, 0);
  const metrics = [
    ["登録講座", courses.length, `公開 ${courses.filter(c=>c.is_published).length}・下書き ${courses.filter(c=>!c.is_published).length}`, link("/academy/courses")],
    ["今月の受講申込", apps.filter(a=>matchesApplication(a,"month",month)).length, `${month.replace("-", "年")}月・本部で閲覧できる分`, intake("month")],
    ["対応中の教材注文", activeKits.length, "未完了の注文・全期間", intake("active","koushi")],
    ["講師登録", instructors.length, `講座別の登録件数・活動中 ${instructors.filter(i=>i.is_active).length}`, link("/academy/instructors")]
  ] as const;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mikke-line)] pb-4">
      <div><p className="text-sm text-[var(--mikke-muted)]">{name}</p><h2 className="mt-1 text-2xl font-bold">教室のダッシュボード</h2><p className="mt-2 text-sm text-[var(--mikke-muted)]">申込・注文の状況を確認し、今日の仕事へ。</p></div>
      <Link href={link("/academy/courses/new")} className="inline-flex min-h-11 items-center bg-[var(--mikke-accent)] px-4 text-sm font-bold text-white">＋ 講座をつくる</Link>
    </header>
    <section aria-label="教室の状況" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, count, detail, href], index)=><Link key={label} href={href} className={`${panel} border-t-4 transition hover:border-[var(--mikke-primary)] focus-visible:outline-2 focus-visible:outline-offset-2`} style={{borderTopColor:["var(--mikke-primary)","#ffd370","var(--mikke-accent)","#8bc7ad"][index]}}><h3 className="text-sm font-bold">{label}</h3><p className="my-2 text-3xl font-bold">{count}<span className="ml-1 text-sm font-normal">件</span></p><p className="text-xs leading-5 text-[var(--mikke-muted)]">{detail}</p><span className="mt-2 block text-xs text-[var(--mikke-primary)]">一覧を確認 →</span></Link>)}</section>
    <AcademyGettingStarted empty={courses.length === 0} scope={scope} />
    <Link href={intake("", "instructor")} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--mikke-line)] border-l-4 border-l-[#ffd370] px-4 py-3 text-sm"><span className="font-bold">講師が受け付けた受講申込 {apps.filter(a=>a.intake_source === "koushi").length}件</span><span>うち新しい申込 {newApps.filter(a=>a.intake_source === "koushi").length}件 · 確認する →</span></Link>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-bold">対応が必要なこと</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">件数を押すと、その対象だけを確認できます。項目間で重複する場合があります。</p>
        <div className="mt-3 divide-y divide-[var(--mikke-line)]">{[
          ["新しい受講申込", newApps.length, intake("new")],
          ["受講料の入金確認待ち", unpaid.length, intake("unpaid")],
          ["教材の発送準備・発送待ち", shipping.length, intake("shipping","koushi")],
          ["教材代の入金確認待ち", kits.filter(k=>matchesOrder(k,"unpaid")).length, intake("unpaid","koushi")]
        ].map(([title,count,href])=><Link key={title} href={String(href)} className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm"><span>{title}</span><span className={Number(count)>0?"font-bold text-[var(--mikke-accent)]":"text-[var(--mikke-muted)]"}>{count}件 →</span></Link>)}</div>
        {renewal.length>0?<div className="mt-3 border-t border-[var(--mikke-line)] pt-3"><h3 className="text-sm font-bold">更新期限が近い・過ぎた講師</h3>{renewal.slice(0,3).map(i=><Link key={i.id} href={link(`/academy/instructors/${i.id}`)} className="block min-h-11 py-2 text-sm">{i.business_name || "講師"} · {i.renewal_due} →</Link>)}</div>:null}
      </section>
      <section className={panel}><div className="flex justify-between gap-3"><h2 className="text-lg font-bold">今日・次の開催</h2><Link href={link("/academy/classes")} className="min-h-11 text-sm text-[var(--mikke-primary)]">日程一覧 →</Link></div>
        {classesError?<p role="alert" className="text-sm">開催日程を取得できませんでした。予定なしとは判定していません。</p>:<>
          {nextClasses.length===0?<p className="py-3 text-sm text-[var(--mikke-muted)]">日付が決まっている次の開催はありません。講座を登録したら、日程一覧から開催を追加できます。</p>:nextClasses.map(c=><Link key={c.id} href={link(`/academy/classes?class=${c.id}`)} className="block border-b border-[var(--mikke-line)] py-3"><p className="text-sm text-[var(--mikke-primary)]">{dateLabel(c.starts_at!)}</p><h3 className="mt-1 font-bold">{c.title || courseName(c.course_id)}</h3><p className="mt-1 text-sm text-[var(--mikke-muted)]">{c.instructor?.business_name || "担当講師未設定"} · 定員 {c.capacity ?? "未定"}{c.capacity!==null?"名":""}</p><p className="mt-1 text-xs">開催の予定を確認 →</p></Link>)}
          {undated.length>0?<Link className="mt-3 block min-h-11 text-sm text-[var(--mikke-primary)]" href={link("/academy/classes")}>日程調整待ち {undated.length}件 · 日程一覧で確認 →</Link>:null}
        </>}
      </section>
    </div>
    <section className={panel}><div className="flex justify-between gap-3"><h2 className="text-lg font-bold">講座の管理・編集の続き</h2><Link className="min-h-11 text-sm text-[var(--mikke-primary)]" href={link("/academy/courses")}>すべての講座 →</Link></div>
      {courses.length===0?<p className="text-sm leading-7">まだ講座がありません。「講座をつくる」から、名前と料金で下書きを保存できます。</p>:<div className="divide-y divide-[var(--mikke-line)]">{[...courses].sort((a,b)=>Number(a.is_published)-Number(b.is_published)).slice(0,5).map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><h3 className="font-bold">{c.name}</h3><p className="mt-1 text-sm text-[var(--mikke-muted)]">{c.is_published?"公開中":"下書き"} · {c.price.toLocaleString()}円{!c.description?" · 紹介文が未入力":""}</p></div><Link className="inline-flex min-h-11 items-center border border-[var(--mikke-line)] px-3 text-sm text-[var(--mikke-primary)]" href={link(`/academy/courses/${c.id}`)}>{c.is_published?"内容を編集":"続きをつくる"} →</Link></div>)}</div>}
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-bold">最近の受講申込</h2>{apps.length===0?<p className="mt-3 text-sm">まだ受講申込はありません。</p>:[...apps].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,4).map(a=><Link key={a.id} href={link(`/academy/applications/${a.id}`)} className="block border-b border-[var(--mikke-line)] py-3"><p className="font-bold">{a.applicant_name}</p><p className="text-sm">{courseName(a.course_id)}</p><p className="text-xs text-[var(--mikke-muted)]">{dateLabel(a.created_at)} · 内容を確認 →</p></Link>)}</section>
      <section className={panel}><h2 className="text-lg font-bold">対応中の教材注文</h2>{activeKits.length===0?<p className="mt-3 text-sm">対応中の教材注文はありません。</p>:activeKits.slice(0,4).map(k=><Link key={k.id} href={link(`/academy/applications?tab=koushi&order=${k.id}`)} className="block border-b border-[var(--mikke-line)] py-3"><p className="font-bold">{k.title}</p><p className="text-sm">{k.amount.toLocaleString()}円 · 注文を確認 →</p></Link>)}</section>
    </div>
    <section className={panel}><h2 className="text-base font-bold">入金済みとして記録した金額〈累計〉</h2><p className="mt-2 text-2xl font-bold">{recorded.toLocaleString()}円</p><p className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">本部受付の受講申込と教材注文のうち、入金済み・取消以外の記録を集計。今月の入金額や決済会社の残高ではありません。</p><AcademyHelp title="数字の見方">今月の受講申込は日本時間の受付月で集計し、キャンセルも受付履歴として含みます。講師登録は講座ごとの登録件数で、同じ人が複数講座に登録される場合があります。金額は現在の入金記録であり、決済会社との照合や返金履歴の集計ではありません。</AcademyHelp></section>
  </div>;
}
