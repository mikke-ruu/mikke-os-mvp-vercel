"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getListedInstructor, getPublicCourse, listPublicClasses } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyInstructor, AcademyPublicClass } from "@/types/database";

function formatLabel(f: string) {
  return f === "in_person" ? "対面" : f === "online" ? "オンライン" : f;
}

// MUSUBIサイト風: 余白多め・中央揃え・上品なセクション見出し
function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <section className="border-t border-[var(--mikke-line)] px-5 py-8 md:px-12 md:py-12">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-sm font-bold tracking-[0.2em] text-[var(--mikke-accent-strong)] md:text-base">{title}</h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)] md:text-[15px] md:leading-8">{body}</p>
      </div>
    </section>
  );
}

function ApplyButton({ href, label = "この講座に申し込む" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mx-auto block w-full max-w-xs rounded-full bg-[var(--mikke-accent)] py-3.5 text-center text-sm font-bold tracking-wider text-white transition hover:opacity-90"
    >
      {label}
    </Link>
  );
}

function PublicLpInner({ courseId }: { courseId: string }) {
  const searchParams = useSearchParams();
  const instructorId = searchParams.get("k");
  const preview = searchParams.get("preview");
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [instructor, setInstructor] = useState<AcademyInstructor | null>(null);
  const [classes, setClasses] = useState<AcademyPublicClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const c = await getPublicCourse(courseId);
      setCourse(c);
      if (c) {
        const [listedInstructor, publicClasses] = await Promise.all([
          instructorId ? getListedInstructor(instructorId).catch(() => null) : Promise.resolve(null),
          listPublicClasses(c.id, instructorId).catch(() => [])
        ]);
        setInstructor(listedInstructor);
        setClasses(publicClasses);
      }
      setLoading(false);
    }
    load();
  }, [courseId, instructorId]);

  if (loading) return <p className="py-20 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!course || !course.is_published) {
    return <p className="py-20 text-center text-sm text-[var(--mikke-muted)]">この講座は公開されていません。</p>;
  }

  function buildApplyHref(classId?: string) {
    const params = new URLSearchParams();
    if (instructorId) params.set("k", instructorId);
    if (classId) params.set("class", classId);
    if (preview) params.set("preview", preview);
    const query = params.toString();
    return `/academy/apply/${course!.id}${query ? `?${query}` : ""}`;
  }

  const applyHref = buildApplyHref();

  return (
    <div className="mx-auto md:max-w-4xl md:px-6 md:py-10">
      <div className="overflow-hidden bg-white md:rounded-3xl md:shadow-sm">
        {course.main_image_url ? (
          <img src={course.main_image_url} alt="" className="h-56 w-full object-cover md:h-[26rem]" />
        ) : (
          <div className="h-24 bg-[var(--mikke-accent-soft)] md:h-40" />
        )}

        {/* ファーストビュー */}
        <div className="px-5 py-8 text-center md:px-12 md:py-12">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--mikke-accent-strong)]">{course.code}</p>
          <h1 className="mt-3 text-2xl font-bold leading-9 tracking-wide text-[var(--mikke-text)] md:text-4xl md:leading-[3.2rem]">
            {course.name}
          </h1>
          {course.subtitle ? (
            <p className="mt-2 text-sm tracking-wider text-[var(--mikke-muted)] md:text-base">{course.subtitle}</p>
          ) : null}

          <div className="mx-auto mt-7 flex max-w-xl flex-col divide-y divide-[var(--mikke-line)] rounded-2xl bg-[var(--mikke-surface-soft)] text-sm text-[var(--mikke-text)] md:flex-row md:divide-x md:divide-y-0">
            <div className="flex-1 px-4 py-3 md:py-4">
              <p className="text-[11px] tracking-widest text-[var(--mikke-accent-strong)]">受講料</p>
              <p className="mt-1 font-bold">{course.price.toLocaleString()}円</p>
            </div>
            {course.duration_text ? (
              <div className="flex-1 px-4 py-3 md:py-4">
                <p className="text-[11px] tracking-widest text-[var(--mikke-accent-strong)]">所要時間</p>
                <p className="mt-1 font-bold">{course.duration_text}</p>
              </div>
            ) : null}
            {course.formats.length ? (
              <div className="flex-1 px-4 py-3 md:py-4">
                <p className="text-[11px] tracking-widest text-[var(--mikke-accent-strong)]">受講形式</p>
                <p className="mt-1 font-bold">{course.formats.map(formatLabel).join(" / ")}</p>
              </div>
            ) : null}
          </div>

          {instructor ? (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[var(--mikke-line)] p-4 text-left md:p-5">
              <p className="text-xs font-bold tracking-widest text-[var(--mikke-accent-strong)]">開催講師</p>
              <p className="mt-1 text-sm font-bold text-[var(--mikke-text)] md:text-base">{instructor.business_name || "認定講師"}</p>
              {instructor.area ? (
                <p className="text-xs text-[var(--mikke-muted)]">
                  {instructor.area}
                  {instructor.online_available ? " ・ オンライン対応" : ""}
                </p>
              ) : null}
              {instructor.message ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text)]">{instructor.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8">
            <ApplyButton
              href={classes.length ? "#academy-schedules" : applyHref}
              label={classes.length ? "開催日程を見る" : undefined}
            />
          </div>
        </div>

        {classes.length ? (
          <section id="academy-schedules" className="scroll-mt-6 border-t border-[var(--mikke-line)] px-5 py-8 md:px-12 md:py-12">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-center text-sm font-bold tracking-[0.2em] text-[var(--mikke-accent-strong)] md:text-base">開催日程</h2>
              <p className="mt-2 text-center text-sm leading-6 text-[var(--mikke-muted)]">希望する日程を選んでお申し込みください。</p>
              <div className="mt-5 space-y-3">
                {classes.map((academyClass) => {
                  const fixed = academyClass.schedule_mode === "fixed";
                  const startsAt = new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(academyClass.starts_at));
                  return (
                    <article key={academyClass.id} className="rounded-2xl border border-[var(--mikke-line)] p-4 md:p-5">
                      <p className="text-base font-bold text-[var(--mikke-text)]">{academyClass.title}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--mikke-accent-strong)]">
                        {fixed ? startsAt : "お申し込み後に日程をご相談"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
                        {formatLabel(academyClass.format)}
                        {academyClass.format === "in_person" && academyClass.venue_name ? ` ・ ${academyClass.venue_name}` : ""}
                        {academyClass.remaining_capacity !== null ? ` ・ 残り${academyClass.remaining_capacity}名` : ""}
                      </p>
                      <Link
                        href={buildApplyHref(academyClass.id)}
                        className="mt-4 inline-flex rounded-full bg-[var(--mikke-accent)] px-5 py-2.5 text-sm font-bold text-white"
                      >
                        この日程で申し込む
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <Section title="講座について" body={course.description} />
        <Section title="受講後にできること" body={course.can_do_after} />
        <Section title="認定条件" body={course.certification_conditions} />
        <Section title="キット内容" body={course.kit_contents} />
        <Section title="教材内容" body={course.material_contents} />

        {course.lp_blocks?.length ? (
          <section className="border-t border-[var(--mikke-line)] px-5 py-8 md:px-12 md:py-12">
            <div className="mx-auto max-w-2xl space-y-5">
              {course.lp_blocks.map((b, i) => {
                if (b.type === "heading")
                  return (
                    <h2 key={i} className="pt-2 text-center text-lg font-bold tracking-wide text-[var(--mikke-text)] md:text-xl">
                      {b.text}
                    </h2>
                  );
                if (b.type === "text")
                  return (
                    <p key={i} className="whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)] md:text-[15px] md:leading-8">
                      {b.text}
                    </p>
                  );
                if (b.type === "image")
                  return b.url ? (
                    <figure key={i}>
                      <img src={b.url} alt={b.caption ?? ""} className="w-full rounded-xl" />
                      {b.caption ? (
                        <figcaption className="mt-1 text-center text-xs text-[var(--mikke-muted)]">{b.caption}</figcaption>
                      ) : null}
                    </figure>
                  ) : null;
                if (b.type === "image-text")
                  return (
                    <div key={i} className="grid gap-4 sm:grid-cols-2 sm:items-center">
                      {b.imageUrl ? <img src={b.imageUrl} alt="" className="w-full rounded-xl" /> : null}
                      <div>
                        {b.heading ? <h3 className="text-base font-bold text-[var(--mikke-text)] md:text-lg">{b.heading}</h3> : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)] md:text-[15px] md:leading-8">{b.text}</p>
                      </div>
                    </div>
                  );
                if (b.type === "gallery")
                  return b.images.length ? (
                    <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {b.images.filter((img) => img.url).map((img, j) => (
                        <figure key={j}>
                          <img src={img.url} alt={img.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" />
                          {img.caption ? <figcaption className="mt-1 text-center text-xs text-[var(--mikke-muted)]">{img.caption}</figcaption> : null}
                        </figure>
                      ))}
                    </div>
                  ) : null;
                if (b.type === "cta")
                  return b.buttonUrl ? (
                    <div key={i} className="rounded-2xl bg-[var(--mikke-surface-soft)] p-6 text-center">
                      {b.heading ? <p className="text-base font-bold text-[var(--mikke-text)]">{b.heading}</p> : null}
                      <a
                        href={b.buttonUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-block rounded-full bg-[var(--mikke-accent)] px-6 py-3 text-sm font-bold tracking-wider text-white"
                      >
                        {b.buttonLabel || "詳しく見る"}
                      </a>
                    </div>
                  ) : null;
                return null;
              })}
            </div>
          </section>
        ) : null}

        {course.faq.length ? (
          <section className="border-t border-[var(--mikke-line)] px-5 py-8 md:px-12 md:py-12">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-center text-sm font-bold tracking-[0.2em] text-[var(--mikke-accent-strong)] md:text-base">よくあるご質問</h2>
              <dl className="mt-5 space-y-4">
                {course.faq.map((f, i) => (
                  <div key={i} className="rounded-2xl bg-[var(--mikke-surface-soft)] p-4 md:p-5">
                    <dt className="text-sm font-bold text-[var(--mikke-text)]">Q. {f.q}</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text)]">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ) : null}

        <div className="border-t border-[var(--mikke-line)] px-5 py-10 md:px-12">
          <ApplyButton
            href={classes.length ? "#academy-schedules" : applyHref}
            label={classes.length ? "開催日程を選ぶ" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export default function PublicCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)]">
      <Suspense fallback={<p className="py-20 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>}>
        <PublicLpInner courseId={id} />
      </Suspense>
    </main>
  );
}
