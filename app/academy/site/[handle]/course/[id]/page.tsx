"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPublicHomepage } from "@/lib/academy/public-homepage";
import { getPublicCourseOverview, type PublicCourseOverview } from "@/lib/academy/public-course-overview";

function Detail({ title, body }: { title: string; body: string | null }) {
  if (!body?.trim()) return null;
  return <section className="border-t border-[var(--mikke-line)] py-6">
    <h2 className="text-base font-bold text-[var(--mikke-text)]">{title}</h2>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)]">{body}</p>
  </section>;
}

export default function PublicCourseOverviewPage() {
  const { handle, id } = useParams<{ handle: string; id: string }>();
  const [course, setCourse] = useState<PublicCourseOverview | null>(null);
  const [headquartersName, setHeadquartersName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const homepageHref = `/academy/site/${encodeURIComponent(handle)}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const homepage = await getPublicHomepage(handle);
        const listed = homepage?.courses.some(item => item.id === id);
        const detail = homepage && listed ? await getPublicCourseOverview(homepage.headquarters.id, id) : null;
        if (!active) return;
        setHeadquartersName(homepage?.headquarters.name ?? "");
        setCourse(detail);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [handle, id, retry]);

  if (loading) return <main className="px-5 py-20 text-center text-sm">読み込み中…</main>;
  if (loadError) return <main role="alert" className="px-5 py-20 text-center text-sm">
    <p>講座を読み込めませんでした。</p>
    <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-4 min-h-11 underline">もう一度読み込む</button>
  </main>;
  if (!course) return <main className="px-5 py-20 text-center text-sm">この講座の公開情報は見つかりませんでした。</main>;

  return <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-5 py-8 md:py-12">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
      {course.main_image_url ? <img src={course.main_image_url} alt="" className="h-52 w-full object-cover md:h-80" /> : null}
      <div className="px-5 py-7 md:px-10 md:py-9">
        <Link href={homepageHref} className="text-sm font-bold text-[var(--mikke-accent)] underline">← {headquartersName}のホームページへ</Link>
        {course.code ? <p className="mt-6 text-xs font-bold tracking-widest text-[var(--mikke-accent-strong)]">{course.code}</p> : null}
        <h1 className="mt-2 text-2xl font-bold leading-9 text-[var(--mikke-text)]">{course.name}</h1>
        {course.subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{course.subtitle}</p> : null}
        {course.duration_text ? <p className="mt-5 text-sm text-[var(--mikke-text)]">目安の学習時間：{course.duration_text}</p> : null}
        <div className="mt-7">
          <Detail title="講座について" body={course.description} />
          <Detail title="受講後にできること" body={course.can_do_after} />
          <Detail title="教材・キット" body={course.kit_contents} />
          <Detail title="教材の案内" body={course.material_contents} />
          <Detail title="認定条件" body={course.certification_conditions} />
        </div>
        <p className="mt-6 text-sm leading-6 text-[var(--mikke-muted)]">申込については本部のホームページをご確認ください。</p>
        <Link href={homepageHref} className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--mikke-accent)] underline">ホームページへ戻る</Link>
      </div>
    </article>
  </main>;
}
