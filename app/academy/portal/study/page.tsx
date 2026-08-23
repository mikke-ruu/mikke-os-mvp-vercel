"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Link2, Video } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords, listMaterialsForInstructor } from "@/lib/academy/instructor-portal";
import { getInstructorPageForViewer } from "@/lib/academy/instructor-page";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { isAcademyLocalReview, academyPreviewCourses } from "@/lib/academy/preview";
import type { AcademyCourse, AcademyInstructor, AcademyInstructorPage, AcademyMaterial } from "@/types/database";

function kindIcon(kind: AcademyMaterial["kind"]) {
  if (kind === "video") return <Video size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  if (kind === "link") return <Link2 size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  return <FileText size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
}

function StudyContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [pageMap, setPageMap] = useState<Record<string, AcademyInstructorPage>>({});
  const [loading, setLoading] = useState(true);
  const [learnerSample, setLearnerSample] = useState(false);

  useEffect(() => {
    setLearnerSample(
      isAcademyLocalReview() && new URLSearchParams(window.location.search).get("sample") === "learner"
    );
    async function load() {
      const myRecords = await getMyInstructorRecords(profile.user_id);
      setRecords(myRecords);
      const courseIds = myRecords.map((r) => r.course_id);
      const activeCourseIds = myRecords.filter((r) => r.is_active).map((r) => r.course_id);
      const [courses, mats, pages] = await Promise.all([
        getCoursesByIds(courseIds),
        listMaterialsForInstructor(courseIds),
        Promise.all(activeCourseIds.map((cid) => getInstructorPageForViewer(cid).catch(() => null)))
      ]);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
      setMaterials(mats);
      setPageMap(Object.fromEntries(pages.filter((p): p is AcademyInstructorPage => !!p).map((p) => [p.course_id, p])));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (learnerSample) {
    const course = academyPreviewCourses[0];
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span>
            <h2 className="text-base font-bold text-[var(--mikke-text)]">{course.name}</h2>
          </div>
          <p className="mt-4 text-sm font-bold text-[var(--mikke-text)]">受講者用の復習ページ</p>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">講座の振り返り、受講者に配布する資料、本部からのお知らせをここで確認できます。</p>
          <div className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4">
            <p className="text-sm font-bold text-[var(--mikke-text)]">講座の振り返り</p>
            <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">当日のポイントと、自宅で練習する内容を確認しましょう。</p>
          </div>
        </section>
      </div>
    );
  }
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {records.map((rec) => {
        const course = courseMap[rec.course_id];
        const courseMaterials = materials.filter((m) => m.course_id === rec.course_id);
        const page = pageMap[rec.course_id];
        // 講師用ファイルは設置ブロックに依存させず、講師用資料ページの定位置に必ず表示する。
        const contentBlocks = (page?.blocks ?? []).filter((block) => block.type !== "materials-list");
        return (
          <section key={rec.id} className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
              <h2 className="text-sm font-bold text-[var(--mikke-text)] md:text-base">{course?.name}</h2>
            </div>

            {!rec.is_active ? (
              <p className="text-sm font-bold leading-6 text-[var(--mikke-text)]">活動中の講師だけに限定された資料は現在利用できません。本部にお問い合わせください。</p>
            ) : (
              <>
                {contentBlocks.length ? (
                  <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4 md:p-5">
                    <PageBlocks blocks={contentBlocks} />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--mikke-muted)]">本部からの講師用資料はまだありません。</p>
                )}

                <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                    <p className="text-sm font-bold text-[var(--mikke-text)]">講師用ファイル</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">PDF、動画、ダウンロード資料、外部URLなど、本部がこの講座で共有した内容です。</p>
                  {courseMaterials.length ? (
                    <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                      {courseMaterials.map((m) => (
                        <li key={m.id}>
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)]"
                          >
                            {kindIcon(m.kind)}
                            <span className="min-w-0 flex-1 truncate">{m.title}</span>
                            <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--mikke-muted)]">現在、表示できる講師用ファイルはありません。</p>
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function StudyPage() {
  return (
    <KoushiShell title="復習ページ・講師用資料">
      <StudyContent />
    </KoushiShell>
  );
}
