"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, FileText, Link2, Video } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords, listMaterialsForInstructor } from "@/lib/academy/instructor-portal";
import { getInstructorPageForViewer } from "@/lib/academy/instructor-page";
import { getLearnerPageForViewer } from "@/lib/academy/learner-page";
import { listMyLearnerApplications } from "@/lib/academy/learner-portal";
import { listMyCourseAccessGrants, resolveCourseAccessGrant } from "@/lib/academy/course-access";
import { getAcademyRouteContext, toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { PrivateMaterialFiles } from "@/components/academy/PrivateMaterialFiles";
import { isAcademyLocalReview, academyPreviewCourses } from "@/lib/academy/preview";
import type { AcademyApplication, AcademyCourse, AcademyCourseAccessGrant, AcademyInstructor, AcademyInstructorPage, AcademyLearnerPage, AcademyMaterial } from "@/types/database";

function formatAccessDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo"
  }).format(new Date(value));
}

function kindIcon(kind: AcademyMaterial["kind"]) {
  if (kind === "video") return <Video size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  if (kind === "link") return <Link2 size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  return <FileText size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
}

function StudyContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const selectedCourseId = searchParams.get("course");
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [learnerApps, setLearnerApps] = useState<AcademyApplication[]>([]);
  const [offeringCourseIds, setOfferingCourseIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [pageMap, setPageMap] = useState<Record<string, AcademyInstructorPage>>({});
  const [learnerPageMap, setLearnerPageMap] = useState<Record<string, AcademyLearnerPage>>({});
  const [accessGrants, setAccessGrants] = useState<AcademyCourseAccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"learner" | "instructor">("learner");

  useEffect(() => {
    const requestedView = searchParams.get("view") ?? searchParams.get("sample");
    setLoading(true);
    setLoadError("");
    let cancelled = false;
    if (requestedView) setView(requestedView === "instructor" ? "instructor" : "learner");
    async function load() {
      try {
      const academyId = getAcademyRouteContext()?.academyId;
      let offeringQuery = supabase.from("academy_offering_applications").select("course_ids").eq("learner_user_id", profile.user_id).eq("status", "paid");
      if (academyId) offeringQuery = offeringQuery.eq("headquarters_id", academyId);
      const { data: offeringApps, error: offeringError } = await offeringQuery;
      if (offeringError) throw offeringError;
      const newCourseIds = [...new Set((offeringApps ?? []).flatMap(row => Array.isArray(row.course_ids) ? row.course_ids.filter((id: unknown): id is string => typeof id === "string") : []))] as string[];
      const [myRecords, myLearnerApps] = await Promise.all([
        getMyInstructorRecords(profile.user_id, academyId),
        listMyLearnerApplications(profile.user_id, academyId)
      ]);
      if (cancelled) return;
      setRecords(myRecords);
      setLearnerApps(myLearnerApps);
      setOfferingCourseIds(newCourseIds);
      if (!requestedView) setView(myLearnerApps.length > 0 || newCourseIds.length > 0 ? "learner" : "instructor");
      const instructorCourseIds = myRecords.map((record) => record.course_id);
      const learnerCourseIds = [...new Set([...myLearnerApps.map((application) => application.course_id), ...newCourseIds])];
      const courseIds = [...new Set([...instructorCourseIds, ...learnerCourseIds])];
      const [courses, mats, pages, learnerPages, grants] = await Promise.all([
        getCoursesByIds(courseIds),
        listMaterialsForInstructor(instructorCourseIds),
        Promise.all(instructorCourseIds.map((courseId) => getInstructorPageForViewer(courseId).catch(() => null))),
        Promise.all(learnerCourseIds.map((courseId) => getLearnerPageForViewer(courseId).catch(() => null))),
        listMyCourseAccessGrants(learnerCourseIds)
      ]);
      if (cancelled) return;
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
      setMaterials(mats);
      setPageMap(Object.fromEntries(pages.filter((p): p is AcademyInstructorPage => !!p).map((p) => [p.course_id, p])));
      setLearnerPageMap(Object.fromEntries(learnerPages.filter((page): page is AcademyLearnerPage => !!page).map((page) => [page.course_id, page])));
      setAccessGrants(grants);
      setLoading(false);
      } catch { if (!cancelled) { setLoadError("教材を読み込めませんでした。画面を再読み込みしてください。"); setLoading(false); } }
    }
    load();
    return () => { cancelled = true; };
  }, [profile.user_id, searchParams]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (loadError) return <p role="alert" className="py-8 text-sm text-[var(--mikke-danger)]">{loadError}</p>;
  if (view === "learner") {
    const learnerCourseIds = [...new Set([...learnerApps.map((application) => application.course_id), ...offeringCourseIds])];
    if (learnerCourseIds.length === 0) {
      return <div className="rounded-lg border border-[var(--mikke-line)] bg-white p-6 text-sm leading-7"><h2 className="font-bold">講座復習ページを表示できる受講履歴がありません</h2><p>講座復習ページは、受講の登録と教材の閲覧権限がある講座に表示されます。講師として登録されているだけでは表示されません。</p><p>受講済みなのに表示されない場合は、本部に受講登録のアカウントをご確認ください。本部で作成中のページは編集画面の「プレビュー」から確認できます。</p><Link className="mt-3 inline-block text-[var(--mikke-primary)]" href="?view=instructor">講師マニュアルページを確認する →</Link></div>;
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {learnerCourseIds.map((courseId) => {
          const course = courseMap[courseId] ?? (isAcademyLocalReview() ? academyPreviewCourses.find((item) => item.id === courseId) : undefined);
          const page = learnerPageMap[courseId];
          const access = resolveCourseAccessGrant(accessGrants, courseId);
          return <section key={courseId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
            <h2 className="text-base font-bold text-[var(--mikke-text)]">{course?.name}</h2>
          </div>
          {access.state === "active" ? (
            <>
              <p className="mt-3 text-sm font-bold text-[var(--mikke-text)]">
                {access.grant.ends_at ? `閲覧期限：${formatAccessDate(access.grant.ends_at)}` : "閲覧期限：期限なし"}
              </p>
              <div className="mt-3 rounded-xl bg-[var(--mikke-surface-soft)] p-4 md:p-5">
                {page?.blocks.length ? <PageBlocks blocks={page.blocks} /> : <p className="text-sm text-[var(--mikke-muted)]">本部が講座復習ページを準備中です。</p>}
                {page ? <PrivateMaterialFiles parent={{ audience: "learner", parentId: page.id }} /> : null}
              </div>
            </>
          ) : access.state === "upcoming" ? (
            <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-sm font-bold text-[var(--mikke-text)]">閲覧開始：{formatAccessDate(access.grant.starts_at)}</p>
          ) : access.state === "expired" ? (
            <div className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4">
              <p className="text-sm font-bold text-[var(--mikke-text)]">教材の閲覧期間は終了しました。</p>
              <p className="mt-1 text-sm text-[var(--mikke-muted)]">修了・認定の履歴はそのまま残ります。延長については本部へお問い合わせください。</p>
            </div>
          ) : access.state === "revoked" ? (
            <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-sm font-bold text-[var(--mikke-text)]">現在、この教材は利用できません。本部へお問い合わせください。</p>
          ) : (
            <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-sm font-bold text-[var(--mikke-text)]">本部が教材の利用期間を確認中です。</p>
          )}
        </section>;
        })}
      </div>
    );
  }
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;
  if (selectedCourseId && !records.some(rec => rec.course_id === selectedCourseId)) return <p className="py-8 text-sm text-[var(--mikke-muted)]">この講座の講師マニュアルは表示できません。登録されている講座を選んでください。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {records.filter(rec => !selectedCourseId || rec.course_id === selectedCourseId).map((rec) => {
        const course = courseMap[rec.course_id];
        const courseMaterials = materials.filter((m) => m.course_id === rec.course_id);
        const page = pageMap[rec.course_id];
        // 添付資料・リンクは設置ブロックに依存させず、講師マニュアルページの定位置に必ず表示する。
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
                  <p className="text-sm text-[var(--mikke-muted)]">本部からの講師マニュアルページはまだありません。</p>
                )}

                <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                    <p className="text-sm font-bold text-[var(--mikke-text)]">添付資料・リンク</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">PDF、動画、ダウンロード資料、外部URLなど、本部がこの講座で共有した内容です。</p>
                  {courseMaterials.length ? (
                    <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                      {courseMaterials.map((m) => (
                        <li key={m.id}>
                          {m.delivery_mode === "private_file" ? <><p className="text-sm font-bold">{m.title}</p><PrivateMaterialFiles parent={{ audience: "instructor", parentId: m.id }} /></> : m.url ? <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)]"
                          >
                            {kindIcon(m.kind)}
                            <span className="min-w-0 flex-1 truncate">{m.title}</span>
                            <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                          </a> : <p className="text-sm">{m.title}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--mikke-muted)]">現在、表示できる添付資料・リンクはありません。</p>
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

function StudyPageContent() {
  const requestedView = useSearchParams().get("view");
  const returnHref = `/academy/portal${requestedView === "instructor" || requestedView === "learner" ? `?view=${requestedView}` : ""}`;
  return (
    <KoushiShell title="講座復習ページ・講師マニュアルページ">
      <nav aria-label="教材ページの切り替え" className="mx-auto mb-4 flex max-w-3xl flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-[var(--mikke-primary)]" href={toCurrentAcademyContextHref(returnHref)}>マイページへ戻る</Link>
        <Link className="rounded-lg border border-[var(--mikke-line)] px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]" href="?view=learner">講座復習ページ</Link>
        <Link className="rounded-lg border border-[var(--mikke-line)] px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]" href="?view=instructor">講師マニュアルページ</Link>
      </nav>
      <StudyContent />
    </KoushiShell>
  );
}

export default function StudyPage() {
  return <Suspense fallback={<p className="p-6">教材を読み込んでいます…</p>}><StudyPageContent /></Suspense>;
}
