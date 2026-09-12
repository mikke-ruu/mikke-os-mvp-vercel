"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ManualResourceForm } from "./ManualResourceForm";
import { PrivateInstructorResourceForm } from "./PrivateInstructorResourceForm";
import { PrivateMaterialFiles } from "./PrivateMaterialFiles";
import { privateMaterialUiEnabled } from "@/lib/academy/private-material-ui";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, EyeOff, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { MATERIAL_KIND_LABELS, deleteMaterial, listMaterials, setMaterialPublished } from "@/lib/academy/materials";
import type { AcademyCourse, AcademyHeadquarters, AcademyMaterial } from "@/types/database";

export function ManualResources({ courseId, onChange }: { courseId?: string; onChange?: (materials: AcademyMaterial[]) => void }) {
  const { profile } = useAuth();
  // AC-C4: 講師専用ページビルダーの「この講座の教材を管理する」リンク
  // (/academy/materials?course=[id]) から来た場合、その講座で絞り込んだ状態で開く。
  const searchParams = useSearchParams();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>(courseId ?? searchParams.get("course") ?? "");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingPdf, setAddingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) {
      const [list, courseList] = await Promise.all([listMaterials(foundHq.id), listCourses(foundHq.id)]);
      setMaterials(list);
      setCourses(courseList);
    }
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
  const selectedCourse = courseFilter ? courseMap[courseFilter] : null;
  const shown = courseFilter ? materials.filter((m) => m.course_id === courseFilter) : materials;
  useEffect(() => {
    onChange?.(courseFilter ? materials.filter((m) => m.course_id === courseFilter) : materials);
  }, [materials, courseFilter, onChange]);
  const createHref = toCurrentAcademyContextHref(
    `/academy/materials/new${courseFilter ? `?course=${encodeURIComponent(courseFilter)}` : ""}`
  );

  async function togglePublish(m: AcademyMaterial) {
    if (!hq) return;
    setBusyId(m.id);
    try {
      const next = await setMaterialPublished(hq.id, m, !m.is_published);
      setMaterials((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: AcademyMaterial) {
    if (!hq || !confirm(`教材「${m.title}」を削除しますか？`)) return;
    setBusyId(m.id);
    try {
      await deleteMaterial(hq.id, m.id);
      setMaterials((prev) => prev.filter((x) => x.id !== m.id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;
  if (addingPdf && courseId) return <PrivateInstructorResourceForm courseId={courseId} onClose={() => { setAddingPdf(false); void load(); }} />;
  if (adding && courseId) return <ManualResourceForm courseId={courseId} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />;

  return (
    <div className="space-y-4">
      {courseId && privateMaterialUiEnabled ? <button type="button" onClick={() => setAddingPdf(true)} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)]">＋ PDF資料を設定</button> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!courseId ? <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p> : null}
          <h2 className="text-base font-bold text-[var(--mikke-text)]">添付資料・リンク</h2>
        </div>
        {courseId ? <button type="button" onClick={() => setAdding(true)} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)]">＋ 資料リンクを設定</button> : <Link href={createHref} className="flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 資料リンクを追加
        </Link>}
      </div>

      {selectedCourse && !courseId ? (
        <div className="rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3">
          <Link href={toCurrentAcademyContextHref(`/academy/courses/${selectedCourse.id}/instructor-page`)} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">
            <ArrowLeft size={14} /> {selectedCourse.name}のマニュアルに戻る
          </Link>
          <p className="mt-2 text-sm font-bold text-[var(--mikke-text)]">{selectedCourse.code} {selectedCourse.name}</p>
        </div>
      ) : null}

      {!courseId ? <div className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-text)]">
        講座の進め方、材料の購入先、PDF、動画、外部URLなど、認定講師にだけ見せる資料を管理します。受講者の復習内容とは別です。
      </div> : null}

      {!courseId && courses.length > 0 ? (
        <select
          className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
        >
          <option value="">すべての講座</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </select>
      ) : null}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <GraduationCap size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ添付資料・リンクがありません。</p>
          {courseId ? <button type="button" onClick={() => setAdding(true)} className="mt-3 min-h-11 text-sm text-[var(--mikke-primary)]">資料リンクを設定</button> : <Link href={createHref} className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            ファイルを追加する
          </Link>}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => {
            const course = courseMap[m.course_id];
            return (
              <li key={m.id} className="border-b border-[var(--mikke-line)] bg-white py-3">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {course ? <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span> : null}
                      <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">
                        {MATERIAL_KIND_LABELS[m.kind]}
                      </span>
                    </div>
                    {m.delivery_mode === "private_file" ? <><p className="mt-1 text-sm font-bold">{m.title}</p><PrivateMaterialFiles parent={{ audience: "instructor", parentId: m.id }} editable /></> : m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm font-bold text-[var(--mikke-text)]">
                      <span className="break-words">{m.title}</span>
                      <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                    </a> : <p className="text-sm">{m.title}</p>}
                    <p className="mt-1 text-xs font-bold text-[var(--mikke-text-soft)]">見せる対象：{m.requires_active ? "活動中の講師だけ" : "この講座の認定講師全員"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <button
                      onClick={() => togglePublish(m)}
                      disabled={busyId === m.id}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                        m.is_published ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                      }`}
                    >
                      {m.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                      {m.is_published ? "マイポータルに表示" : "下書き"}
                    </button>
                    {m.delivery_mode !== "private_file" ? <button onClick={() => remove(m)} disabled={busyId === m.id} className="text-[var(--mikke-danger)]">
                      <Trash2 size={15} />
                    </button> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
