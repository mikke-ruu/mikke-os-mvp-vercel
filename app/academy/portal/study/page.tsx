"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Link2, Video } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords, listMaterialsForInstructor } from "@/lib/academy/instructor-portal";
import { getInstructorPageForViewer } from "@/lib/academy/instructor-page";
import { getLearnerPageForViewer } from "@/lib/academy/learner-page";
import { listMyLearnerApplications } from "@/lib/academy/learner-portal";
import { getAcademyRouteContext } from "@/lib/academy/access-context";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { isAcademyLocalReview, academyPreviewCourses } from "@/lib/academy/preview";
import type { AcademyApplication, AcademyCourse, AcademyInstructor, AcademyInstructorPage, AcademyLearnerPage, AcademyMaterial } from "@/types/database";

function kindIcon(kind: AcademyMaterial["kind"]) {
  if (kind === "video") return <Video size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  if (kind === "link") return <Link2 size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  return <FileText size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
}

function StudyContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [learnerApps, setLearnerApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [pageMap, setPageMap] = useState<Record<string, AcademyInstructorPage>>({});
  const [learnerPageMap, setLearnerPageMap] = useState<Record<string, AcademyLearnerPage>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"learner" | "instructor">("learner");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view") ?? params.get("sample");
    if (requestedView) setView(requestedView === "instructor" ? "instructor" : "learner");
    async function load() {
      const academyId = getAcademyRouteContext()?.academyId;
      const [myRecords, myLearnerApps] = await Promise.all([
        getMyInstructorRecords(profile.user_id, academyId),
        listMyLearnerApplications(profile.user_id, academyId)
      ]);
      setRecords(myRecords);
      setLearnerApps(myLearnerApps);
      if (!requestedView) setView(myLearnerApps.length > 0 ? "learner" : "instructor");
      const instructorCourseIds = myRecords.map((record) => record.course_id);
      const learnerCourseIds = [...new Set(myLearnerApps.map((application) => application.course_id))];
      const courseIds = [...new Set([...instructorCourseIds, ...learnerCourseIds])];
      const [courses, mats, pages, learnerPages] = await Promise.all([
        getCoursesByIds(courseIds),
        listMaterialsForInstructor(instructorCourseIds),
        Promise.all(instructorCourseIds.map((courseId) => getInstructorPageForViewer(courseId).catch(() => null))),
        Promise.all(learnerCourseIds.map((courseId) => getLearnerPageForViewer(courseId).catch(() => null)))
      ]);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
      setMaterials(mats);
      setPageMap(Object.fromEntries(pages.filter((p): p is AcademyInstructorPage => !!p).map((p) => [p.course_id, p])));
      setLearnerPageMap(Object.fromEntries(learnerPages.filter((page): page is AcademyLearnerPage => !!page).map((page) => [page.course_id, page])));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (view === "learner") {
    const learnerCourseIds = [...new Set(learnerApps.map((application) => application.course_id))];
    if (learnerCourseIds.length === 0) {
      return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">受講中・修了した講座はありません。</p>;
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {learnerCourseIds.map((courseId) => {
          const course = courseMap[courseId] ?? (isAcademyLocalReview() ? academyPreviewCourses.find((item) => item.id === courseId) : undefined);
          const page = learnerPageMap[courseId];
          return <section key={courseId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
            <h2 className="text-base font-bold text-[var(--mikke-text)]">{course?.name}</h2>
          </div>
          <div className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 md:p-5">
            {page?.blocks.length ? <PageBlocks blocks={page.blocks} /> : <p className="text-sm text-[var(--mikke-muted)]">本部が復習ページを準備中です。</p>}
          </div>
        </section>;
        })}
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
