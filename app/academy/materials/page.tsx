"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Eye, EyeOff, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { MATERIAL_KIND_LABELS, deleteMaterial, listMaterials, setMaterialPublished } from "@/lib/academy/materials";
import type { AcademyCourse, AcademyHeadquarters, AcademyMaterial } from "@/types/database";

function MaterialsContent() {
  const { profile } = useAuth();
  // AC-C4: 講師専用ページビルダーの「この講座の教材を管理する」リンク
  // (/academy/materials?course=[id]) から来た場合、その講座で絞り込んだ状態で開く。
  const searchParams = useSearchParams();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>(searchParams.get("course") ?? "");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  const shown = courseFilter ? materials.filter((m) => m.course_id === courseFilter) : materials;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
          <h2 className="text-base font-bold text-[var(--mikke-text)]">教材・資料</h2>
        </div>
        <Link href={createHref} className="flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 教材を追加
        </Link>
      </div>

      <div className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-text)]">
        ここで登録したPDF・動画・ダウンロード資料・外部URLは、マイポータルの「復習・共有ページ」に表示されます。現物教材の発送とステップ教材は、それぞれ別の設定です。
      </div>

      {courses.length > 0 ? (
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
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ教材がありません。</p>
          <Link href={createHref} className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            教材を追加する
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => {
            const course = courseMap[m.course_id];
            return (
              <li key={m.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {course ? <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span> : null}
                      <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">
                        {MATERIAL_KIND_LABELS[m.kind]}
                      </span>
                    </div>
                    <a href={m.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm font-bold text-[var(--mikke-text)]">
                      <span className="truncate">{m.title}</span>
                      <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                    </a>
                    <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">{m.requires_active ? "活動中の講師のみ閲覧" : "認定講師が閲覧可"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => togglePublish(m)}
                      disabled={busyId === m.id}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                        m.is_published ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                      }`}
                    >
                      {m.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                      {m.is_published ? "公開" : "非公開"}
                    </button>
                    <button onClick={() => remove(m)} disabled={busyId === m.id} className="text-[var(--mikke-danger)]">
                      <Trash2 size={15} />
                    </button>
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

export default function MaterialsPage() {
  return (
    <HonbuShell title="教材・資料">
      <Suspense fallback={<p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>}>
        <MaterialsContent />
      </Suspense>
    </HonbuShell>
  );
}
