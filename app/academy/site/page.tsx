"use client";
import { academyCourseCode } from "@/lib/academy/course-display";


import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarCheck, ClipboardPen, GraduationCap, Search } from "lucide-react";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { getPublicHomepage, type PublicHomepage } from "@/lib/academy/public-homepage";

import { readFrontDocument, frontMaxWidth } from "@/lib/academy/front-design";
import { AcademyPublicServices } from "@/components/academy/AcademyPublicServices";
import { AcademyFrontHero } from "@/components/academy/AcademyFrontHero";

// フロントページ（一般公開）: 講座紹介・申込への入口
// 背景=白 / アクセント=オレンジ（将来は本部のmain_colorに差し替え）

const steps = [
  { icon: Search, no: "01", title: "講座を選ぶ", desc: "学びたい講座を見つけます" },
  { icon: ClipboardPen, no: "02", title: "申し込む", desc: "フォームからお申込み" },
  { icon: CalendarCheck, no: "03", title: "受講する", desc: "当日を楽しみにお越しください" },
  { icon: GraduationCap, no: "04", title: "受講後のご案内", desc: "受講後の流れは各講座の案内をご確認ください" }
];

function SitePage() {
  const params = useParams<{ handle?: string | string[] }>();
  const handle = Array.isArray(params.handle) ? params.handle[0] : params.handle;
  const [hq, setHq] = useState<PublicHomepage["headquarters"] | null>(null);
  const [courses, setCourses] = useState<PublicHomepage["courses"]>([]);
  const [instructors, setInstructors] = useState<PublicHomepage["instructors"]>([]);
  const [offerings, setOfferings] = useState<PublicHomepage["offerings"]>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const result = handle ? await getPublicHomepage(handle) : null;
        if (cancelled) return;
        setHq(result?.headquarters ?? null);
        setCourses(result?.courses ?? []);
        setInstructors(result?.instructors ?? []);
        setOfferings(result?.offerings ?? null);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [handle, retry]);

  if (loading) return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (loadError) return <div role="alert" className="py-24 text-center"><p>ホームページを読み込めませんでした。</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</button></div>;
  if (!hq) return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">本部ホームページが見つかりません。</p>;

  const document = readFrontDocument(hq.front_blocks ?? []);
  return (
    <div>
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 backdrop-blur">
        <div style={{ maxWidth: frontMaxWidth(document.design, 1024) }} className="mx-auto flex  items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-base font-bold leading-none text-[var(--mikke-accent)]">{hq.name}</p>
            <p className="mt-0.5 text-[9px] font-bold tracking-[0.3em] text-[var(--mikke-muted-light)]">Academy</p>
          </div>
          <a
            href={offerings?.length ? "#services" : "#courses"}
            className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            {offerings?.length ? "講座に申し込む" : "講座一覧を見る"}
          </a>
        </div>
      </header>

      <AcademyFrontHero design={document.design} title={hq.tagline || "わたしらしい学びで、誰かの未来を照らす。"} message={hq.front_message || `${hq.name}の講座やワークショップをご紹介します。`} imageUrl={hq.hero_image_url || ""} canApply={Boolean(offerings?.length)} />

      {/* Wave F (AC-F3): フロントの自由ブロック（ヒーローと講座一覧の間） */}
      {document.blocks.length ? (
        <section className="border-t border-[var(--mikke-line)] px-5 py-12 md:py-16">
          <div style={{ maxWidth: frontMaxWidth(document.design, 768) }} className="mx-auto ">
            <PageBlocks blocks={document.blocks} />
          </div>
        </section>
      ) : null}

      {offerings === null || offerings.length > 0 ? <div style={{ maxWidth: frontMaxWidth(document.design, 1024) }} className="mx-auto px-5"><AcademyPublicServices key={hq.id} headquartersId={hq.id} /></div> : null}

      {/* 講座一覧 */}
      <section id="courses" className="bg-[var(--mikke-surface-soft)] px-5 py-12 md:py-16">
        <div style={{ maxWidth: frontMaxWidth(document.design, 1024) }} className="mx-auto ">
          <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">講座・ワークショップ</h2>
          <p className="mt-1 text-center text-xs text-[var(--mikke-muted)]">自分らしい学びを見つけよう</p>
          {courses.length === 0 ? (
            <p className="mt-8 text-center text-sm text-[var(--mikke-muted)]">現在公開中の講座はありません。</p>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const matchingOfferings = offerings?.filter(offering => offering.course_ids.includes(c.id)) ?? [];
                const offeringHref = matchingOfferings.length === 1 ? `/academy/o/${matchingOfferings[0].id}` : "#services";
                return (
                  <li key={c.id} className="overflow-hidden rounded-3xl border border-[var(--mikke-line)] bg-white">
                  {c.main_image_url ? (
                    <img src={c.main_image_url} alt="" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-24 bg-[var(--mikke-surface-soft)]" />
                  )}
                  <div className="p-5">
                    {academyCourseCode(c.code) && <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--mikke-accent-strong)]">{academyCourseCode(c.code)}</p>}
                    <h3 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{c.name}</h3>
                    {c.subtitle ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--mikke-muted)]">{c.subtitle}</p> : null}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-[var(--mikke-text)]">
                        基本価格 {c.price.toLocaleString()}円
                        {c.duration_text ? <span className="ml-2 text-[11px] font-normal text-[var(--mikke-muted)]">{c.duration_text}</span> : null}
                      </p>
                      {matchingOfferings.length ? <a href={offeringHref} className="text-xs underline">サービスの詳細・申込を見る</a> : <span className="text-xs text-[var(--mikke-muted)]">{offerings === null ? "申込状況を確認できません" : "申込受付前"}</span>}
                    </div>
                  </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 申込から受講後まで */}
      <section className="px-5 py-12 md:py-16">
        <div style={{ maxWidth: frontMaxWidth(document.design, 896) }} className="mx-auto ">
          <h2 className="text-center text-lg font-bold tracking-[0.15em] text-[var(--mikke-text)] md:text-xl">申込から受講後まで</h2>
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
          <div style={{ maxWidth: frontMaxWidth(document.design, 896) }} className="mx-auto ">
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
