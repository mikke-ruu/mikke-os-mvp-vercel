"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, ClipboardPen, GraduationCap, Search } from "lucide-react";
import { getPublicHeadquarters, listListedInstructors, listPublishedCourses } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

// フロントページ（一般公開）: 講座紹介・申込への入口
// 背景=白 / アクセント=オレンジ（将来は本部のmain_colorに差し替え）

const steps = [
  { icon: Search, no: "01", title: "講座を選ぶ", desc: "学びたい講座を見つけます" },
  { icon: ClipboardPen, no: "02", title: "申し込む", desc: "フォームからお申込み" },
  { icon: CalendarCheck, no: "03", title: "受講する", desc: "当日を楽しみにお越しください" },
  { icon: GraduationCap, no: "04", title: "認定証の発行", desc: "認定講師としての一歩へ" }
];

function SitePage() {
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const foundHq = await getPublicHeadquarters();
      setHq(foundHq);
      if (foundHq) {
        const [c, i] = await Promise.all([listPublishedCourses(foundHq.id), listListedInstructors(foundHq.id)]);
        setCourses(c);
        setInstructors(i);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">準備中です。</p>;

  return (
    <div>
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-base font-bold leading-none text-[var(--mikke-accent)]">{hq.name}</p>
            <p className="mt-0.5 text-[9px] font-bold tracking-[0.3em] text-[var(--mikke-muted-light)]">Academy</p>
          </div>
          <a
            href="#courses"
            className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            講座に申し込む
          </a>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 py-12 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-2xl font-bold leading-relaxed tracking-wide text-[var(--mikke-text)] md:text-4xl md:leading-[1.6]">
            {hq.tagline || "わたしらしい学びで、誰かの未来を照らす。"}
          </h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)] md:text-[15px]">
            {hq.front_message || `${hq.name}は、一人ひとりの「気づき」と「可能性」を大切にする認定講座プラットフォームです。`}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <a href="#courses" className="rounded-full bg-[var(--mikke-accent)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90">
              講座に申し込む
            </a>
            <a href="#courses" className="flex items-center gap-1 text-sm font-bold text-[var(--mikke-accent-strong)]">
              講座一覧を見る <ArrowRight size={15} />
            </a>
          </div>
        </div>
        <div>
          {hq.hero_image_url ? (
            <img src={hq.hero_image_url} alt="" className="aspect-[4/3] w-full rounded-[2rem] object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[2rem] bg-[var(--mikke-surface-soft)]">
              <GraduationCap size={48} className="text-[var(--mikke-primary-border)]" />
            </div>
          )}
        </div>
      </section>

      {/* 講座一覧 */}
      <section id="courses" className="bg-[var(--mikke-surface-soft)] px-5 py-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">認定講座一覧</h2>
          <p className="mt-1 text-center text-xs text-[var(--mikke-muted)]">自分らしい学びを見つけよう</p>
          {courses.length === 0 ? (
            <p className="mt-8 text-center text-sm text-[var(--mikke-muted)]">現在公開中の講座はありません。</p>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <li key={c.id} className="overflow-hidden rounded-3xl border border-[var(--mikke-line)] bg-white">
                  {c.main_image_url ? (
                    <img src={c.main_image_url} alt="" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-24 bg-[var(--mikke-surface-soft)]" />
                  )}
                  <div className="p-5">
                    <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--mikke-accent-strong)]">{c.code}</p>
                    <h3 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{c.name}</h3>
                    {c.subtitle ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--mikke-muted)]">{c.subtitle}</p> : null}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-[var(--mikke-text)]">
                        {c.price.toLocaleString()}円
                        {c.duration_text ? <span className="ml-2 text-[11px] font-normal text-[var(--mikke-muted)]">{c.duration_text}</span> : null}
                      </p>
                      <Link
                        href={`/academy/c/${c.id}`}
                        className="rounded-full border border-[var(--mikke-accent)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-accent)] transition hover:bg-[var(--mikke-accent-soft)]"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 受講までの流れ */}
      <section className="px-5 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">受講までの流れ</h2>
          <ol className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.no} className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
                    <Icon size={22} />
                  </span>
                  <p className="mt-2 text-[10px] font-bold tracking-[0.25em] text-[var(--mikke-accent-strong)]">STEP {s.no}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--mikke-text)]">{s.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{s.desc}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* 講師紹介 */}
      {instructors.length ? (
        <section className="bg-[var(--mikke-surface-soft)] px-5 py-12 md:py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">講師紹介</h2>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {instructors.map((ins) => (
                <li key={ins.id}>
                  <Link href={`/academy/i/${ins.id}`} className="block rounded-3xl border border-[var(--mikke-line)] bg-white p-4 text-center transition hover:border-[var(--mikke-accent)]/40">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-lg font-bold text-[var(--mikke-accent)]">
                      {(ins.business_name || "講")[0]}
                    </span>
                    <p className="mt-2 truncate text-sm font-bold text-[var(--mikke-text)]">{ins.business_name || "認定講師"}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--mikke-muted)]">
                      {ins.area || ""}
                      {ins.online_available ? "・オンライン可" : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* フッター */}
      <footer className="border-t border-[var(--mikke-line)] px-5 py-10 text-center">
        <p className="text-sm font-bold text-[var(--mikke-accent)]">{hq.name}</p>
        {hq.contact_email ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">お問い合わせ: {hq.contact_email}</p> : null}
        <p className="mt-3 text-[10px] tracking-widest text-[var(--mikke-muted-light)]">POWERED BY Academy</p>
      </footer>
    </div>
  );
}

export default function AcademySitePage() {
  return <main className="min-h-screen bg-white">{<SitePage />}</main>;
}
