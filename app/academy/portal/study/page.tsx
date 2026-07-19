"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Link2, Video } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords, listMaterialsForInstructor } from "@/lib/academy/instructor-portal";
import { getInstructorPageForViewer } from "@/lib/academy/instructor-page";
import { PageBlocks, pageBlocksHasMaterialsList } from "@/components/academy/PageBlocks";
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

  useEffect(() => {
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
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {records.map((rec) => {
        const course = courseMap[rec.course_id];
        const courseMaterials = materials.filter((m) => m.course_id === rec.course_id);
        const page = pageMap[rec.course_id];
        // AC-C3: 講師専用ページに「教材リスト」ブロックがあれば、そこ(PageBlocks内)に一覧を差し込む。
        // 旧データ（ブロック未設置）との互換のため、無い場合だけ末尾に別枠で表示する。
        const hasMaterialsBlock = pageBlocksHasMaterialsList(page?.blocks);
        return (
          <section key={rec.id} className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
              <h2 className="text-sm font-bold text-[var(--mikke-text)] md:text-base">{course?.name}</h2>
            </div>

            {!rec.is_active ? (
              <p className="text-xs text-[var(--mikke-muted)]">活動権限がないため、復習コンテンツは表示されません。本部にお問い合わせください。</p>
            ) : (
              <>
                {page?.blocks.length ? (
                  <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4 md:p-5">
                    <PageBlocks blocks={page.blocks} materials={courseMaterials} />
                  </div>
                ) : (
                  <p className="text-xs text-[var(--mikke-muted)]">復習ページは準備中です。</p>
                )}

                {!hasMaterialsBlock && courseMaterials.length ? (
                  <div>
                    <p className="text-xs font-bold text-[var(--mikke-accent)]">教材・資料</p>
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
                  </div>
                ) : null}
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
    <KoushiShell title="復習ページ">
      <StudyContent />
    </KoushiShell>
  );
}
